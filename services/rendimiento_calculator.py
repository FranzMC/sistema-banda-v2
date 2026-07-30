from datetime import datetime, date
from decimal import Decimal
from typing import Dict, List
from django.db.models import Avg, Count, Q, Sum
from gestion_banda.models import Musico, Asistencia, Evento, Descuento, RendimientoMusico
import logging

logger = logging.getLogger(__name__)

class RendimientoCalculator:
    """Servicio para calcular el rendimiento de los músicos y el sistema del canastón"""
    
    def __init__(self):
        self.pesos = {
            'asistencia': 0.4,
            'puntualidad': 0.3,
            'antiguedad': 0.2,
            'descuentos': 0.1
        }
    
    def calcular_rendimiento_musico(self, musico: Musico, fecha_corte: date = None) -> Dict:
        """Calcula el rendimiento completo de un músico"""
        if fecha_corte is None:
            fecha_corte = date.today()
        
        # Obtener datos base
        # Si no se registra la fecha de ingreso, usamos la fecha de creación
        fecha_ingreso = musico.created_at.date() if musico.created_at else date.today()
        antiguedad_meses = self._calcular_antiguedad_meses(fecha_ingreso, fecha_corte)
        
        # Calcular asistencia
        stats_asistencia = self._calcular_estadisticas_asistencia(musico, fecha_corte)
        
        # Calcular puntualidad
        stats_puntualidad = self._calcular_estadisticas_puntualidad(musico, fecha_corte)
        
        # Calcular descuentos
        stats_descuentos = self._calcular_estadisticos_descuentos(musico, fecha_corte)
        
        # Calcular score de lealtad
        score_lealtad = self._calcular_score_lealtad(
            stats_asistencia['porcentaje'],
            stats_puntualidad['promedio_minutos'],
            antiguedad_meses,
            stats_descuentos['total']
        )
        
        # Actualizar o crear registro de rendimiento
        rendimiento, created = RendimientoMusico.objects.update_or_create(
            musico=musico,
            defaults={
                'score_lealtad': score_lealtad,
                'porcentaje_asistencia': stats_asistencia['porcentaje'],
                'puntualidad_promedio': stats_puntualidad['promedio_minutos'],
                'antiguedad_meses': antiguedad_meses,
                'total_descuentos': stats_descuentos['total']
            }
        )
        
        return {
            'musico': musico,
            'score_lealtad': score_lealtad,
            'asistencia': stats_asistencia,
            'puntualidad': stats_puntualidad,
            'antiguedad_meses': antiguedad_meses,
            'descuentos': stats_descuentos,
            'rendimiento': rendimiento
        }
    
    def _calcular_antiguedad_meses(self, fecha_ingreso: date, fecha_corte: date) -> int:
        """Calcula la antigüedad en meses"""
        meses = (fecha_corte.year - fecha_ingreso.year) * 12 + (fecha_corte.month - fecha_ingreso.month)
        if fecha_corte.day < fecha_ingreso.day:
            meses -= 1
        return max(0, meses)
    
    def _calcular_estadisticas_asistencia(self, musico: Musico, fecha_corte: date) -> Dict:
        """Calcula estadísticas de asistencia"""
        # Usar fecha de creación o hoy si no está definida
        fecha_ingreso = musico.created_at.date() if musico.created_at else date.today()
        
        # Total de eventos desde el ingreso del músico
        eventos_totales = Evento.objects.filter(
            fecha_hora_cita__gte=fecha_ingreso,
            fecha_hora_cita__date__lte=fecha_corte
        ).count()
        
        if eventos_totales == 0:
            return {
                'porcentaje': Decimal('0.00'),
                'presentes': 0,
                'tardanzas': 0,
                'ausentes': 0,
                'justificados': 0,
                'total_eventos': 0
            }
        
        # Asistencias del músico
        asistencias = Asistencia.objects.filter(
            musico=musico,
            evento__fecha_hora_cita__gte=fecha_ingreso,
            evento__fecha_hora_cita__date__lte=fecha_corte
        )
        
        presentes = asistencias.filter(estado='PRESENTE').count()
        tardanzas = asistencias.filter(estado='TARDANZA').count()
        ausentes = asistencias.filter(estado='AUSENTE').count()
        justificados = asistencias.filter(estado='JUSTIFICADO').count()
        
        # Calcular porcentaje (contando presentes, tardanzas y justificados como asistencia)
        asistencias_validas = presentes + tardanzas + justificados
        porcentaje = Decimal((asistencias_validas / eventos_totales) * 100)
        
        return {
            'porcentaje': porcentaje.quantize(Decimal('0.01')),
            'presentes': presentes,
            'tardanzas': tardanzas,
            'ausentes': ausentes,
            'justificados': justificados,
            'total_eventos': eventos_totales
        }
    
    def _calcular_estadisticas_puntualidad(self, musico: Musico, fecha_corte: date) -> Dict:
        """Calcula estadísticas de puntualidad"""
        fecha_ingreso = musico.created_at.date() if musico.created_at else date.today()
        
        asistencias_con_hora = Asistencia.objects.filter(
            musico=musico,
            hora_llegada__isnull=False,
            evento__fecha_hora_cita__gte=fecha_ingreso,
            evento__fecha_hora_cita__date__lte=fecha_corte
        )
        
        if not asistencias_con_hora.exists():
            return {
                'promedio_minutos': Decimal('0.00'),
                'maxima_tardanza': 0,
                'total_registros': 0
            }
        
        total_minutos_tardanza = 0
        maxima_tardanza = 0
        
        for asistencia in asistencias_con_hora:
            minutos = asistencia.minutos_tardanza
            total_minutos_tardanza += minutos
            maxima_tardanza = max(maxima_tardanza, minutos)
        
        promedio = total_minutos_tardanza / asistencias_con_hora.count()
        
        return {
            'promedio_minutos': Decimal(str(promedio)).quantize(Decimal('0.01')),
            'maxima_tardanza': maxima_tardanza,
            'total_registros': asistencias_con_hora.count()
        }
    
    def _calcular_estadisticos_descuentos(self, musico: Musico, fecha_corte: date) -> Dict:
        """Calcula estadísticas de descuentos"""
        fecha_ingreso = musico.created_at.date() if musico.created_at else date.today()
        
        descuentos = Descuento.objects.filter(
            musico=musico,
            fecha_falta__gte=fecha_ingreso,
            fecha_falta__lte=fecha_corte
        )
        
        total = descuentos.aggregate(total=Sum('monto'))['total'] or Decimal('0.00')
        cantidad = descuentos.count()
        
        return {
            'total': total.quantize(Decimal('0.01')),
            'cantidad': cantidad,
            'promedio': (total / cantidad).quantize(Decimal('0.01')) if cantidad > 0 else Decimal('0.00')
        }
    
    def _calcular_score_lealtad(self, porcentaje_asistencia: Decimal, 
                               puntualidad_promedio: Decimal, antiguedad_meses: int, 
                               total_descuentos: Decimal) -> int:
        """Calcula el score de lealtad (0-100)"""
        
        # Score de asistencia (0-40 puntos)
        score_asistencia = min(float(porcentaje_asistencia) * self.pesos['asistencia'], 40)
        
        # Score de puntualidad (0-30 puntos)
        # Menos de 5 minutos de tardanza promedio = máximo puntaje
        if puntualidad_promedio <= 5:
            score_puntualidad = 30
        else:
            # Reducción lineal hasta 30 minutos de tardanza
            score_puntualidad = max(30 - (float(puntualidad_promedio) - 5) * 1.2, 0)
        
        # Score de antigüedad (0-20 puntos)
        # Máximo a los 40 meses (3+ años)
        score_antiguedad = min(antiguedad_meses * 0.5, 20)
        
        # Score de descuentos (0-10 puntos)
        # Sin descuentos = máximo puntaje
        if total_descuentos == 0:
            score_descuentos = 10
        else:
            # Reducción lineal, cada 10Bs de descuento reduce 1 punto
            score_descuentos = max(10 - float(total_descuentos) * 0.1, 0)
        
        score_total = score_asistencia + score_puntualidad + score_antiguedad + score_descuentos
        
        return int(round(score_total))
    
    def obtener_top_musicos(self, limite: int = 10, fecha_corte: date = None, queryset=None, recalcular: bool = True) -> List[Dict]:
        """Obtiene el top de músicos para el canastón"""
        if fecha_corte is None:
            fecha_corte = date.today()
            
        if not recalcular:
            base_query = RendimientoMusico.objects.select_related('musico')
            if queryset is not None:
                base_query = base_query.filter(musico__in=queryset)
            
            top_rendimientos = base_query.order_by('-score_lealtad')[:limite]
            resultados = []
            for r in top_rendimientos:
                resultados.append({
                    'musico': r.musico,
                    'score_lealtad': r.score_lealtad,
                    'asistencia': {'porcentaje': r.porcentaje_asistencia},
                    'puntualidad': {'promedio_minutos': r.puntualidad_promedio},
                    'antiguedad_meses': r.antiguedad_meses,
                    'descuentos': {'total': r.total_descuentos},
                    'rendimiento': r
                })
            return resultados
        
        # Calcular rendimiento para los músicos activos (o los del queryset)
        musicos_activos = queryset if queryset is not None else Musico.objects.filter(activo=True)
        resultados = []
        
        for musico in musicos_activos:
            rendimiento = self.calcular_rendimiento_musico(musico, fecha_corte)
            resultados.append(rendimiento)
        
        # Ordenar por score de lealtad
        resultados.sort(key=lambda x: x['score_lealtad'], reverse=True)
        
        return resultados[:limite]
    
    def generar_ranking_completo(self, fecha_corte: date = None, recalcular: bool = True) -> Dict:
        """Genera ranking completo con estadísticas agregadas"""
        if fecha_corte is None:
            fecha_corte = date.today()
        
        top_musicos = self.obtener_top_musicos(limite=50, fecha_corte=fecha_corte, recalcular=recalcular)
        
        # Estadísticas generales
        if top_musicos:
            scores = [r['score_lealtad'] for r in top_musicos]
            asistencias = [float(r['asistencia']['porcentaje']) for r in top_musicos]
            
            estadisticas = {
                'total_musicos': len(top_musicos),
                'score_promedio': sum(scores) / len(scores),
                'score_maximo': max(scores),
                'score_minimo': min(scores),
                'asistencia_promedio': sum(asistencias) / len(asistencias),
                'mejor_asistencia': max(asistencias),
                'peor_asistencia': min(asistencias)
            }
        else:
            estadisticas = {
                'total_musicos': 0,
                'score_promedio': 0,
                'score_maximo': 0,
                'score_minimo': 0,
                'asistencia_promedio': 0,
                'mejor_asistencia': 0,
                'peor_asistencia': 0
            }
        
        return {
            'fecha_corte': fecha_corte,
            'top_musicos': top_musicos,
            'estadisticas': estadisticas
        }
    
    def actualizar_rendimientos_masivo(self, fecha_corte: date = None) -> Dict:
        """Actualiza el rendimiento de todos los músicos"""
        if fecha_corte is None:
            fecha_corte = date.today()
        
        musicos = Musico.objects.filter(activo=True)
        actualizados = 0
        errores = []
        
        for musico in musicos:
            try:
                self.calcular_rendimiento_musico(musico, fecha_corte)
                actualizados += 1
            except Exception as e:
                logger.error(f"Error calculando rendimiento para {musico}: {e}")
                errores.append(str(e))
        
        return {
            'actualizados': actualizados,
            'errores': errores,
            'fecha_corte': fecha_corte
        }
