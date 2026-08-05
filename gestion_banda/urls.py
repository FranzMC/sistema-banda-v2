from django.urls import path, include
from rest_framework import views as drf_views, permissions as drf_permissions
from rest_framework.response import Response
from rest_framework.routers import DefaultRouter
from .views.musicos_views import MusicoViewSet, JefeSeccionViewSet, ContratoMusicoViewSet
from .views.usuarios_views import UsuarioViewSet
from .views.eventos_views import EventoViewSet, AsistenciaViewSet
from .views.finanzas_views import (
    DescuentoViewSet, PagoViewSet, AdelantoViewSet, PlanillaLiquidacionViewSet, 
    DeudaViewSet, AbonoDeudaViewSet
)
from .views.config_views import ConfiguracionViewSet
from .views.canastones_views import CampanaCanastonViewSet, ResultadoCanastonViewSet, CanastonEstadisticasView
from .views.auth_views import PinAuthView, UserMeView, MobileSessionView
from .views.dashboard_views import DashboardView, RankingView
from .views.musico_resumen_views import MusicoResumenView
from .models import Musico


class SeccionesView(drf_views.APIView):
    """Devuelve la lista de secciones/instrumentos para la app móvil."""
    permission_classes = [drf_permissions.IsAuthenticated]

    def get(self, request):
        secciones = [{'value': k, 'label': v} for k, v in Musico.INSTRUMENTOS]
        return Response(secciones)

router = DefaultRouter()
router.register(r'musicos', MusicoViewSet, basename='musicos')
router.register(r'usuarios', UsuarioViewSet, basename='usuarios')
router.register(r'eventos', EventoViewSet, basename='eventos')
router.register(r'asistencias', AsistenciaViewSet, basename='asistencias')
router.register(r'descuentos', DescuentoViewSet, basename='descuentos')
router.register(r'pagos', PagoViewSet, basename='pagos')
router.register(r'configuracion', ConfiguracionViewSet, basename='configuracion')
router.register(r'adelantos', AdelantoViewSet, basename='adelantos')
router.register(r'planillas', PlanillaLiquidacionViewSet, basename='planillas')
router.register(r'contratos', ContratoMusicoViewSet, basename='contratos')
router.register(r'deudas', DeudaViewSet, basename='deudas')
router.register(r'abonos', AbonoDeudaViewSet, basename='abonos')
router.register(r'jefes-seccion', JefeSeccionViewSet, basename='jefes-seccion')
router.register(r'campanas-canaston', CampanaCanastonViewSet, basename='campanas-canaston')
router.register(r'resultados-canaston', ResultadoCanastonViewSet, basename='resultados-canaston')

urlpatterns = [
    path('auth/me/', UserMeView.as_view(), name='auth_me'),
    path('auth/pin/', PinAuthView.as_view(), name='auth_pin'),
    path('auth/session/', MobileSessionView.as_view(), name='auth_session'),
    path('secciones/', SeccionesView.as_view(), name='secciones'),
    path('dashboard/', DashboardView.as_view(), name='dashboard'),
    path('ranking/', RankingView.as_view(), name='ranking'),
    path('canaston/estadisticas/', CanastonEstadisticasView.as_view(), name='canaston_estadisticas'),
    path('musico/resumen/', MusicoResumenView.as_view(), name='musico_resumen'),
    path('', include(router.urls)),
]
