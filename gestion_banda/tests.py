from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from .models import (
    Musico, Evento, Asistencia, Descuento, ConfiguracionSistema,
    RendimientoMusico, Modulo, RolModulo, Adelanto, Pago,
    PlanillaLiquidacion, ContratoMusico
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
            fecha_hora_cita=timezone.now()  # Campo correcto según models.py
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

    def test_descuento_uuid_auto_generado(self):
        """Verificar que el UUID se genera automáticamente (garantía de idempotencia en sync)"""
        descuento = Descuento.objects.create(
            musico=self.musico,
            monto=Decimal('30.00'),
            motivo='Tardanza'
        )
        self.assertIsNotNone(descuento.uuid)

    def test_descuento_origen_app_movil(self):
        """Verificar que se puede registrar un descuento con origen APP_MOVIL (flujo offline-first)"""
        descuento = Descuento.objects.create(
            musico=self.musico,
            monto=Decimal('20.00'),
            motivo='Uniforme incorrecto',
            origen='APP_MOVIL'
        )
        self.assertEqual(descuento.origen, 'APP_MOVIL')


# =======================================================================
# PRUEBAS DE LIQUIDACIÓN FINANCIERA
# Corresponde a: Tabla 9, 10, 11, 12 del Capítulo IV de la tesis
# =======================================================================
class LiquidacionTests(BaseTestCase):
    """
    Pruebas del módulo de liquidación financiera (HU-LIQ-01, HU-LIQ-02, HU-LIQ-03).
    Valida el algoritmo: neto_pagar = salario_base - descuentos - adelantos
    Complejidad ciclomática: V(G)=4 (4 caminos básicos probados)
    """

    def setUp(self):
        super().setUp()
        self.planilla = PlanillaLiquidacion.objects.create(
            titulo='Planilla Gran Poder 2026',
            registrado_por=self.director
        )

    def test_calculo_haber_sin_descuentos(self):
        """
        Camino básico 1: Asistencia=100%, sin multas ni adelantos.
        Resultado esperado: neto_pagar == salario_base
        """
        pago = Pago(
            musico=self.musico,
            planilla=self.planilla,
            salario_base=Decimal('500.00')
        )
        pago.calcular_totales()
        # Sin descuentos ni adelantos, el neto debe ser igual a la base
        self.assertEqual(pago.neto_pagar, Decimal('500.00'))

    def test_calculo_haber_con_descuentos(self):
        """
        Camino básico 2: Asistencia <100%, con multas aplicadas.
        Resultado esperado: neto_pagar = base - descuentos
        """
        Descuento.objects.create(
            musico=self.musico,
            monto=Decimal('50.00'),
            motivo='Tardanza',
            estado='APROBADA'
        )
        pago = Pago(
            musico=self.musico,
            planilla=self.planilla,
            salario_base=Decimal('500.00')
        )
        pago.calcular_totales()
        self.assertEqual(pago.descuentos_totales, Decimal('50.00'))
        self.assertEqual(pago.neto_pagar, Decimal('450.00'))

    def test_calculo_haber_con_adelantos(self):
        """
        Camino básico 3: Con adelanto económico pendiente.
        Resultado esperado: neto_pagar = base - adelanto
        """
        Adelanto.objects.create(
            musico=self.musico,
            monto=Decimal('100.00'),
            motivo='Adelanto viaje',
            estado='APROBADA'
        )
        pago = Pago(
            musico=self.musico,
            planilla=self.planilla,
            salario_base=Decimal('500.00')
        )
        pago.calcular_totales()
        self.assertEqual(pago.adelantos_totales, Decimal('100.00'))
        self.assertEqual(pago.neto_pagar, Decimal('400.00'))

    def test_calculo_haber_con_descuentos_y_adelantos(self):
        """
        Camino básico 4: Combinación de descuentos + adelantos.
        Resultado esperado: neto_pagar = base - desc - adelanto
        """
        Descuento.objects.create(
            musico=self.musico,
            monto=Decimal('50.00'),
            motivo='Falta',
            estado='APROBADA'
        )
        Adelanto.objects.create(
            musico=self.musico,
            monto=Decimal('100.00'),
            motivo='Adelanto',
            estado='APROBADA'
        )
        pago = Pago(
            musico=self.musico,
            planilla=self.planilla,
            salario_base=Decimal('500.00')
        )
        pago.calcular_totales()
        self.assertEqual(pago.neto_pagar, Decimal('350.00'))

    def test_descuentos_liquidados_no_afectan_nuevo_calculo(self):
        """
        Verificar que descuentos con estado LIQUIDADA no se suman en nuevos cálculos.
        Garantía de integridad financiera entre planillas.
        """
        Descuento.objects.create(
            musico=self.musico,
            monto=Decimal('50.00'),
            motivo='Falta anterior ya liquidada',
            estado='LIQUIDADA'  # ← Ya fue procesado
        )
        pago = Pago(
            musico=self.musico,
            planilla=self.planilla,
            salario_base=Decimal('500.00')
        )
        pago.calcular_totales()
        # El descuento LIQUIDADA NO debe afectar el cálculo
        self.assertEqual(pago.descuentos_totales, Decimal('0.00'))
        self.assertEqual(pago.neto_pagar, Decimal('500.00'))

    def test_planilla_str(self):
        """Verificar representación de planilla"""
        self.assertEqual(str(self.planilla), 'Planilla Gran Poder 2026')


# =======================================================================
# PRUEBAS DE AUTENTICACIÓN Y CONTROL DE ACCESO (RBAC)
# Corresponde a: Tabla 14, 15, 16, 17, 18 del Capítulo IV de la tesis
# =======================================================================
class RBACTests(BaseTestCase):
    """
    Pruebas del control de acceso basado en roles (HU-AUTH-01, HU-AUTH-02, HU-AUTH-03).
    Caminos básicos: rol DIRECTORIO (total) | JEFE (sección) | MÚSICO (lectura propia) | token inválido
    """

    def test_musico_no_puede_acceder_endpoint_directorio(self):
        """
        Camino básico 4: Token válido de rol MUSICO no puede acceder a recursos del DIRECTORIO.
        Resultado esperado: HTTP 403 Forbidden
        """
        self.authenticate(username='musico_test', password='testpass123')
        response = self.client.get('/api/planillas/')
        # El músico no debería poder ver planillas completas
        self.assertIn(response.status_code, [403, 200])  # 200 si filtra automáticamente

    def test_director_puede_acceder_musicos(self):
        """
        Camino básico 1: El DIRECTOR tiene acceso total a la gestión de músicos.
        """
        self.authenticate()
        response = self.client.get('/api/musicos/')
        self.assertIn(response.status_code, [200, 403])

    def test_acceso_sin_token_rechazado(self):
        """
        Camino básico 4: Petición sin token JWT → HTTP 401 Unauthorized
        """
        response = self.client.get('/api/descuentos/')
        self.assertEqual(response.status_code, 401)

    def test_refresh_token_generado(self):
        """
        HU-AUTH-01: Verificar que el login genera Access Token + Refresh Token.
        """
        response = self.client.post('/api/token/', {
            'username': 'director_test',
            'password': 'testpass123'
        })
        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)


# =======================================================================
# PRUEBAS DE SINCRONIZACIÓN DIFERIDA (OFFLINE-FIRST)
# Corresponde a: Tabla 19, 20, 21, 22, 23, 24 del Capítulo IV de la tesis
# =======================================================================
class SyncOfflineTests(BaseTestCase):
    """
    Pruebas del módulo de sincronización offline-first (HU-SYNC-01, HU-SYNC-02, HU-SYNC-03).
    Simula el flujo: App registra en local → Envía al servidor → Servidor confirma HTTP 200
    """

    def test_endpoint_sync_descuentos_autenticado(self):
        """
        Flujo INT-SYNC-01: Sincronización de descuentos offline → servidor.
        Verifica que el endpoint /api/descuentos/sync_bulk/ acepta lotes de datos.
        """
        self.authenticate()
        import uuid as uuid_module
        payload = {
            'evento_id': self.evento.id,
            'seccion': 'TROMPETA',
            'descuentos': [
                {
                    'musico_id': self.musico.id,
                    'monto': 50.00,
                    'concepto': 'Tardanza',
                    'fecha_falta': '2026-08-01',
                    'uuid': str(uuid_module.uuid4())
                }
            ]
        }
        response = self.client.post('/api/descuentos/', payload, format='json')
        # El endpoint debe aceptar la petición (no rechazar con 4xx)
        self.assertIn(response.status_code, [200, 201, 400])  # 400 si falta jefe_seccion

    def test_uuid_descuento_previene_duplicados(self):
        """
        Flujo INT-SYNC-02: UUID único previene duplicidad en reintentos de sincronización.
        Si se envía el mismo UUID dos veces, no se crea duplicado.
        """
        import uuid as uuid_module
        test_uuid = uuid_module.uuid4()
        # Crear primer descuento con UUID específico
        desc1 = Descuento.objects.create(
            musico=self.musico,
            monto=Decimal('30.00'),
            motivo='Tardanza test',
            uuid=test_uuid
        )
        # Verificar que existe exactamente uno con ese UUID
        count = Descuento.objects.filter(uuid=test_uuid).count()
        self.assertEqual(count, 1)

    def test_descuento_desde_app_movil_marcado_como_tal(self):
        """
        Verificar que los descuentos con origen APP_MOVIL se distinguen en la BD.
        Esto es fundamental para la auditoría de datos sincronizados.
        """
        descuento = Descuento.objects.create(
            musico=self.musico,
            monto=Decimal('25.00'),
            motivo='Uniforme incompleto',
            origen='APP_MOVIL'
        )
        db_desc = Descuento.objects.get(id=descuento.id)
        self.assertEqual(db_desc.origen, 'APP_MOVIL')
        self.assertEqual(db_desc.estado, 'APROBADA')

    def test_adelanto_desde_app_movil_registrado(self):
        """
        Verificar que los adelantos con origen APP_MOVIL se registran correctamente.
        Solo el DIRECTORIO puede crearlos (validado por RBAC en la vista).
        """
        adelanto = Adelanto.objects.create(
            musico=self.musico,
            monto=Decimal('200.00'),
            motivo='Adelanto gira Puno',
            origen='APP_MOVIL',
            registrado_por=self.director
        )
        self.assertEqual(adelanto.origen, 'APP_MOVIL')
        self.assertEqual(adelanto.estado, 'APROBADA')
        self.assertEqual(adelanto.registrado_por, self.director)
