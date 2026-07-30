from rest_framework import viewsets, views, status, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from django.http import HttpResponse, JsonResponse
from django.db.models import Q, Sum, Count
from django.utils import timezone
from datetime import date
from decimal import Decimal
import uuid

from rest_framework_simplejwt.tokens import RefreshToken
from django.db import transaction

from .. import services
from ..models import (
    Usuario, Musico, Evento, Asistencia, Descuento, Pago,
    RendimientoMusico, ConfiguracionSistema, Adelanto, PlanillaLiquidacion,
    ContratoMusico, DetalleMontoDiario, JefeSeccion, Deuda, AbonoDeuda,
    CampanaCanaston, ResultadoCanaston
)
from ..permissions import EsAdministrativo, EsJefeSeccion, EsPresidente
from ..serializers import (
    UsuarioSerializer, UsuarioCreateSerializer,
    MusicoSerializer, MusicoListSerializer, EventoSerializer,
    AsistenciaSerializer, DescuentoSerializer, PagoSerializer,
    ConfiguracionSistemaSerializer, AdelantoSerializer,
    PlanillaLiquidacionSerializer, PlanillaLiquidacionDetalleSerializer,
    CampanaCanastonSerializer, ResultadoCanastonSerializer
)
from services.rendimiento_calculator import RendimientoCalculator
from ..canaston_service import calcular_elegibilidad_canaston

class EventoViewSet(viewsets.ModelViewSet):
    queryset = Evento.objects.all().order_by('-fecha_hora_cita')
    serializer_class = EventoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def check_permissions(self, request):
        super().check_permissions(request)
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'bulk_create']:
            if request.user.rol in ['MUSICO', 'JEFE_SECCION']:
                self.permission_denied(request, message="No tienes permisos para modificar eventos.")

    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        if not isinstance(request.data, list):
            return Response({'error': 'Se esperaba una lista de eventos.'}, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = self.get_serializer(data=request.data, many=True)
        if serializer.is_valid():
            with transaction.atomic():
                eventos = serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'], url_path='desconvocar_musico')
    def desconvocar_musico(self, request, pk=None):
        """Quita un músico de la lista de convocados de este evento."""
        evento = self.get_object()
        musico_id = request.data.get('musico_id')
        if not musico_id:
            return Response({'error': 'Se requiere musico_id'}, status=status.HTTP_400_BAD_REQUEST)
        if musico_id in evento.convocados:
            evento.convocados.remove(musico_id)
            evento.save()
            return Response({'ok': True, 'mensaje': f'Músico {musico_id} desconvocado del evento {evento.titulo}'})
        return Response({'error': 'El músico no estaba convocado en este evento'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def registrar_asistencia(self, request, pk=None):
        evento = self.get_object()
        asistencias_data = request.data.get('asistencias', [])
        
        config = ConfiguracionSistema.objects.first()
        hora_limite = config.hora_limite_tardanza if config else evento.fecha_hora_cita.time()
        
        for item in asistencias_data:
            musico_id = item.get('musico_id')
            estado = item.get('estado', 'AUSENTE')
            hora_llegada = item.get('hora_llegada')
                
            Asistencia.objects.update_or_create(
                musico_id=musico_id,
                evento=evento,
                defaults={
                    'estado': estado,
                    'hora_llegada': hora_llegada if hora_llegada else None
                }
            )
        return Response({'success': True})

    @action(detail=True, methods=['post'])
    def generar_pagos(self, request, pk=None):
        if request.user.rol not in ['DIRECTOR', 'SUBDIRECTOR'] and not request.user.is_superuser:
            return Response({'error': 'Sin permisos'}, status=status.HTTP_403_FORBIDDEN)
            
        evento = self.get_object()
        config = ConfiguracionSistema.objects.first()
        monto_base = config.monto_por_evento if config else Decimal('100.00')
        
        asistencias = Asistencia.objects.filter(
            evento=evento, estado__in=['PRESENTE', 'TARDANZA', 'JUSTIFICADO']
        )
        
        generados = 0
        for asistencia in asistencias:
            if not Pago.objects.filter(musico=asistencia.musico, evento=evento).exists():
                total_descuentos = Descuento.objects.filter(
                    musico=asistencia.musico
                ).aggregate(total=Sum('monto'))['total'] or Decimal('0.00')
                
                Pago.objects.create(
                    musico=asistencia.musico,
                    evento=evento,
                    salario_base=monto_base,
                    descuentos_totales=total_descuentos,
                    adelantos_totales=Decimal('0.00'),
                    neto_pagar=monto_base - total_descuentos,
                    fecha_liquidacion=timezone.now(),
                    estado='PENDIENTE'
                )
                generados += 1
        return Response({'success': True, 'generados': generados})

    @action(detail=True, methods=['get'])
    def generar_mensaje(self, request, pk=None):
        """Solo DIRECTOR, SUBDIRECTOR y PRESIDENTE pueden generar mensajes de WhatsApp"""
        if request.user.rol not in ['DIRECTOR', 'SUBDIRECTOR', 'PRESIDENTE'] and not request.user.is_superuser:
            return Response({'error': 'Sin permisos para generar mensajes de WhatsApp'}, status=status.HTTP_403_FORBIDDEN)
        
        evento = self.get_object()
        
        grupos = [
            ('TROMPETAS', ['TROMPETA']),
            ('SAXOS', ['SAXOFON']),
            ('CLARINETES', ['CLARINETE']),
            ('BARÍTONOS', ['BARITONO']),
            ('TROMBONES', ['TROMBON']),
            ('TUBAS', ['TUBA']),
            ('SECCIÓN PERCUSIÓN (BOMBOS, TAMBORES Y PLATILLOS)', ['BOMBO', 'TAMBOR', 'PLATILLOS', 'PERCUSION']),
        ]
        
        fecha_hora_local = timezone.localtime(evento.fecha_hora_cita)
        fecha_str = fecha_hora_local.strftime('%d/%m/%Y')
        hora_str = fecha_hora_local.strftime('%I:%M %p')
        
        lines = []
        lines.append("*RELACIÓN NOMINAL*")
        if evento.titulo_contrato:
            lines.append(f"*Contrato:* {evento.titulo_contrato}")
        lines.append(f"*Evento:* {evento.titulo}")
        lines.append("")
        lines.append(f"*Fecha y Hora:* {fecha_str} - {hora_str}")
        if evento.lugar_concentracion:
            lines.append(f"*Concentración:* {evento.lugar_concentracion}")
        
        uniforme_display = dict(Evento.UNIFORMES).get(evento.uniforme, evento.uniforme)
        if evento.uniforme_personalizado:
            if evento.uniforme == 'OTRO':
                uniforme_display = evento.uniforme_personalizado
            else:
                uniforme_display = f"{uniforme_display} - {evento.uniforme_personalizado}"
            
        lines.append(f"*Uniforme:* {uniforme_display}")
        if evento.detalles_uniforme:
            lines.append(f"   _{evento.detalles_uniforme}_")
        lines.append("")
        
        convocados = evento.convocados.all()
        for titulo, instrumentos in grupos:
            musicos_seccion = [m for m in convocados if m.instrumento in instrumentos]
            if musicos_seccion:
                lines.append(f"*{titulo}*")
                for idx, musico in enumerate(musicos_seccion, 1):
                    lines.append(f"{idx}. {musico.nombres} {musico.apellidos}")
                lines.append("")
                
        lines.append("*Nota:* Se ruega puntualidad a la hora de concentración.")
        
        return Response({'mensaje': '\n'.join(lines)})

    @action(detail=True, methods=['get'])
    def resumen_gastos(self, request, pk=None):
        """
        Devuelve el total de descuentos y adelantos registrados por músico para este evento.
        Esto se usa para pre-llenar la planilla de liquidaciones.
        """
        if request.user.rol not in ['DIRECTOR', 'SUBDIRECTOR', 'PRESIDENTE'] and not request.user.is_superuser:
            return Response({'error': 'Sin permisos'}, status=status.HTTP_403_FORBIDDEN)
            
        evento = self.get_object()
        
        # Descuentos para este evento (estado APROBADA o LIQUIDADA)
        descuentos = Descuento.objects.filter(evento=evento, estado__in=['APROBADA', 'LIQUIDADA'])
        
        # Adelantos vinculados a este evento a través del contrato
        adelantos = Adelanto.objects.filter(contrato__evento=evento, estado__in=['APROBADA', 'LIQUIDADA'])
        
        musicos_data = {}
        
        for d in descuentos:
            m_id = d.musico_id
            if m_id not in musicos_data:
                musicos_data[m_id] = {'multas': Decimal('0.00'), 'adelantos': Decimal('0.00')}
            musicos_data[m_id]['multas'] += d.monto
            
        for a in adelantos:
            m_id = a.musico_id
            if m_id not in musicos_data:
                musicos_data[m_id] = {'multas': Decimal('0.00'), 'adelantos': Decimal('0.00')}
            musicos_data[m_id]['adelantos'] += a.monto
            
        return Response({
            musico_id: {
                'multas': str(datos['multas']),
                'adelantos': str(datos['adelantos'])
            }
            for musico_id, datos in musicos_data.items()
        })

    @action(detail=True, methods=['get'])
    def liquidacion(self, request, pk=None):
        """
        Devuelve los detalles de la liquidación actual (si la hay), incluyendo qué músicos ya fueron pagados.
        """
        evento = self.get_object()
        planilla = evento.planillas.first()
        
        if not planilla:
            return Response({'is_liquidado': False, 'musicos_pagados': []})

        pagos = planilla.pagos.all().select_related('musico')
        detalles = []
        musicos_pagados = []
        for pago in pagos:
            musicos_pagados.append(pago.musico_id)
            
            # Usar origen y registrado_por del pago (nuevo), fallback a planilla
            origen_val = pago.origen or (pago.planilla.origen if pago.planilla else 'Desconocido')
            origen_pago = dict(PlanillaLiquidacion.ORIGEN).get(origen_val, origen_val)
            
            registrado_por_val = pago.registrado_por or (pago.planilla.registrado_por if pago.planilla else None)
            registrado_por_pago = registrado_por_val.get_full_name() if registrado_por_val else 'Desconocido'
            
            detalles.append({
                'musico_id': pago.musico_id,
                'acordado': str(pago.salario_base),
                'multas': str(pago.descuentos_totales),
                'adelantos': str(pago.adelantos_totales),
                'saldo': str(pago.neto_pagar),
                'fecha_pago': pago.fecha_liquidacion.isoformat() if pago.fecha_liquidacion else None,
                'origen': origen_pago,
                'registrado_por': registrado_por_pago,
            })

        origen_display = dict(PlanillaLiquidacion.ORIGEN).get(planilla.origen, planilla.origen)

        return Response({
            'is_liquidado': True,
            'fecha_liquidacion': planilla.fecha_creacion.isoformat() if planilla.fecha_creacion else None,
            'origen': origen_display,
            'registrado_por': planilla.registrado_por.get_full_name() if planilla.registrado_por else 'Desconocido',
            'detalles': detalles,
            'musicos_pagados': musicos_pagados
        })



class AsistenciaViewSet(viewsets.ModelViewSet):
    queryset = Asistencia.objects.all()
    serializer_class = AsistenciaSerializer
    permission_classes = [permissions.IsAuthenticated]
