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

class DashboardView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        
        # Módulo Dashboard Rediseñado por Roles
        if user.rol in ['PRESIDENTE', 'DIRECTOR', 'SUBDIRECTOR']:
            # Métricas base compartidas
            total_musicos = Musico.objects.filter(activo=True).count()
            total_eventos = Evento.objects.count()
            eventos_mes = Evento.objects.filter(
                fecha_hora_cita__month=date.today().month,
                fecha_hora_cita__year=date.today().year
            ).count()
            
            # Obtener el acumulado de descuentos por sección
            descuentos_por_seccion_raw = Descuento.objects.filter(
                estado='APROBADA'
            ).values('musico__instrumento').annotate(
                total=Sum('monto')
            ).order_by('-total')[:7]

            instrumentos_map = dict(Musico.INSTRUMENTOS)
            descuentos_por_seccion = []
            for item in descuentos_por_seccion_raw:
                if item['musico__instrumento']:
                    descuentos_por_seccion.append({
                        'seccion': instrumentos_map.get(item['musico__instrumento'], 'Otra'),
                        'total': item['total'] or 0
                    })

            if user.rol == 'PRESIDENTE':
                # 1. Presidente: Balance General y Financiamientos
                total_liquidaciones = Pago.objects.filter(estado='PAGADO').aggregate(total=Sum('neto_pagar'))['total'] or 0
                financiamientos = Deuda.objects.aggregate(
                    total_financiado=Sum('monto_total'),
                    total_recuperado=Sum('monto_pagado')
                )
                total_musicos_ano_pasado = Musico.objects.filter(created_at__year__lt=date.today().year).count() # Aproximación de crecimiento
                if total_musicos_ano_pasado == 0: total_musicos_ano_pasado = int(total_musicos * 0.9) # Mock si no hay data antigua
                
                # Datos para gráfico de eventos por mes
                import calendar
                eventos_por_mes = []
                for mes in range(1, 13):
                    count = Evento.objects.filter(fecha_hora_cita__year=date.today().year, fecha_hora_cita__month=mes).count()
                    eventos_por_mes.append({"name": calendar.month_abbr[mes], "eventos": count})

                return Response({
                    'rol': user.rol,
                    'usuario_nombre': user.first_name,
                    'total_musicos': total_musicos,
                    'crecimiento': {'actual': total_musicos, 'ano_pasado': total_musicos_ano_pasado},
                    'balance_general': {'total_liquidado': total_liquidaciones},
                    'financiamientos': financiamientos,
                    'total_eventos': total_eventos,
                    'eventos_mes': eventos_mes,
                    'eventos_por_mes': eventos_por_mes,
                    'descuentos_seccion': descuentos_por_seccion,
                })

            elif user.rol == 'DIRECTOR':
                # 2. Director: Operaciones, Próximos eventos, Distribución de Secciones
                proximos_eventos = Evento.objects.filter(fecha_hora_cita__gte=timezone.now()).order_by('fecha_hora_cita')[:5]
                secciones_stats = list(Musico.objects.filter(activo=True).values('instrumento').annotate(count=Count('id')))
                adelantos_pendientes = Adelanto.objects.filter(estado='APROBADA').count() # Simula pendientes de firma

                return Response({
                    'rol': user.rol,
                    'usuario_nombre': user.first_name,
                    'total_musicos': total_musicos,
                    'proximos_eventos': EventoSerializer(proximos_eventos, many=True).data,
                    'secciones_stats': secciones_stats,
                    'adelantos_pendientes': adelantos_pendientes,
                    'descuentos_seccion': descuentos_por_seccion,
                })

            elif user.rol == 'SUBDIRECTOR':
                # 3. Subdirector: Administración, Descuentos, Adelantos, Canastón
                hoy = timezone.localdate()
                inicio_semana = hoy - timezone.timedelta(days=hoy.weekday())
                
                descuentos_semana = Descuento.objects.filter(fecha_falta__gte=inicio_semana).aggregate(total=Sum('monto'))['total'] or 0
                adelantos_semana = Adelanto.objects.filter(fecha__gte=inicio_semana).aggregate(total=Sum('monto'))['total'] or 0
                
                campana = CampanaCanaston.objects.filter(estado='ABIERTO').first()
                canaston_info = {'titulo': campana.titulo, 'fecha_entrega': campana.fecha_entrega} if campana else None
                
                ultimos_desc = Descuento.objects.order_by('-creado_en')[:5]
                ultimos_adel = Adelanto.objects.order_by('-creado_en')[:5]

                return Response({
                    'rol': user.rol,
                    'usuario_nombre': user.first_name,
                    'total_musicos': total_musicos,
                    'descuentos_semana': descuentos_semana,
                    'adelantos_semana': adelantos_semana,
                    'canaston': canaston_info,
                    'ultimos_descuentos': DescuentoSerializer(ultimos_desc, many=True).data,
                    'ultimos_adelantos': AdelantoSerializer(ultimos_adel, many=True).data,
                })
        elif user.rol == 'JEFE_SECCION':
            # Para jefe de sección, mostrar información de su sección
            instrumentos = user.get_instrumentos_encargados()
            if not instrumentos:
                return Response({'error': 'No tiene sección asignada'}, status=status.HTTP_400_BAD_REQUEST)
            
            musicos_seccion = Musico.objects.filter(instrumento__in=instrumentos, activo=True)
            total_musicos = musicos_seccion.count()
            eventos_mes = Evento.objects.filter(
                fecha_hora_cita__month=date.today().month,
                fecha_hora_cita__year=date.today().year
            ).count()
            
            calculator = RendimientoCalculator()
            top_musicos_raw = calculator.obtener_top_musicos(limite=5, queryset=musicos_seccion, recalcular=False)
            
            # Serializar top musicos
            top_musicos = []
            for item in top_musicos_raw:
                item_dict = dict(item)
                item_dict['musico'] = MusicoListSerializer(item['musico']).data
                item_dict.pop('rendimiento', None)
                top_musicos.append(item_dict)
                
            eventos_recientes = Evento.objects.order_by('-fecha_hora_cita')[:5]
            evento_hoy = Evento.objects.filter(fecha_hora_cita__date=date.today()).first()
            
            return Response({
                'rol': user.rol,
                'usuario_nombre': user.first_name,
                'seccion': ", ".join(instrumentos) if instrumentos else "",
                'total_musicos': total_musicos,
                'total_eventos': eventos_mes,
                'top_musicos': top_musicos,
                'eventos_recientes': EventoSerializer(eventos_recientes, many=True).data,
                'evento_hoy': EventoSerializer(evento_hoy).data if evento_hoy else None,
            })
        elif user.rol == 'MUSICO':
            if hasattr(request.user, 'perfil_musico'):
                musico = request.user.perfil_musico
                proximos_eventos = Evento.objects.filter(
                    fecha_hora_cita__gte=timezone.now()
                ).order_by('fecha_hora_cita')[:5]
                asistencias = Asistencia.objects.filter(musico=musico).order_by('-evento__fecha_hora_cita')[:5]
                pagos = Pago.objects.filter(musico=musico).order_by('-fecha_liquidacion')[:5]
                
                return Response({
                    'rol': user.rol,
                    'proximos_eventos': EventoSerializer(proximos_eventos, many=True).data,
                    'asistencias': AsistenciaSerializer(asistencias, many=True).data,
                    'pagos': PagoSerializer(pagos, many=True).data,
                })
            else:
                return Response({'error': 'No tienes perfil de músico asignado. Contacta al director.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({'error': 'Rol no reconocido'}, status=status.HTTP_400_BAD_REQUEST)


class RankingView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        limite = int(request.query_params.get('limite', 10))
        calculator = RendimientoCalculator()
        ranking = calculator.generar_ranking_completo(recalcular=False)
        
        # Serializar top musicos
        top_musicos = []
        for item in ranking['top_musicos'][:limite]:
            item_dict = dict(item)
            item_dict['musico'] = MusicoListSerializer(item['musico']).data
            item_dict.pop('rendimiento', None)
            top_musicos.append(item_dict)
        
        return Response({
            'top_musicos': top_musicos,
            'estadisticas': ranking['estadisticas'],
            'fecha_corte': ranking['fecha_corte']
        })


class ResumenAnualCanastonView(views.APIView):
    """
    Proporciona un resumen anual del rendimiento de los músicos para el canastón,
    independiente de una campaña específica.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        try:
            current_year = timezone.now().year
            fecha_inicio_ano = date(current_year, 1, 1)
            fecha_fin_ano = date(current_year, 12, 31)

            # Optimización: Obtener todos los músicos activos y serializarlos de una vez.
            musicos_activos = Musico.objects.filter(activo=True)
            musicos_map = {musico.id: musico for musico in musicos_activos}
            musicos_serializer_map = {
                musico.id: data 
                for musico, data in zip(musicos_activos, MusicoListSerializer(musicos_activos, many=True).data)
            }

            rendimiento_calculator = RendimientoCalculator()

            # Calcular rendimiento para todos los músicos
            rendimiento_musicos = []
            for musico in musicos_activos:
                rendimiento = rendimiento_calculator.calcular_rendimiento_musico(
                    musico, fecha_inicio=fecha_inicio_ano, fecha_corte=fecha_fin_ano
                )
                rendimiento_musicos.append({
                    'musico_id': musico.id,
                    'nombre_completo': musico.nombre_completo,
                    'seccion': musico.get_instrumento_display(),
                    'score_lealtad': rendimiento['score_lealtad'],
                    'porcentaje_asistencia': rendimiento['asistencia']['porcentaje'],
                })

            # Agrupar por sección
            resultados_por_seccion = {}
            for r in rendimiento_musicos:
                seccion_nombre = r['seccion']
                if seccion_nombre not in resultados_por_seccion:
                    resultados_por_seccion[seccion_nombre] = []
                
                musico_id = r['musico_id']
                
                # Crear un objeto musico simplificado para la respuesta
                musico_data = {
                    'id': musico_id,
                    'nombre_completo': r['nombre_completo'],
                    'score_lealtad_snapshot': r['score_lealtad'],
                    'porcentaje_asistencia_snapshot': r['porcentaje_asistencia'],
                    'es_elegible': r['porcentaje_asistencia'] >= 50,
                    # Usar el músico serializado del mapa
                    'musico': musicos_serializer_map.get(musico_id)
                }
                
                resultados_por_seccion[seccion_nombre].append(musico_data)
            
            # Ordenar músicos dentro de cada sección por porcentaje de asistencia
            for seccion in resultados_por_seccion:
                resultados_por_seccion[seccion].sort(key=lambda x: x['porcentaje_asistencia_snapshot'], reverse=True)

            # Transformar el dict a una lista de objetos
            lista_resultados_seccion = [
                {'seccion': seccion, 'musicos': musicos}
                for seccion, musicos in resultados_por_seccion.items()
            ]
            # Ordenar secciones por nombre
            lista_resultados_seccion.sort(key=lambda x: x['seccion'])

            # Calcular resumen de descuentos por sección para el año
            resumen_descuentos = Descuento.objects.filter(
                fecha__year=current_year,
                musico__in=musicos_activos
            ).values('musico__instrumento').annotate(
                total_descuentos=Sum('monto')
            ).order_by('musico__instrumento')

            # Mapear a nombres de sección
            resumen_descuentos_final = []
            instrumentos_map = dict(Musico.INSTRUMENTOS)
            for item in resumen_descuentos:
                seccion_key = item.get('musico__instrumento')
                if seccion_key:
                    resumen_descuentos_final.append({
                        'seccion': instrumentos_map.get(seccion_key, 'Desconocida'),
                        'total_descuentos': item['total_descuentos'] or 0
                    })

            return Response({
                'titulo': f"Resumen Anual de Rendimiento {current_year}",
                'fecha_inicio_calculo': fecha_inicio_ano,
                'fecha_fin_calculo': fecha_fin_ano,
                'resultados_por_seccion': lista_resultados_seccion,
                'resumen_descuentos': resumen_descuentos_final,
            })
        except Exception as e:
            # Log the error for debugging
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error en ResumenAnualCanastonView: {e}", exc_info=True)
            # Return a user-friendly error message
            return Response(
                {"error": "No se pudo generar el resumen anual. Por favor, intente más tarde."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
