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

class CampanaCanastonViewSet(viewsets.ModelViewSet):
    """
    ViewSet para gestionar las campañas de canastones.
    Permite al Directorio crear, ver y calcular campañas.
    """
    queryset = CampanaCanaston.objects.all()
    serializer_class = CampanaCanastonSerializer
    permission_classes = [permissions.IsAuthenticated, EsPresidente]

    @action(detail=True, methods=['post'], url_path='calcular')
    def calcular(self, request, pk=None):
        """
        Dispara el cálculo de elegibilidad para una campaña específica.
        """
        campana = self.get_object()
        if campana.estado == 'CERRADO':
            return Response(
                {'error': 'Esta campaña está cerrada y no se puede recalcular.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        resultado = calcular_elegibilidad_canaston(campana_id=pk)
        
        if resultado['success']:
            return Response(resultado, status=status.HTTP_200_OK)
        else:
            return Response(resultado, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'], url_path='resultados')
    def resultados(self, request, pk=None):
        """
        Devuelve los resultados detallados y agrupados de una campaña,
        incluyendo un resumen de descuentos por sección.
        """
        try:
            campana = self.get_object()
        except CampanaCanaston.DoesNotExist:
            return Response({"error": "Campaña no encontrada"}, status=status.HTTP_404_NOT_FOUND)

        # 1. Obtener todos los resultados para la campaña, ordenados para el ranking
        resultados = ResultadoCanaston.objects.filter(campana=campana).select_related(
            'musico'
        ).order_by('musico__instrumento', '-es_elegible', '-score_lealtad_snapshot')

        # 2. Agrupar resultados por sección
        resultados_por_seccion = {}
        for resultado in resultados:
            seccion = resultado.musico.get_instrumento_display()
            if seccion not in resultados_por_seccion:
                resultados_por_seccion[seccion] = []
            
            # Usar el serializer para dar formato a cada resultado individual
            serializer = ResultadoCanastonSerializer(resultado)
            resultados_por_seccion[seccion].append(serializer.data)
        
        # Convertir el diccionario a una lista de objetos para la respuesta JSON
        lista_secciones = [
            {'seccion': key, 'musicos': value} 
            for key, value in resultados_por_seccion.items()
        ]

        # 3. Calcular el total de descuentos por sección en el rango de la campaña
        descuentos = Descuento.objects.filter(
            fecha_falta__range=(campana.fecha_inicio_calculo, campana.fecha_fin_calculo)
        ).values(
            'musico__instrumento'  # Agrupar por la sección del músico
        ).annotate(
            total_descuentos=Sum('monto')
        ).order_by('-total_descuentos')

        # Formatear el resumen de descuentos
        instrumentos_map = dict(Musico.INSTRUMENTOS)
        resumen_descuentos = [
            {'seccion': instrumentos_map.get(item['musico__instrumento'], item['musico__instrumento']), 'total_descuentos': item['total_descuentos']}
            for item in descuentos
        ]

        # 4. Construir la respuesta final
        return Response({
            'campana': CampanaCanastonSerializer(campana).data,
            'resultados_por_seccion': lista_secciones,
            'resumen_descuentos': resumen_descuentos
        })


class ResultadoCanastonViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet para ver los resultados del canastón y marcar como entregado.
    """
    queryset = ResultadoCanaston.objects.all()
    serializer_class = ResultadoCanastonSerializer
    permission_classes = [permissions.IsAuthenticated, EsPresidente]

    @action(detail=True, methods=['patch'], url_path='marcar-entregado')
    def marcar_entregado(self, request, pk=None):
        """
        Marca un canastón como entregado.
        """
        resultado = self.get_object()
        if not resultado.es_elegible:
            return Response(
                {'error': 'Este músico no es elegible para recibir el canastón.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        resultado.estado_entrega = 'ENTREGADO'
        resultado.save(update_fields=['estado_entrega'])
        return Response(ResultadoCanastonSerializer(resultado).data)

class CanastonEstadisticasView(views.APIView):
    """
    Vista general para calcular estadísticas de Canastón en base a un rango de fechas.
    Restringida a Presidente, Director y Subdirector.
    """
    permission_classes = [permissions.IsAuthenticated, EsAdministrativo]

    def get(self, request, *args, **kwargs):
        fecha_inicio_str = request.query_params.get('fecha_inicio')
        fecha_fin_str = request.query_params.get('fecha_fin')

        if not fecha_inicio_str or not fecha_fin_str:
            # Default to current year if not provided
            today = date.today()
            fecha_inicio = date(today.year, 1, 1)
            fecha_fin = date(today.year, 12, 31)
        else:
            try:
                fecha_inicio = date.fromisoformat(fecha_inicio_str)
                fecha_fin = date.fromisoformat(fecha_fin_str)
            except ValueError:
                return Response({'error': 'Formato de fecha inválido. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Asistencias de Músicos
        musicos = Musico.objects.filter(activo=True)
        
        # Calcular los eventos a los que fue convocado cada músico en ese rango (Relación Nominal)
        from django.db.models import Exists, OuterRef
        
        # Para cada músico, contamos a cuántos eventos fue convocado en el rango
        eventos_convocados_dict = {}
        for musico in musicos:
            total_convocados = Evento.objects.filter(
                fecha_hora_cita__date__gte=fecha_inicio,
                fecha_hora_cita__date__lte=fecha_fin,
                convocados=musico
            ).count()
            eventos_convocados_dict[musico.id] = total_convocados

        # Asistencias basadas en si se le pagó (liquidado=True) o si se le marcó explícitamente como presente
        asistencias = Asistencia.objects.filter(
            Q(liquidado=True) | Q(estado__in=['PRESENTE', 'TARDANZA', 'JUSTIFICADO']),
            evento__fecha_hora_cita__date__gte=fecha_inicio,
            evento__fecha_hora_cita__date__lte=fecha_fin
        ).values('musico_id').annotate(total_asistencias=Count('id'))

        asistencias_dict = {a['musico_id']: a['total_asistencias'] for a in asistencias}

        MACRO_SECCIONES = {
            'Trompetas, Saxos y Clarinetes': ['TROMPETA', 'SAXOFON', 'CLARINETE', 'FLAUTA'],
            'Barítonos': ['BARITONO'],
            'Trombones': ['TROMBON'],
            'Tubas': ['TUBA'],
            'Percusión': ['BOMBO', 'TAMBOR', 'PLATILLOS', 'PERCUSION'],
            'Otros': ['OTRO']
        }

        def get_macro_seccion(instrumento):
            for macro, insts in MACRO_SECCIONES.items():
                if instrumento in insts:
                    return macro
            return 'Otros'

        estadisticas_musicos = []
        # Para la respuesta JSON general, podemos devolver el máximo de eventos posibles
        total_eventos_global = Evento.objects.filter(
            fecha_hora_cita__date__gte=fecha_inicio,
            fecha_hora_cita__date__lte=fecha_fin
        ).count()

        for musico in musicos:
            total_asistencias = asistencias_dict.get(musico.id, 0)
            total_eventos_musico = eventos_convocados_dict.get(musico.id, 0)
            
            porcentaje = (total_asistencias / total_eventos_musico * 100) if total_eventos_musico > 0 else 0
            elegible = porcentaje >= 50
            
            estadisticas_musicos.append({
                'id': musico.id,
                'nombre_completo': musico.nombre_completo,
                'instrumento': musico.get_instrumento_display(),
                'macro_seccion': get_macro_seccion(musico.instrumento),
                'total_asistencias': total_asistencias,
                'total_eventos': total_eventos_musico,
                'porcentaje': round(porcentaje, 2),
                'es_elegible': elegible
            })

        # 2. Descuentos por Macro-sección
        descuentos = Descuento.objects.filter(
            fecha_falta__gte=fecha_inicio,
            fecha_falta__lte=fecha_fin,
            estado='APROBADA'
        ).select_related('musico')

        resumen_descuentos = {macro: 0 for macro in MACRO_SECCIONES.keys()}
        
        for descuento in descuentos:
            macro = get_macro_seccion(descuento.musico.instrumento)
            resumen_descuentos[macro] += float(descuento.monto)

        # Buscar los jefes de sección para agregarlos a la respuesta
        jefes = Usuario.objects.filter(rol='JEFE_SECCION', is_active=True)
        jefes_por_macro = {macro: [] for macro in MACRO_SECCIONES.keys()}
        
        for jefe in jefes:
            if not jefe.seccion_encargada:
                continue
            secciones_jefe = [s.strip() for s in jefe.seccion_encargada.split(',')]
            # Determinar a qué macro sección pertenece este jefe basándose en su primer instrumento asignado
            if secciones_jefe:
                macro = get_macro_seccion(secciones_jefe[0])
                jefes_por_macro[macro].append(f"{jefe.first_name} {jefe.last_name}".strip() or jefe.username)

        descuentos_array = [
            {
                'macro_seccion': macro,
                'total_descuentos': total,
                'jefes': jefes_por_macro[macro]
            }
            for macro, total in resumen_descuentos.items()
        ]

        return Response({
            'fecha_inicio': fecha_inicio,
            'fecha_fin': fecha_fin,
            'total_eventos_periodo': total_eventos_global,
            'estadisticas_musicos': estadisticas_musicos,
            'descuentos_secciones': descuentos_array
        })
