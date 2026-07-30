from django.db import transaction
from django.db.models import Count, Q
from .models import CampanaCanaston, ResultadoCanaston, Musico, Asistencia, Descuento, Evento
from services.rendimiento_calculator import RendimientoCalculator
from django.utils import timezone
from datetime import date


def calcular_elegibilidad_canaston(campana_id):
    """
    Calcula la elegibilidad de todos los músicos para una campaña de canastón.
    Crea o actualiza los registros de ResultadoCanaston.

    Requisitos de elegibilidad:
    - Asistencia >= 50% en el período de la campaña
    - Score de lealtad calculado en el rango de fechas
    """
    try:
        campana = CampanaCanaston.objects.get(id=campana_id)

        if campana.estado == 'CERRADO':
            return {
                'success': False,
                'error': 'La campaña está cerrada y no se puede recalcular'
            }

        calculator = RendimientoCalculator()
        musicos_activos = Musico.objects.filter(activo=True)

        fecha_inicio = campana.fecha_inicio_calculo
        fecha_fin = campana.fecha_fin_calculo

        # Calcular total de eventos en el rango UNA SOLA VEZ (evita N+1)
        eventos_en_rango = Evento.objects.filter(
            fecha_hora_cita__date__gte=fecha_inicio,
            fecha_hora_cita__date__lte=fecha_fin
        ).count()

        # Pre-calcular asistencias válidas de TODOS los músicos en batch (evita N+1)
        asistencias_por_musico = dict(
            Asistencia.objects.filter(
                evento__fecha_hora_cita__date__gte=fecha_inicio,
                evento__fecha_hora_cita__date__lte=fecha_fin,
                estado__in=['PRESENTE', 'TARDANZA', 'JUSTIFICADO']
            ).values('musico_id').annotate(
                total=Count('id')
            ).values_list('musico_id', 'total')
        )

        resultados_creados = 0
        resultados_actualizados = 0

        with transaction.atomic():
            for musico in musicos_activos:
                # Calcular rendimiento en el rango de la campaña
                rendimiento = calculator.calcular_rendimiento_musico(
                    musico,
                    fecha_corte=campana.fecha_fin_calculo
                )

                # Obtener asistencias pre-calculadas
                asistencias_validas = asistencias_por_musico.get(musico.id, 0)

                # Calcular porcentaje de asistencia en el período
                porcentaje_asistencia = 0
                if eventos_en_rango > 0:
                    porcentaje_asistencia = (asistencias_validas / eventos_en_rango) * 100

                # Elegibilidad: asistencia >= 50%
                es_elegible = porcentaje_asistencia >= 50

                # Crear o actualizar resultado
                resultado, created = ResultadoCanaston.objects.update_or_create(
                    campana=campana,
                    musico=musico,
                    defaults={
                        'score_lealtad_snapshot': rendimiento['score_lealtad'],
                        'porcentaje_asistencia_snapshot': porcentaje_asistencia,
                        'es_elegible': es_elegible,
                        'estado_entrega': 'PENDIENTE' if es_elegible else 'NO_ELEGIBLE'
                    }
                )

                if created:
                    resultados_creados += 1
                else:
                    resultados_actualizados += 1

        return {
            'success': True,
            'campana_id': campana_id,
            'resultados_creados': resultados_creados,
            'resultados_actualizados': resultados_actualizados,
            'total_musicos': musicos_activos.count()
        }

    except CampanaCanaston.DoesNotExist:
        return {
            'success': False,
            'error': f'Campaña con ID {campana_id} no encontrada'
        }
    except Exception as e:
        return {
            'success': False,
            'error': f'Error al calcular elegibilidad: {str(e)}'
        }
