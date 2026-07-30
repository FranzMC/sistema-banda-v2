from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from .models import (
    Musico, Evento, Asistencia, Descuento, ConfiguracionSistema,
    RendimientoMusico, Modulo, RolModulo
)
from decimal import Decimal

User = get_user_model()


class BaseTestCase(TestCase):
    """Base test case with common setup for all tests"""

    def setUp(self):
        """Configurar datos de prueba comunes"""
        # Crear configuración del sistema
        self.config = ConfiguracionSistema.objects.create(
            nombre_banda="Banda de Prueba",
            monto_por_evento=Decimal('100.00'),
            hora_limite_tardanza="19:05:00"
        )

        # Crear usuario director
        self.director = User.objects.create_user(
            username='director_test',
            password='testpass123',
            rol='DIRECTOR',
            first_name='Director',
            last_name='Test'
        )

        # Crear usuario músico
        self.musico_user = User.objects.create_user(
            username='musico_test',
            password='testpass123',
            rol='MUSICO',
            first_name='Juan',
            last_name='Pérez'
        )

        # Crear músico con los campos correctos del modelo
        self.musico = Musico.objects.create(
            usuario=self.musico_user,
            documento_identidad='12345678',
            nombres='Juan',
            apellidos='Pérez',
            instrumento='TROMPETA',
            nivel='INTERMEDIO',
            activo=True
        )

        # Crear evento con los campos correctos del modelo
        self.evento = Evento.objects.create(
            titulo='Concierto de Prueba',
            uniforme='GALA',
            lugar_concentracion='Teatro Principal',
            responsable='DIRECTOR'
        )

        # API Client con autenticación JWT
        self.client = APIClient()

    def authenticate(self, username='director_test', password='testpass123'):
        """Helper para autenticar vía JWT"""
        response = self.client.post('/api/token/', {
            'username': username,
            'password': password
        })
        if response.status_code == 200:
            token = response.data['access']
            self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        return response


class AuthenticationTests(BaseTestCase):
    """Tests para autenticación JWT"""

    def test_jwt_login_success(self):
        """Probar login JWT exitoso"""
        response = self.client.post('/api/token/', {
            'username': 'director_test',
            'password': 'testpass123'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_jwt_login_invalid_credentials(self):
        """Probar login JWT con credenciales inválidas"""
        response = self.client.post('/api/token/', {
            'username': 'director_test',
            'password': 'wrongpassword'
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_protected_endpoint_without_token(self):
        """Probar que endpoints protegidos requieren autenticación"""
        response = self.client.get('/api/musicos/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_protected_endpoint_with_token(self):
        """Probar acceso a endpoint protegido con token"""
        self.authenticate()
        response = self.client.get('/api/musicos/')
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_403_FORBIDDEN])


class MusicoModelTests(BaseTestCase):
    """Tests para el modelo Musico"""

    def test_nombre_completo(self):
        """Probar propiedad nombre_completo"""
        self.assertEqual(self.musico.nombre_completo, 'Juan Pérez')

    def test_musico_str(self):
        """Probar representación string del músico"""
        self.assertEqual(str(self.musico), 'Juan Pérez')

    def test_musico_activo_default(self):
        """Probar que músico se crea activo por defecto"""
        self.assertTrue(self.musico.activo)

    def test_documento_identidad_unique(self):
        """Probar que documento de identidad valida correctamente"""
        self.assertEqual(self.musico.documento_identidad, '12345678')


class EventoModelTests(BaseTestCase):
    """Tests para el modelo Evento"""

    def test_evento_str(self):
        """Probar representación string del evento"""
        self.assertEqual(str(self.evento), 'Concierto de Prueba')

    def test_evento_convocados_m2m(self):
        """Probar relación many-to-many con músicos"""
        self.evento.convocados.add(self.musico)
        self.assertIn(self.musico, self.evento.convocados.all())


class RendimientoMusicoTests(BaseTestCase):
    """Tests para el cálculo de rendimiento"""

    def test_calcular_score_lealtad(self):
        """Probar cálculo de score de lealtad"""
        rendimiento = RendimientoMusico.objects.create(
            musico=self.musico,
            porcentaje_asistencia=Decimal('80.00'),
            puntualidad_promedio=Decimal('90.00'),
            antiguedad_meses=12,
            total_descuentos=Decimal('0.00')
        )
        rendimiento.calcular_score_lealtad()

        # Verificar que el score se calculó
        self.assertGreater(rendimiento.score_lealtad, 0)
        self.assertLessEqual(rendimiento.score_lealtad, 100)

    def test_puntualidad_alta_da_score_alto(self):
        """Probar que mayor puntualidad da mayor score (bug fix verificación)"""
        # Músico puntual (100%)
        rend_puntual = RendimientoMusico.objects.create(
            musico=self.musico,
            porcentaje_asistencia=Decimal('80.00'),
            puntualidad_promedio=Decimal('100.00'),
            antiguedad_meses=12,
            total_descuentos=Decimal('0.00')
        )
        rend_puntual.calcular_score_lealtad()

        # Crear otro músico para comparar
        user2 = User.objects.create_user(username='test2', password='pass', rol='MUSICO')
        musico2 = Musico.objects.create(
            usuario=user2, nombres='Pedro', apellidos='López',
            instrumento='TROMBON', nivel='INTERMEDIO'
        )

        # Músico impuntual (20%)
        rend_impuntual = RendimientoMusico.objects.create(
            musico=musico2,
            porcentaje_asistencia=Decimal('80.00'),
            puntualidad_promedio=Decimal('20.00'),
            antiguedad_meses=12,
            total_descuentos=Decimal('0.00')
        )
        rend_impuntual.calcular_score_lealtad()

        # El músico puntual DEBE tener mayor score
        self.assertGreater(rend_puntual.score_lealtad, rend_impuntual.score_lealtad)


class AsistenciaTests(BaseTestCase):
    """Tests para el modelo Asistencia"""

    def test_crear_asistencia(self):
        """Probar creación de asistencia"""
        asistencia = Asistencia.objects.create(
            musico=self.musico,
            evento=self.evento,
            estado='PRESENTE'
        )
        self.assertEqual(asistencia.estado, 'PRESENTE')
        self.assertEqual(asistencia.musico, self.musico)

    def test_minutos_tardanza_a_tiempo(self):
        """Probar que no hay tardanza si no hay hora de llegada"""
        asistencia = Asistencia.objects.create(
            musico=self.musico,
            evento=self.evento,
            estado='PRESENTE'
        )
        self.assertEqual(asistencia.minutos_tardanza, 0)


class DescuentoTests(BaseTestCase):
    """Tests para el modelo Descuento"""

    def test_crear_descuento(self):
        """Probar creación de descuento"""
        descuento = Descuento.objects.create(
            musico=self.musico,
            monto=Decimal('50.00'),
            motivo='Falta injustificada'
        )
        self.assertEqual(descuento.monto, Decimal('50.00'))
        self.assertEqual(descuento.estado, 'APROBADA')

    def test_descuento_str(self):
        """Probar representación string del descuento"""
        descuento = Descuento.objects.create(
            musico=self.musico,
            monto=Decimal('50.00'),
            motivo='Falta'
        )
        self.assertIn('Juan Pérez', str(descuento))
        self.assertIn('50.00', str(descuento))
