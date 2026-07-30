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
    CampanaCanastonSerializer, ResultadoCanastonSerializer,
    UserProfileUpdateSerializer
)
from services.rendimiento_calculator import RendimientoCalculator
from ..canaston_service import calcular_elegibilidad_canaston

class PinAuthView(views.APIView):
    """
    Autentica a un usuario basado en un PIN de 4 dígitos o username/password.
    - Para músicos: El PIN corresponde a los primeros 4 dígitos del documento de identidad.
    - Para administradores: Usa username y password estándar.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        pin = request.data.get('pin')
        username = request.data.get('username')
        password = request.data.get('password')
        
        pin_enviado = pin or password

        # 1. Autenticación clásica (para todos los usuarios y músicos, con PIN configurado o reseteado)
        if username and pin_enviado:
            from django.contrib.auth import authenticate
            user = authenticate(username=username, password=pin_enviado)
            if user and user.is_active:
                refresh = RefreshToken.for_user(user)
                return Response({
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                    'user': UsuarioSerializer(user).data
                })
        
        # Si no se encuentra, devolver error.
        return Response(
            {'error': 'Credenciales inválidas o cuenta inactiva.'},
            status=status.HTTP_400_BAD_REQUEST
        )


class UserMeView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UsuarioSerializer(request.user)
        data = serializer.data
        if hasattr(request.user, 'perfil_musico'):
            data['musico_id'] = request.user.perfil_musico.id
        return Response(data)

    def put(self, request):
        return self.patch(request)
        
    def patch(self, request):
        serializer = UserProfileUpdateSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            user = serializer.save()
            return Response(UsuarioSerializer(user).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MobileSessionView(views.APIView):
    """
    Proporciona los datos de sesión necesarios para la app móvil,
    incluyendo el rol del usuario y los módulos a los que tiene acceso.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        rol = user.rol
        data = {
            'usuario_id': user.id,
            'nombre': user.get_full_name() or user.username,
            'rol': rol,
            'modules': [],
            'seccion': None,
        }

        # Asignar módulos reales según la base de datos (única fuente de verdad)
        data['modules'] = list(user.todos_modulos.values_list('clave', flat=True))

        if rol == 'JEFE_SECCION':
            try:
                jefe_seccion = JefeSeccion.objects.get(musico__usuario=user, activo=True)
                data['seccion'] = jefe_seccion.seccion
            except JefeSeccion.DoesNotExist:
                pass
        
        return Response(data)
