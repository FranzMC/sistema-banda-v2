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

class DescuentoViewSet(viewsets.ModelViewSet):
    """
    API endpoint para gestionar los descuentos (sanciones) de los músicos.
    Permite crear, leer, actualizar y eliminar descuentos.
    """
    serializer_class = DescuentoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Obtiene los descuentos filtrados por rol del usuario.
        Si se provee el parámetro 'musico_id' en la URL,
        filtra los descuentos para ese músico específico.
        """
        queryset = Descuento.objects.all().order_by('-fecha_falta')
        user = self.request.user
        
        # DIRECTOR, SUBDIRECTOR, PRESIDENTE: ven todo
        if user.rol in ['DIRECTOR', 'SUBDIRECTOR', 'PRESIDENTE'] or user.is_superuser:
            pass
        # JEFE DE SECCIÓN: solo descuentos de su sección
        elif user.rol == 'JEFE_SECCION':
            instrumentos = user.get_instrumentos_encargados()
            if instrumentos:
                queryset = queryset.filter(musico__instrumento__in=instrumentos)
            else:
                return queryset.none()
        # MUSICO: solo sus propios descuentos
        elif user.rol == 'MUSICO':
            if hasattr(user, 'perfil_musico') and user.perfil_musico:
                queryset = queryset.filter(musico=user.perfil_musico)
            else:
                return queryset.none()
        # Otros roles: no ven descuentos
        else:
            return queryset.none()
        
        musico_id = self.request.query_params.get('musico') or self.request.query_params.get('musico_id')
        if musico_id:
            queryset = queryset.filter(musico_id=musico_id)
            
        evento_id = self.request.query_params.get('evento') or self.request.query_params.get('evento_id')
        if evento_id:
            queryset = queryset.filter(evento_id=evento_id)
            
        fecha_inicio = self.request.query_params.get('fecha_inicio')
        if fecha_inicio:
            queryset = queryset.filter(fecha_falta__gte=fecha_inicio)
            
        fecha_fin = self.request.query_params.get('fecha_fin')
        if fecha_fin:
            queryset = queryset.filter(fecha_falta__lte=fecha_fin)
            
        return queryset

    @action(detail=False, methods=['get'])
    def resumen_por_seccion(self, request):
        queryset = self.get_queryset()
        resumen = queryset.values('musico__instrumento').annotate(
            total_monto=Sum('monto'),
            cantidad=Count('id')
        ).order_by('-total_monto')
        
        resultado = [
            {
                'seccion': item['musico__instrumento'],
                'total': item['total_monto'],
                'cantidad': item['cantidad']
            } for item in resumen if item['musico__instrumento']
        ]
        return Response(resultado)

    @action(detail=False, methods=['get'])
    def estadisticas(self, request):
        queryset = self.get_queryset()
        hoy = date.today()
        
        total_mes = queryset.filter(fecha_falta__year=hoy.year, fecha_falta__month=hoy.month).aggregate(t=Sum('monto'))['t'] or 0
        total_general = queryset.aggregate(t=Sum('monto'))['t'] or 0
        cantidad = queryset.count()
        secciones_activas = queryset.values('musico__instrumento').distinct().count()
        
        return Response({
            'total_descuentos': total_general,
            'total_registros': cantidad,
            'secciones_activas': secciones_activas,
            'ultimo_mes': {
                'total': total_mes
            }
        })

    @action(detail=False, methods=['post'], url_path='sync')
    def sync(self, request):
        """
        Endpoint para sincronización Offline-First.
        Recibe una lista de descuentos (creados/modificados offline).
        Usa el campo 'uuid' para hacer upsert (crear o actualizar).
        """
        user = request.user
        faltas_data = request.data.get('descuentos', [])
        
        creados = 0
        actualizados = 0
        errores = []

        # BUG FIX 8: Buscar JefeSeccion correctamente por la relación real
        # La relación es: JefeSeccion.musico.usuario = user
        jefe_seccion = None
        instrumentos_permitidos = []
        if user.rol == 'JEFE_SECCION':
            try:
                jefe_seccion = JefeSeccion.objects.get(musico__usuario=user, activo=True)
            except JefeSeccion.DoesNotExist:
                jefe_seccion = None
            # Obtener instrumentos permitidos desde el campo seccion_encargada del usuario
            instrumentos_permitidos = user.get_instrumentos_encargados()

        for data in faltas_data:
            try:
                uuid_str = data.get('uuid')
                musico_id = data.get('musico_id')
                evento_id = data.get('evento_id')
                monto = data.get('monto')
                motivo = data.get('motivo') or data.get('concepto')
                fecha_falta = data.get('fecha_falta')

                if not uuid_str or not musico_id or not evento_id or not monto or not motivo:
                    errores.append({'uuid': uuid_str, 'error': 'Faltan campos obligatorios (uuid, musico_id, evento_id, monto, motivo)'})
                    continue

                # Validar permisos de sección para JEFE_SECCION
                if user.rol == 'JEFE_SECCION' and instrumentos_permitidos:
                    try:
                        musico_obj = Musico.objects.get(id=musico_id)
                        if musico_obj.instrumento not in instrumentos_permitidos:
                            errores.append({'uuid': uuid_str, 'error': f'No tienes permiso para aplicar descuento al músico de sección {musico_obj.instrumento}'})
                            continue
                    except Musico.DoesNotExist:
                        errores.append({'uuid': uuid_str, 'error': f'Músico con id {musico_id} no existe'})
                        continue

                descuento, created = Descuento.objects.update_or_create(
                    uuid=uuid_str,
                    defaults={
                        'musico_id': musico_id,
                        'evento_id': evento_id,
                        'jefe_seccion': jefe_seccion,
                        'monto': monto,
                        'motivo': motivo,
                        'fecha_falta': fecha_falta or timezone.now().date(),
                        'origen': 'APP_MOVIL',
                        'estado': 'APROBADA'
                    }
                )

                if created:
                    creados += 1
                else:
                    actualizados += 1
            except Exception as e:
                errores.append({'uuid': data.get('uuid'), 'error': str(e)})

        return Response({
            'success': True,
            'creados': creados,
            'actualizados': actualizados,
            'errores': errores
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'], url_path='bulk_seccion')
    def bulk_seccion(self, request):
        """
        Crea un lote de descuentos para una sección en un evento específico.
        Delega la lógica de negocio a la capa de servicios para mayor modularidad.
        """
        result = services.create_bulk_descuentos_seccion(request.user, request.data)
        
        if not result['success']:
            return Response({'error': result['error']}, status=result['status'])
            
        return Response(result['data'], status=result['status'])


class PagoViewSet(viewsets.ModelViewSet):
    queryset = Pago.objects.all().order_by('-fecha_liquidacion')
    serializer_class = PagoSerializer
    permission_classes = [permissions.IsAuthenticated]


class AdelantoViewSet(viewsets.ModelViewSet):
    queryset = Adelanto.objects.all().order_by('-fecha')
    serializer_class = AdelantoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """Filtrar adelantos según rol del usuario y params"""
        queryset = super().get_queryset()
        
        musico_id = self.request.query_params.get('musico') or self.request.query_params.get('musico_id')
        if musico_id:
            queryset = queryset.filter(musico_id=musico_id)
            
        evento_id = self.request.query_params.get('evento') or self.request.query_params.get('evento_id')
        if evento_id:
            queryset = queryset.filter(contrato__evento_id=evento_id)
            
        user = self.request.user
        
        # DIRECTOR, SUBDIRECTOR, PRESIDENTE: ven todo
        if user.rol in ['DIRECTOR', 'SUBDIRECTOR', 'PRESIDENTE'] or user.is_superuser:
            return queryset
        
        # JEFE DE SECCIÓN: no ven adelantos (solo directiva)
        if user.rol == 'JEFE_SECCION':
            return queryset.none()
            
        # MÚSICO: solo ven sus propios adelantos
        if user.rol == 'MUSICO':
            if hasattr(user, 'perfil_musico') and user.perfil_musico:
                return queryset.filter(musico=user.perfil_musico)
            else:
                return queryset.none()
        
        # Otros roles: no ven adelantos
        return queryset.none()

    @action(detail=False, methods=['post'], url_path='bulk_seccion')
    def bulk_seccion(self, request):
        """
        Crea un lote de adelantos para una sección en un evento específico.
        Delega la lógica de negocio a la capa de servicios para mayor modularidad.
        """
        result = services.create_bulk_adelantos_seccion(request.user, request.data)
        
        if not result['success']:
            return Response({'error': result['error']}, status=result.get('status', status.HTTP_400_BAD_REQUEST))
            
        return Response(result['data'], status=result.get('status', status.HTTP_200_OK))

    @action(detail=False, methods=['get'])
    def resumen_por_seccion(self, request):
        queryset = self.get_queryset()
        resumen = queryset.values('musico__instrumento').annotate(
            total_monto=Sum('monto'),
            cantidad=Count('id')
        ).order_by('-total_monto')
        
        resultado = [
            {
                'seccion': item['musico__instrumento'],
                'total': item['total_monto'],
                'cantidad': item['cantidad']
            } for item in resumen if item['musico__instrumento']
        ]
        return Response(resultado)

    @action(detail=False, methods=['get'])
    def estadisticas(self, request):
        queryset = self.get_queryset()
        hoy = date.today()
        
        total_mes = queryset.filter(fecha__year=hoy.year, fecha__month=hoy.month).aggregate(t=Sum('monto'))['t'] or 0
        total_general = queryset.aggregate(t=Sum('monto'))['t'] or 0
        cantidad = queryset.count()
        secciones_activas = queryset.values('musico__instrumento').distinct().count()
        
        return Response({
            'total_adelantos': total_general,
            'total_registros': cantidad,
            'secciones_activas': secciones_activas,
            'ultimo_mes': {
                'total': total_mes
            }
        })


    @action(detail=False, methods=['post'])
    def registrar_app(self, request):
        """
        Registra múltiples adelantos desde la app móvil.
        Delega toda la lógica de negocio a la capa de servicios.
        """
        result = services.registrar_adelantos_app(request.user, request.data)

        status_code = status.HTTP_400_BAD_REQUEST if not result['success'] else status.HTTP_200_OK
        
        return Response(result, status=status_code)


class PlanillaLiquidacionViewSet(viewsets.ModelViewSet):
    queryset = PlanillaLiquidacion.objects.all().order_by('-fecha_creacion')
    serializer_class = PlanillaLiquidacionSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return PlanillaLiquidacionDetalleSerializer
        return super().get_serializer_class()

    @action(detail=False, methods=['post'])
    def update_order(self, request):
        if request.user.rol not in ['DIRECTOR', 'SUBDIRECTOR', 'PRESIDENTE'] and not request.user.is_superuser:
            return Response({'error': 'Sin permisos'}, status=status.HTTP_403_FORBIDDEN)
            
        order_data = request.data.get('order', [])
        if not order_data:
            return Response({'error': 'Datos de orden requeridos'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            for item in order_data:
                Musico.objects.filter(id=item['id']).update(orden=item['order'])
            return Response({'success': True})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def previsualizar(self, request):
        if request.user.rol not in ['DIRECTOR', 'SUBDIRECTOR', 'PRESIDENTE'] and not request.user.is_superuser:
            return Response({'error': 'Sin permisos'}, status=status.HTTP_403_FORBIDDEN)

        """
        Pre-visualiza la planilla de liquidación para una lista de eventos específicos.
        Recibe una lista de IDs de eventos y devuelve los cálculos para cada músico.
        """
        eventos_ids = request.data.get('eventos_ids', [])
        
        if not eventos_ids:
            return Response({'error': 'Debe proporcionar al menos un ID de evento'}, status=status.HTTP_400_BAD_REQUEST)
            
        eventos = Evento.objects.filter(id__in=eventos_ids)
        if eventos.count() != len(eventos_ids):
            return Response({'error': 'Uno o más eventos no existen'}, status=status.HTTP_400_BAD_REQUEST)

        # Obtener todas las asistencias no liquidadas para estos eventos
        asistencias = Asistencia.objects.filter(
            evento_id__in=eventos_ids,
            liquidado=False,
            estado__in=['PRESENTE', 'TARDANZA', 'JUSTIFICADO']
        ).select_related('musico', 'evento')

        # Agrupar por músico
        musicos_data = {}
        for asistencia in asistencias:
            musico_id = asistencia.musico.id
            if musico_id not in musicos_data:
                musicos_data[musico_id] = {
                    'musico': asistencia.musico,
                    'asistencias': [],
                    'monto_base': Decimal('0.00')
                }
            musicos_data[musico_id]['asistencias'].append(asistencia)
            musicos_data[musico_id]['monto_base'] += asistencia.monto_acordado

        resultados = []
        for musico_id, data in musicos_data.items():
            musico = data['musico']
            
            # Obtener descuentos y adelantos no liquidados del músico
            descuentos = Descuento.objects.filter(
                musico=musico, 
                estado='APROBADA'
            )
            adelantos = Adelanto.objects.filter(
                musico=musico, 
                estado='APROBADA'
            )

            total_descuentos = descuentos.aggregate(total=Sum('monto'))['total'] or Decimal('0.00')
            total_adelantos = adelantos.aggregate(total=Sum('monto'))['total'] or Decimal('0.00')
            
            monto_final = data['monto_base'] - total_descuentos - total_adelantos

            resultados.append({
                'musico_id': musico.id,
                'musico_nombre': musico.nombre_completo,
                'monto_base': data['monto_base'],
                'total_descuentos': total_descuentos,
                'total_adelantos': total_adelantos,
                'monto_final': monto_final,
                'detalle_asistencias': [
                    {
                        'evento_id': a.evento.id,
                        'evento_titulo': a.evento.titulo,
                        'monto': a.monto_acordado,
                        'estado': a.estado
                    } for a in data['asistencias']
                ],
                'detalle_descuentos': [
                    {
                        'id': d.id,
                        'motivo': d.motivo,
                        'monto': d.monto,
                        'fecha': d.fecha
                    } for d in descuentos
                ],
                'detalle_adelantos': [
                    {
                        'id': ad.id,
                        'motivo': ad.motivo,
                        'monto': ad.monto,
                        'fecha': ad.fecha
                    } for ad in adelantos
                ],
            })

        # Ordenar por nombre de músico
        resultados.sort(key=lambda x: x['musico_nombre'])
        
        return Response({
            'eventos': [{'id': e.id, 'titulo': e.titulo} for e in eventos],
            'musicos': resultados,
            'resumen': {
                'total_musicos': len(resultados),
                'total_monto_base': sum(r['monto_base'] for r in resultados),
                'total_descuentos': sum(r['total_descuentos'] for r in resultados),
                'total_adelantos': sum(r['total_adelantos'] for r in resultados),
                'total_a_pagar': sum(r['monto_final'] for r in resultados)
            }
        })

    @action(detail=False, methods=['get'])
    def simular(self, request):
        musico_id = request.query_params.get('musico_id')
        
        musicos = Musico.objects.filter(activo=True)
        if musico_id:
            musicos = musicos.filter(id=musico_id)

        resultados = []
        for musico in musicos:
            asistencias = Asistencia.objects.filter(musico=musico, liquidado=False, estado__in=['PRESENTE', 'TARDANZA', 'JUSTIFICADO'])
            descuentos = Descuento.objects.filter(musico=musico, estado='APROBADA')
            adelantos = Adelanto.objects.filter(musico=musico, estado='APROBADA')

            monto_base = asistencias.aggregate(total=Sum('monto_acordado'))['total'] or Decimal('0.00')
            total_descuentos = descuentos.aggregate(total=Sum('monto'))['total'] or Decimal('0.00')
            total_adelantos = adelantos.aggregate(total=Sum('monto'))['total'] or Decimal('0.00')

            monto_final = monto_base - total_descuentos - total_adelantos

            if monto_base > 0 or total_descuentos > 0 or total_adelantos > 0:
                resultados.append({
                    'musico_id': musico.id,
                    'musico_nombre': musico.nombre_completo,
                    'monto_base': monto_base,
                    'total_descuentos': total_descuentos,
                    'total_adelantos': total_adelantos,
                    'monto_final': monto_final,
                    'detalle_asistencias': [{'evento': a.evento.titulo, 'monto': a.monto_acordado} for a in asistencias],
                    'detalle_descuentos': [{'motivo': d.motivo, 'monto': d.monto} for d in descuentos],
                    'detalle_adelantos': [{'motivo': ad.motivo, 'monto': ad.monto} for ad in adelantos],
                })

        return Response(resultados)

    @action(detail=False, methods=['post'])
    def liquidar_directo(self, request):
        """
        Liquida un evento directamente desde una tabla editable donde el usuario introduce
        los montos totales acordados, multas y adelantos manualmente o desde PDF.
        """
        if request.user.rol not in ['DIRECTOR', 'SUBDIRECTOR', 'PRESIDENTE'] and not request.user.is_superuser:
            return Response({'error': 'Sin permisos'}, status=status.HTTP_403_FORBIDDEN)
            
        evento_id = request.data.get('evento_id')
        titulo = request.data.get('titulo', f'Planilla {date.today().strftime("%Y-%m-%d")}')
        observaciones = request.data.get('observaciones', '')
        origen = request.data.get('origen', 'APP_MOVIL')
        datos_musicos = request.data.get('musicos', []) # Lista de { musico_id, acordado, multas, adelantos }
        
        if not evento_id:
            return Response({'error': 'Debe seleccionar un evento'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            evento = Evento.objects.get(id=evento_id)
        except Evento.DoesNotExist:
            return Response({'error': 'El evento no existe'}, status=status.HTTP_400_BAD_REQUEST)

        # Verificación de permisos
        if not request.user.is_superuser and request.user.rol not in ['DIRECTOR', 'SUBDIRECTOR', 'PRESIDENTE']:
            return Response({'error': 'No tienes el rol necesario para liquidar este evento'}, status=status.HTTP_403_FORBIDDEN)

        # Obtener o crear la planilla de liquidación para el evento
        planilla = evento.planillas.first()
        if not planilla:
            planilla = PlanillaLiquidacion.objects.create(
                titulo=titulo,
                observaciones=observaciones,
                completada=True,
                origen=origen,
                registrado_por=request.user
            )
            planilla.eventos.add(evento)

        pagos_generados = 0
        
        # Obtener IDs de músicos ya pagados en esta planilla para evitar duplicados
        musicos_ya_pagados = set(planilla.pagos.values_list('musico_id', flat=True))

        for dato in datos_musicos:
            if dato['musico_id'] in musicos_ya_pagados:
                continue

            try:
                musico = Musico.objects.get(id=dato['musico_id'])
            except Musico.DoesNotExist:
                continue

            acordado = Decimal(str(dato.get('acordado', 0) or 0))
            multas = Decimal(str(dato.get('multas', 0) or 0))
            adelantos = Decimal(str(dato.get('adelantos', 0) or 0))
            descuentos_extra = dato.get('descuentos_extra', [])

            total_extra = Decimal('0.00')
            for extra in descuentos_extra:
                monto_extra = Decimal(str(extra.get('monto', 0) or 0))
                if monto_extra > 0:
                    total_extra += monto_extra
                    # Crear descuentos extra (uniformes, gorras, etc.) vinculados al evento
                    Descuento.objects.create(
                        musico=musico,
                        evento=evento,
                        monto=monto_extra,
                        motivo=f"{extra.get('nombre')} - {evento.titulo}",
                        fecha_falta=date.today(),
                        estado='LIQUIDADA'
                    )

            monto_final = acordado - multas - adelantos - total_extra

            # Actualizar Asistencia/Acordado (no crear duplicados)
            Asistencia.objects.update_or_create(
                musico=musico,
                evento=evento,
                defaults={
                    'monto_acordado': acordado,
                    'liquidado': True,
                    'estado': 'PRESENTE'  # Asumimos presente si se le está pagando
                }
            )

            # Marcar descuentos existentes del evento como liquidados (NO crear nuevos)
            Descuento.objects.filter(
                musico=musico,
                evento=evento,
                estado='APROBADA'
            ).update(estado='LIQUIDADA')

            # Marcar adelantos existentes del evento como liquidados (NO crear nuevos)
            Adelanto.objects.filter(
                musico=musico,
                contrato__evento=evento,
                estado='APROBADA'
            ).update(estado='LIQUIDADA')

            # Crear el Pago final
            if acordado > 0 or multas > 0 or adelantos > 0:
                Pago.objects.create(
                    musico=musico,
                    planilla=planilla,
                    salario_base=acordado,
                    descuentos_totales=multas + total_extra,
                    adelantos_totales=adelantos,
                    neto_pagar=monto_final,
                    fecha_liquidacion=timezone.now(),
                    pagado_en=timezone.now(),
                    estado='PAGADO',
                    observaciones=f"Liquidación directa - {evento.titulo}",
                    origen=origen,
                    registrado_por=request.user
                )
                pagos_generados += 1

        return Response({
            'success': True, 
            'planilla_id': planilla.id, 
            'planilla_titulo': planilla.titulo,
            'pagos_generados': pagos_generados
        })

    @action(detail=False, methods=['get'])
    def estado_cuenta_musico(self, request):
        musico_id = request.query_params.get('musico_id')
        if not musico_id:
            return Response({'error': 'musico_id requerido'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            musico = Musico.objects.get(id=musico_id)
        except Musico.DoesNotExist:
            return Response({'error': 'Músico no encontrado'}, status=status.HTTP_404_NOT_FOUND)
            
        eventos_convocados = Evento.objects.filter(
            convocados=musico,
            fecha_hora_cita__lte=timezone.now()
        )
        eventos_liquidados_ids = Asistencia.objects.filter(
            musico=musico, 
            liquidado=True
        ).values_list('evento_id', flat=True)
        
        eventos_pendientes = eventos_convocados.exclude(id__in=eventos_liquidados_ids).order_by('fecha_hora_cita')
        
        descuentos_pendientes = Descuento.objects.filter(musico=musico, estado='APROBADA')
        adelantos_pendientes = Adelanto.objects.filter(musico=musico, estado='APROBADA')
        
        config = ConfiguracionSistema.objects.first()
        monto_base_defecto = config.monto_por_evento if config else Decimal('100.00')
        
        datos_eventos = []
        for e in eventos_pendientes:
            asist = Asistencia.objects.filter(musico=musico, evento=e).first()
            acordado = asist.monto_acordado if asist and asist.monto_acordado > 0 else monto_base_defecto
            
            # Verificar si el usuario actual puede pagar (Director, Subdirector, Presidente o Superuser)
            autorizado = False
            if request.user.is_superuser or request.user.rol in ['DIRECTOR', 'SUBDIRECTOR', 'PRESIDENTE']:
                autorizado = True
            
            datos_eventos.append({
                'id': e.id,
                'titulo': e.titulo,
                'fecha': e.fecha_hora_cita.strftime("%Y-%m-%d"),
                'monto_acordado': acordado,
                'multas_sugeridas': 0,
                'adelantos_sugeridos': 0,
                'autorizado_para_pagar': autorizado
            })
            
        return Response({
            'musico': {
                'id': musico.id,
                'nombre': musico.nombre_completo,
            },
            'eventos_pendientes': datos_eventos,
            'descuentos_globales': [{'id': d.id, 'motivo': d.motivo, 'monto': d.monto, 'fecha': d.fecha_falta} for d in descuentos_pendientes],
            'adelantos_globales': [{'id': a.id, 'motivo': a.motivo, 'monto': a.monto, 'fecha': a.fecha} for a in adelantos_pendientes]
        })

    @action(detail=False, methods=['post'])
    def liquidar_musico(self, request):
        if request.user.rol not in ['DIRECTOR', 'SUBDIRECTOR', 'PRESIDENTE'] and not request.user.is_superuser:
            return Response({'error': 'Sin permisos'}, status=status.HTTP_403_FORBIDDEN)
            
        musico_id = request.data.get('musico_id')
        eventos_data = request.data.get('eventos', []) 
        descuentos_ids = request.data.get('descuentos_ids', []) 
        adelantos_ids = request.data.get('adelantos_ids', [])
        
        if not musico_id or (not eventos_data and not descuentos_ids and not adelantos_ids):
            return Response({'error': 'Faltan datos'}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            musico = Musico.objects.get(id=musico_id)
        except Musico.DoesNotExist:
            return Response({'error': 'Músico no encontrado'}, status=status.HTTP_404_NOT_FOUND)
            
        # Validación estricta de permisos por evento antes de procesar
        eventos_a_procesar = []
        for e_data in eventos_data:
            try:
                evento = Evento.objects.get(id=e_data['evento_id'])
                if not request.user.is_superuser and request.user.rol not in ['DIRECTOR', 'SUBDIRECTOR', 'PRESIDENTE']:
                    return Response({'error': f'No tienes el rol necesario para liquidar {evento.titulo}'}, status=status.HTTP_403_FORBIDDEN)
                        
                eventos_a_procesar.append((evento, e_data))
            except Evento.DoesNotExist:
                pass
                
        titulo_planilla = f'Liquidación Individual - {musico.nombre_completo} - {timezone.now().strftime("%Y-%m-%d %H:%M")}'
        planilla = PlanillaLiquidacion.objects.create(
            titulo=titulo_planilla,
            observaciones='Generada desde Estado de Cuenta',
            completada=True
        )
        
        pagos_generados = 0
        for evento, e_data in eventos_a_procesar:
            planilla.eventos.add(evento)
            
            acordado = Decimal(str(e_data.get('acordado', 0) or 0))
            multas = Decimal(str(e_data.get('multas', 0) or 0))
            adelantos = Decimal(str(e_data.get('adelantos', 0) or 0))
            
            monto_final = acordado - multas - adelantos
            
            Asistencia.objects.update_or_create(
                musico=musico,
                evento=evento,
                defaults={
                    'monto_acordado': acordado,
                    'liquidado': True,
                    'estado': 'PRESENTE'
                }
            )
            
            if multas > 0:
                Descuento.objects.create(
                    musico=musico, monto=multas, motivo=f'Multa deducida en pago {evento.titulo}',
                    estado='LIQUIDADA'
                )
            if adelantos > 0:
                Adelanto.objects.create(
                    musico=musico, monto=adelantos, motivo=f'Adelanto deducido en pago {evento.titulo}',
                    fecha=timezone.now().date(), estado='LIQUIDADA'
                )
                
            origen = request.data.get('origen', 'FRONTEND')
            Pago.objects.create(
                musico=musico, planilla=planilla, salario_base=acordado,
                descuentos_totales=multas, adelantos_totales=adelantos,
                neto_pagar=monto_final, fecha_liquidacion=timezone.now(),
                estado='PAGADO', observaciones=f"Pago Individual",
                origen=origen, registrado_por=request.user
            )
            pagos_generados += 1
            
        if descuentos_ids:
            Descuento.objects.filter(id__in=descuentos_ids, musico=musico).update(estado='LIQUIDADA')
        if adelantos_ids:
            Adelanto.objects.filter(id__in=adelantos_ids, musico=musico).update(estado='LIQUIDADA')
            
        return Response({
            'success': True,
            'pagos_generados': pagos_generados,
            'planilla_id': planilla.id
        })

    @action(detail=False, methods=['post'])
    def liquidar_app(self, request):
        if request.user.rol not in ['DIRECTOR', 'SUBDIRECTOR', 'PRESIDENTE'] and not request.user.is_superuser:
            return Response({'error': 'Sin permisos'}, status=status.HTTP_403_FORBIDDEN)

        evento_id = request.data.get('evento_id')
        titulo = request.data.get('titulo', f'Liquidación App {date.today().strftime("%Y-%m-%d")}')
        observaciones = request.data.get('observaciones', '')
        musicos = request.data.get('musicos', [])

        if not evento_id:
            return Response({'error': 'Debe seleccionar un evento'}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(musicos, list) or not musicos:
            return Response({'error': 'La lista de músicos es obligatoria'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            evento = Evento.objects.get(id=evento_id)
        except Evento.DoesNotExist:
            return Response({'error': 'El evento no existe'}, status=status.HTTP_400_BAD_REQUEST)

        planilla = PlanillaLiquidacion.objects.create(
            titulo=titulo,
            observaciones=observaciones,
            completada=True
        )
        planilla.eventos.add(evento)

        pagos_generados = []
        for item in musicos:
            musico = None
            if item.get('musico_id'):
                musico = Musico.objects.filter(id=item['musico_id']).first()
            elif item.get('documento_identidad'):
                musico = Musico.objects.filter(documento_identidad=item['documento_identidad']).first()
            if not musico:
                continue

            monto_base = Decimal(str(item.get('monto_base', 0) or 0))
            descuentos = item.get('descuentos', [])
            adelantos = item.get('adelantos', [])

            total_descuentos = Decimal('0.00')
            for d in descuentos:
                monto_desc = Decimal(str(d.get('monto', 0) or 0))
                if monto_desc > 0:
                    total_descuentos += monto_desc
                    fecha_descuento = date.today()
                    if d.get('fecha'):
                        try:
                            fecha_descuento = date.fromisoformat(d.get('fecha'))
                        except Exception:
                            pass
                    Descuento.objects.create(
                        musico=musico,
                        monto=monto_desc,
                        motivo=d.get('motivo', f'Descuento app para {evento.titulo}'),
                        fecha=fecha_descuento,
                        origen='APP'
                    )

            total_adelantos = Decimal('0.00')
            for a in adelantos:
                monto_adel = Decimal(str(a.get('monto', 0) or 0))
                if monto_adel > 0:
                    total_adelantos += monto_adel
                    fecha_adelanto = date.today()
                    if a.get('fecha'):
                        try:
                            fecha_adelanto = date.fromisoformat(a.get('fecha'))
                        except Exception:
                            pass
                    Adelanto.objects.create(
                        musico=musico,
                        monto=monto_adel,
                        motivo=a.get('motivo', f'Adelanto app para {evento.titulo}'),
                        fecha=fecha_adelanto,
                        origen='APP'
                    )

            monto_final = monto_base - total_descuentos - total_adelantos

            pago = Pago.objects.create(
                musico=musico,
                planilla=planilla,
                salario_base=monto_base,
                descuentos_totales=total_descuentos,
                adelantos_totales=total_adelantos,
                neto_pagar=monto_final,
                fecha_liquidacion=timezone.now(),
                estado='PENDIENTE',
                observaciones=f'Liquidación desde app - {observaciones}',
                origen='APP_MOVIL',
                registrado_por=request.user
            )
            pagos_generados.append({
                'musico_id': musico.id,
                'musico_nombre': musico.nombre_completo,
                'pago_id': pago.id,
                'monto_final': monto_final,
            })

        return Response({
            'success': True,
            'planilla_id': planilla.id,
            'planilla_titulo': planilla.titulo,
            'pagos': pagos_generados,
            'total_pagos': sum(p['monto_final'] for p in pagos_generados)
        })

        """
        Consolida/paga la planilla de liquidación para una lista de eventos específicos.
        Crea la planilla, los pagos y marca todos los registros como liquidados.
        """
        if request.user.rol not in ['DIRECTOR', 'SUBDIRECTOR'] and not request.user.is_superuser:
            return Response({'error': 'Sin permisos'}, status=status.HTTP_403_FORBIDDEN)
            
        eventos_ids = request.data.get('eventos_ids', [])
        titulo = request.data.get('titulo', f'Planilla {date.today().strftime("%Y-%m-%d")}')
        observaciones = request.data.get('observaciones', '')
        
        if not eventos_ids:
            return Response({'error': 'Debe proporcionar al menos un ID de evento'}, status=status.HTTP_400_BAD_REQUEST)
            
        eventos = Evento.objects.filter(id__in=eventos_ids)
        if eventos.count() != len(eventos_ids):
            return Response({'error': 'Uno o más eventos no existen'}, status=status.HTTP_400_BAD_REQUEST)

        # Crear la planilla de liquidación
        planilla = PlanillaLiquidacion.objects.create(
            titulo=titulo,
            observaciones=observaciones,
            completada=True
        )
        
        # Agregar los eventos a la planilla
        planilla.eventos.add(*eventos_ids)

        # Obtener todas las asistencias no liquidadas para estos eventos
        asistencias = Asistencia.objects.filter(
            evento_id__in=eventos_ids,
            liquidado=False,
            estado__in=['PRESENTE', 'TARDANZA', 'JUSTIFICADO']
        ).select_related('musico', 'evento')

        # Agrupar por músico
        musicos_data = {}
        for asistencia in asistencias:
            musico_id = asistencia.musico.id
            if musico_id not in musicos_data:
                musicos_data[musico_id] = {
                    'musico': asistencia.musico,
                    'asistencias': [],
                    'monto_base': Decimal('0.00')
                }
            musicos_data[musico_id]['asistencias'].append(asistencia)
            musicos_data[musico_id]['monto_base'] += asistencia.monto_acordado

        pagos_generados = 0
        for musico_id, data in musicos_data.items():
            musico = data['musico']
            
            # Obtener descuentos y adelantos no liquidados del músico
            descuentos = Descuento.objects.filter(
                musico=musico, 
                estado='APROBADA'
            )
            adelantos = Adelanto.objects.filter(
                musico=musico, 
                estado='APROBADA'
            )

            total_descuentos = descuentos.aggregate(total=Sum('monto'))['total'] or Decimal('0.00')
            total_adelantos = adelantos.aggregate(total=Sum('monto'))['total'] or Decimal('0.00')
            
            monto_final = data['monto_base'] - total_descuentos - total_adelantos

            # Solo crear pago si hay algo que pagar (positivo o negativo)
            if data['monto_base'] > 0 or total_descuentos > 0 or total_adelantos > 0:
                pago = Pago.objects.create(
                    musico=musico,
                    planilla=planilla,
                    salario_base=data['monto_base'],
                    descuentos_totales=total_descuentos,
                    adelantos_totales=total_adelantos,
                    neto_pagar=monto_final,
                    fecha_liquidacion=timezone.now(),
                    estado='PENDIENTE',
                    observaciones=f"Liquidación automática - {titulo}",
                    origen='APP_MOVIL',
                    registrado_por=request.user
                )
                
                # Marcar descuentos y adelantos como liquidados
                descuentos.update(estado='LIQUIDADA')
                adelantos.update(estado='LIQUIDADA')
                
                pagos_generados += 1

        return Response({
            'success': True, 
            'planilla_id': planilla.id, 
            'planilla_titulo': planilla.titulo,
            'pagos_generados': pagos_generados,
            'eventos_procesados': len(eventos_ids),
            'fecha_creacion': planilla.fecha_creacion
        })

    @action(detail=True, methods=['get'])
    def generar_pdf(self, request, pk=None):
        """
        Genera un PDF detallado de la planilla de liquidación.
        """
        if request.user.rol not in ['DIRECTOR', 'SUBDIRECTOR'] and not request.user.is_superuser:
            return Response({'error': 'Sin permisos'}, status=status.HTTP_403_FORBIDDEN)
            
        planilla = self.get_object()
        
        try:
            from reportlab.lib.pagesizes import letter, landscape
            from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
            from reportlab.lib import colors
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
            from reportlab.lib.units import inch
        except ImportError:
            return Response({'error': 'reportlab no está instalado'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        import io
        from django.http import HttpResponse
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=landscape(letter),
                                rightMargin=30, leftMargin=30, topMargin=50, bottomMargin=70)
        elements = []
        
        styles = getSampleStyleSheet()
        
        # Estilos personalizados
        title_style = ParagraphStyle(
            'CustomTitle', parent=styles['Normal'], fontName='Helvetica-Bold',
            fontSize=16, textColor=colors.black, alignment=TA_CENTER,
            spaceAfter=10
        )
        subtitle_style = ParagraphStyle(
            'Subtitle', parent=styles['Normal'], fontName='Helvetica-Bold',
            fontSize=12, textColor=colors.black, alignment=TA_CENTER,
            spaceAfter=20
        )
        normal_style = ParagraphStyle('NormalStyle', parent=styles['Normal'], fontSize=9)
        header_style = ParagraphStyle('HeaderStyle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10)
        
        # Encabezado
        elements.append(Paragraph("BANDA DE MUSICA INTERNACIONAL ESPECTACULAR MEJILLONES BOLIVIA<br/>Eco De Los Andes", title_style))
        elements.append(Paragraph(f"PLANILLA DE LIQUIDACIÓN - {planilla.titulo.upper()}", subtitle_style))
        
        if planilla.observaciones:
            elements.append(Paragraph(f"<b>Observaciones:</b> {planilla.observaciones}", normal_style))
        
        elements.append(Paragraph(f"<b>Fecha de Creación:</b> {planilla.fecha_creacion.strftime('%d/%m/%Y %H:%M')}", normal_style))
        elements.append(Spacer(1, 20))
        
        # Tabla de eventos
        if planilla.eventos.exists():
            elements.append(Paragraph("<b>EVENTOS INCLUIDOS:</b>", header_style))
            eventos_data = [['N°', 'Evento', 'Fecha']]
            for i, evento in enumerate(planilla.eventos.all(), 1):
                eventos_data.append([
                    str(i),
                    evento.titulo,
                    evento.fecha_hora_cita.strftime('%d/%m/%Y')
                ])
            
            eventos_table = Table(eventos_data)
            eventos_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#D9E1F2')),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ]))
            elements.append(eventos_table)
            elements.append(Spacer(1, 20))
        
        # Tabla de pagos
        if planilla.pagos.exists():
            elements.append(Paragraph("<b>DETALLE DE PAGOS:</b>", header_style))
            pagos_data = [
                ['N°', 'Músico', 'Monto Base', 'Descuentos', 'Adelantos', 'Monto Final', 'Estado']
            ]
            
            for i, pago in enumerate(planilla.pagos.all(), 1):
                pagos_data.append([
                    str(i),
                    pago.musico.nombre_completo,
                    f"${pago.salario_base:.2f}",
                    f"${pago.descuentos_totales:.2f}",
                    f"${pago.adelantos_totales:.2f}",
                    f"${pago.neto_pagar:.2f}",
                    'PAGADO' if pago.estado == 'PAGADO' else 'PENDIENTE'
                ])
            
            # Fila de totales
            total_base = sum(p.salario_base for p in planilla.pagos.all())
            total_descuentos = sum(p.descuentos_totales for p in planilla.pagos.all())
            total_adelantos = sum(p.adelantos_totales for p in planilla.pagos.all())
            total_final = sum(p.neto_pagar for p in planilla.pagos.all())
            
            pagos_data.append([
                '',
                '<b>TOTALES:</b>',
                f"<b>${total_base:.2f}</b>",
                f"<b>${total_descuentos:.2f}</b>",
                f"<b>${total_adelantos:.2f}</b>",
                f"<b>${total_final:.2f}</b>",
                ''
            ])
            
            pagos_table = Table(pagos_data, colWidths=[0.5*inch, 2.5*inch, 1*inch, 1*inch, 1*inch, 1*inch, 0.8*inch])
            pagos_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#D9E1F2')),
                ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#FFFF99')),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                ('BACKGROUND', (0, 1), (-1, -2), colors.white),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ]))
            elements.append(pagos_table)
        
        # Función para pie de página
        def footer(canvas, doc):
            canvas.saveState()
            canvas.setFont('Helvetica', 8)
            canvas.drawRightString(doc.pagesize[0] - 30, 20, f"Página {doc.page}")
            canvas.drawString(30, 20, f"Generado por: {request.user.get_full_name() or request.user.username}")
            canvas.restoreState()
        
        doc.build(elements, onFirstPage=footer, onLaterPages=footer)
        
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="Planilla_{planilla.titulo.replace(" ", "_")}.pdf"'
        return response

    @action(detail=False, methods=['get'])
    def reporte_general(self, request):
        """
        Genera un PDF con el reporte general de finanzas.
        """
        if request.user.rol not in ['DIRECTOR', 'SUBDIRECTOR'] and not request.user.is_superuser:
            return Response({'error': 'Sin permisos'}, status=status.HTTP_403_FORBIDDEN)
            
        try:
            from reportlab.lib.pagesizes import letter, landscape
            from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
            from reportlab.lib import colors
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib.enums import TA_CENTER
        except ImportError:
            return Response({'error': 'reportlab no está instalado'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        import io
        from django.http import HttpResponse
        from datetime import datetime
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=landscape(letter),
                                rightMargin=30, leftMargin=30, topMargin=50, bottomMargin=70)
        elements = []
        
        styles = getSampleStyleSheet()
        
        title_style = ParagraphStyle(
            'CustomTitle', parent=styles['Normal'], fontName='Helvetica-Bold',
            fontSize=16, textColor=colors.black, alignment=TA_CENTER,
            spaceAfter=10
        )
        normal_style = ParagraphStyle('NormalStyle', parent=styles['Normal'], fontSize=9)
        
        # Encabezado
        elements.append(Paragraph("BANDA DE MUSICA INTERNACIONAL ESPECTACULAR MEJILLONES BOLIVIA<br/>Eco De Los Andes", title_style))
        elements.append(Paragraph(f"REPORTE GENERAL DE FINANZAS<br/>{datetime.now().strftime('%d/%m/%Y')}", title_style))
        elements.append(Spacer(1, 20))
        
        # Resumen general
        resumen_data = [
            ['Métrica', 'Total'],
            ['Músicos Activos', str(Musico.objects.filter(activo=True).count())],
            ['Total Eventos', str(Evento.objects.count())],
            ['Total Asistencias', str(Asistencia.objects.count())],
            ['Total Pagos', str(Pago.objects.count())],
            ['Planillas Creadas', str(PlanillaLiquidacion.objects.count())],
        ]
        
        resumen_table = Table(resumen_data)
        resumen_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#D9E1F2')),
            ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
        ]))
        elements.append(resumen_table)
        elements.append(Spacer(1, 20))
        
        # Pagos pendientes (solo referencia informativa)
        pagos_pendientes = Pago.objects.filter(estado='PENDIENTE')
        if pagos_pendientes.exists():
            elements.append(Paragraph("<b>PAGOS PENDIENTES:</b>", normal_style))
            pendientes_data = [['Músico', 'Monto', 'Fecha']]
            for pago in pagos_pendientes:
                pendientes_data.append([
                    pago.musico.nombre_completo,
                    f"${pago.neto_pagar:.2f}",
                    pago.fecha_liquidacion.strftime('%d/%m/%Y')
                ])
            
            pendientes_table = Table(pendientes_data)
            pendientes_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#FFB6C1')),
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
                ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.black),
            ]))
            elements.append(pendientes_table)
        
        # Pie de página
        def footer(canvas, doc):
            canvas.saveState()
            canvas.setFont('Helvetica', 8)
            canvas.drawRightString(doc.pagesize[0] - 30, 20, f"Página {doc.page}")
            canvas.drawString(30, 20, f"Generado por: {request.user.get_full_name() or request.user.username}")
            canvas.restoreState()
        
        doc.build(elements, onFirstPage=footer, onLaterPages=footer)
        
        response = HttpResponse(buffer.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = 'attachment; filename="Reporte_General_Finanzas.pdf"'
        return response


class DeudaViewSet(viewsets.ModelViewSet):
    queryset = Deuda.objects.all().order_by('-fecha_creacion')
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Deuda.objects.all().order_by('-fecha_creacion')
        musico_id = self.request.query_params.get('musico_id')
        seccion = self.request.query_params.get('seccion')

        if musico_id:
            queryset = queryset.filter(musico_id=musico_id)
        if seccion:
            queryset = queryset.filter(musico__instrumento__iexact=seccion)

        return queryset

    def get_serializer_class(self):
        from ..serializers import DeudaSerializer
        return DeudaSerializer

    @action(detail=False, methods=['post'])
    def crear_masivo(self, request):
        if request.user.rol not in ['DIRECTOR', 'SUBDIRECTOR', 'PRESIDENTE'] and not request.user.is_superuser:
            return Response({'error': 'No tienes permisos para crear deudas masivas.'}, status=status.HTTP_403_FORBIDDEN)
            
        motivo = request.data.get('motivo')
        monto_total = request.data.get('monto_total')
        musicos_ids = request.data.get('musicos_ids', [])
        
        if not motivo or not monto_total or not musicos_ids:
            return Response({'error': 'Faltan datos requeridos'}, status=status.HTTP_400_BAD_REQUEST)
            
        creadas = 0
        for m_id in musicos_ids:
            try:
                musico = Musico.objects.get(id=m_id)
                Deuda.objects.create(
                    musico=musico,
                    motivo=motivo,
                    monto_total=monto_total
                )
                creadas += 1
            except Musico.DoesNotExist:
                pass
                
        return Response({'success': True, 'creadas': creadas})


class AbonoDeudaViewSet(viewsets.ModelViewSet):
    queryset = AbonoDeuda.objects.all().order_by('-fecha')
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        from ..serializers import AbonoDeudaSerializer
        return AbonoDeudaSerializer
