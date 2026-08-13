from django.db import models

from django.contrib.auth.models import AbstractUser

from django.core.validators import RegexValidator

from django.utils import timezone

from decimal import Decimal

import datetime

import uuid



class Usuario(AbstractUser):

    ROLES = [

        ('PRESIDENTE', 'Presidente/Fundador'),

        ('DIRECTOR', 'Director'),

        ('SUBDIRECTOR', 'Subdirector'),

        ('JEFE_SECCION', 'Jefe de Sección'),

        ('MUSICO', 'Músico'),

    ]



    rol = models.CharField(max_length=20, choices=ROLES, default='MUSICO')

    telefono = models.CharField(max_length=20, blank=True)

    seccion_encargada = models.CharField(max_length=50, blank=True, null=True, help_text='Sección asignada para Jefe de Sección')
    
    pin_actual = models.CharField(max_length=4, blank=True, null=True, help_text='Almacena el PIN en texto plano solo para visibilidad del Presidente')



    class Meta:

        db_table = 'auth_usuario'

        verbose_name = 'Usuario'

        verbose_name_plural = 'Usuarios'



    def desactivar(self):

        self.is_active = False

        self.save()



    def get_instrumentos_encargados(self):

        """Retorna la lista de instrumentos que maneja el jefe de sección, expandiendo PERCUSION"""

        if not self.seccion_encargada:

            return []

        secciones = [s.strip() for s in self.seccion_encargada.split(',')]

        instrumentos_permitidos = []

        for seccion in secciones:

            if seccion == 'PERCUSION':

                instrumentos_permitidos.extend(['BOMBO', 'PLATILLOS', 'TAMBOR', 'PERCUSION'])

            else:

                instrumentos_permitidos.append(seccion)

        return instrumentos_permitidos



    @property

    def modulos_asignados(self):

        """Retorna módulos según su rol"""

        # CORRECCIÓN VITAL: Cambiado 'rolmodulo' por 'rol_asignaciones'

        return Modulo.objects.filter(

            rol_asignaciones__rol=self.rol,

            activo=True

        ).distinct()



    @property

    def todos_modulos(self):

        """Retorna módulos por rol + personalizados"""

        modulos_rol = self.modulos_asignados

        modulos_personales = Modulo.objects.filter(usuario_asignaciones__usuario=self, activo=True)

        return (modulos_rol | modulos_personales).distinct()



    def tiene_modulo(self, clave_modulo):

        """Verifica si usuario tiene acceso a un módulo"""

        return self.todos_modulos.filter(clave=clave_modulo).exists()





class Modulo(models.Model):

    """Módulos del sistema - representan funcionalidades"""

    OPCIONES = [

        ('DASHBOARD', 'Dashboard Principal'),

        ('MUSICOS', 'Gestión de Músicos'),

        ('EVENTOS', 'Gestión de Eventos'),

        ('DESCUENTOS', 'Registrar Descuentos'),

        ('ADELANTOS', 'Registrar Adelantos'),

        ('LIQUIDACIONES', 'Generar Liquidaciones'),

        ('CANASTON', 'Canastón - Rendimiento'),

        ('FINANCIAMIENTO', 'Financiamiento'),

        ('HISTORIAL_DESCUENTOS', 'Ver Historial de Descuentos'),

        ('HISTORIAL_CONTRATOS', 'Ver Historial de Contratos'),

        ('ADMIN_USUARIOS', 'Administración de Usuarios'),

        ('MI_RESUMEN', 'Mi Resumen Financiero'),

    ]



    clave = models.CharField(max_length=50, unique=True, choices=OPCIONES)

    nombre = models.CharField(max_length=100)

    descripcion = models.TextField(blank=True)

    activo = models.BooleanField(default=True)



    def __str__(self):

        return f"{self.nombre} ({self.clave})"



    class Meta:

        verbose_name = 'Módulo'

        verbose_name_plural = 'Módulos'





class RolModulo(models.Model):

    """Define qué módulos tiene cada rol por defecto"""

    rol = models.CharField(max_length=20, choices=Usuario.ROLES)

    modulo = models.ForeignKey(Modulo, on_delete=models.CASCADE, related_name='rol_asignaciones')



    class Meta:

        unique_together = ('rol', 'modulo')

        verbose_name = 'Rol Módulo'

        verbose_name_plural = 'Rol Módulos'



    def __str__(self):

        return f"{self.rol} → {self.modulo.clave}"





class UsuarioModulo(models.Model):

    """Permisos personalizados/adicionales para usuarios específicos"""

    usuario = models.ForeignKey(Usuario, on_delete=models.CASCADE, related_name='modulos_personales')

    modulo = models.ForeignKey(Modulo, on_delete=models.CASCADE, related_name='usuario_asignaciones')



    class Meta:

        unique_together = ('usuario', 'modulo')

        verbose_name = 'Usuario Módulo'

        verbose_name_plural = 'Usuarios Módulos'



    def __str__(self):

        return f"{self.usuario.username} → {self.modulo.clave}"





class Musico(models.Model):

    usuario = models.OneToOneField(Usuario, on_delete=models.CASCADE, related_name='perfil_musico', null=True, blank=True)

    documento_identidad = models.CharField(max_length=20, null=True, blank=True, validators=[

        RegexValidator(r'^[0-9-]+$', 'Solo se permiten números y guiones')

    ], verbose_name="Documento de Identidad")

    nombres = models.CharField(max_length=100)

    apellidos = models.CharField(max_length=100)

    telefono = models.CharField(max_length=20, blank=True, verbose_name="Teléfono")

    direccion = models.TextField(blank=True)

    talla_camisa = models.CharField(max_length=10, blank=True)

    talla_chamarra = models.CharField(max_length=10, blank=True)

    numero_calzado = models.CharField(max_length=10, blank=True)



    INSTRUMENTOS = [

        ('TROMPETA', 'Trompeta'),

        ('TROMBON', 'Trombón'),

        ('SAXOFON', 'Saxofón'),

        ('CLARINETE', 'Clarinete'),

        ('FLAUTA', 'Flauta'),

        ('TUBA', 'Tuba'),

        ('BARITONO', 'Barítono'),

        ('BOMBO', 'Bombo'),

        ('TAMBOR', 'Tambor'),

        ('PLATILLOS', 'Platillos'),

        ('PERCUSION', 'Percusión General'),

        ('OTRO', 'Otro'),

    ]

    instrumento = models.CharField(max_length=20, choices=INSTRUMENTOS)



    NIVELES = [

        ('PRINCIPIANTE', 'Principiante'),

        ('INTERMEDIO', 'Intermedio'),

        ('AVANZADO', 'Avanzado'),

        ('MAESTRO', 'Maestro'),

    ]

    nivel = models.CharField(max_length=20, choices=NIVELES, default='INTERMEDIO')



    fecha_nacimiento = models.DateField(null=True, blank=True, verbose_name="Fecha de Nacimiento")

    foto_perfil = models.ImageField(upload_to='fotos_perfil/', blank=True, null=True, verbose_name="Foto de Perfil")

    orden = models.PositiveIntegerField(default=0, blank=True, verbose_name="Orden")

    activo = models.BooleanField(default=True)

    created_at = models.DateTimeField(default=timezone.now, verbose_name="Fecha de Registro")



    @property

    def nombre_completo(self):

        nombres = self.nombres.strip() if self.nombres else ""

        apellidos = self.apellidos.strip() if self.apellidos else ""

        return f"{nombres} {apellidos}".strip()



    def __str__(self):

        return self.nombre_completo



    class Meta:

        verbose_name = 'Músico'

        verbose_name_plural = 'Músicos'

        ordering = ['orden', 'apellidos', 'nombres']





class Evento(models.Model):

    UNIFORMES = [

        ('GALA', 'Uniforme de Gala'),

        ('NEGRO', 'Uniforme Negro'),

        ('DIANA', 'Uniforme de Diana'),

        ('DIARIO', 'Uniforme Diario'),

        ('VIAJE', 'Uniforme de Viaje'),

        ('VELADA', 'Uniforme de Velada'),

        ('OTRO', 'Otro (especificar)'),

    ]



    titulo = models.CharField(max_length=200)

    titulo_contrato = models.CharField(max_length=200, blank=True, null=True, help_text="Título general del contrato")

    uniforme = models.CharField(max_length=20, choices=UNIFORMES, default='DIARIO')

    uniforme_personalizado = models.CharField(max_length=300, blank=True, help_text="Especificar si elige 'Otro'")

    fecha_hora_cita = models.DateTimeField(verbose_name="Fecha y hora de cita", default=timezone.now)

    lugar_concentracion = models.CharField(max_length=300, blank=True)

    detalles_uniforme = models.TextField(blank=True, help_text="Descripción escrita del uniforme")

    convocados = models.ManyToManyField(Musico, blank=True, related_name='eventos_convocados')

    created_at = models.DateTimeField(auto_now_add=True, null=True)



    def __str__(self):

        return self.titulo



    class Meta:

        ordering = ['fecha_hora_cita']

        verbose_name = 'Evento'

        verbose_name_plural = 'Eventos'





class ContratoMusico(models.Model):

    """Representa el contrato personalizado para un músico en un evento específico"""

    musico = models.ForeignKey(Musico, on_delete=models.CASCADE, related_name='contratos')

    evento = models.ForeignKey(Evento, on_delete=models.CASCADE, related_name='contratos')

    monto_diario = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Monto Diario Base", help_text="Monto base por día para este músico en este evento")

    aprobado_por = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True, related_name='contratos_aprobados', help_text="Director/Subdirector que aprobó este contrato")

    fecha_aprobacion = models.DateTimeField(null=True, blank=True)

    observaciones = models.TextField(blank=True, help_text="Motivo de la asignación personalizada")

    created_at = models.DateTimeField(auto_now_add=True, null=True)



    class Meta:

        unique_together = ['musico', 'evento']

        verbose_name = 'Contrato de Músico'

        verbose_name_plural = 'Contratos de Músicos'



    def __str__(self):

        return f"{self.musico.nombre_completo} - {self.evento.titulo} - ${self.monto_diario}/día"



    @property

    def monto_total_estimado(self):

        """Calcula el monto total basado en los detalles diarios o el monto base"""

        if self.detalles_diarios.exists():

            total = self.detalles_diarios.aggregate(

                total=models.Sum('monto_asignado')

            )['total'] or Decimal('0.00')

            return total

        return self.monto_diario



    @property

    def cantidad_dias(self):

        """Retorna la cantidad de días del contrato"""

        if self.detalles_diarios.exists():

            return self.detalles_diarios.count()

        return 1



    @property

    def monto_promedio_diario(self):

        """Calcula el promedio diario"""

        dias = self.cantidad_dias

        if dias > 0:

            return self.monto_total_estimado / dias

        return Decimal('0.00')



    def agregar_detalle_diario(self, fecha, monto, motivo='', aprobado_por=None):

        """Agrega o actualiza un detalle diario específico"""

        if aprobado_por is None:

            aprobado_por = Usuario.objects.filter(

                rol__in=['DIRECTOR', 'SUBDIRECTOR']

            ).first()



        detalle, creado = DetalleMontoDiario.objects.update_or_create(

            contrato=self,

            fecha=fecha,

            defaults={

                'monto_asignado': monto,

                'motivo_variacion': motivo,

                'aprobado_por': aprobado_por,

                'fecha_aprobacion': timezone.now()

            }

        )



        Asistencia.objects.update_or_create(

            musico=self.musico,

            evento=self.evento,

            fecha_asistencia=fecha,

            defaults={

                'monto_acordado': monto,

                'contrato': self

            }

        )



        return detalle, creado





class DetalleMontoDiario(models.Model):

    """Registra montos específicos por día para cada músico en eventos multi-día"""

    contrato = models.ForeignKey(ContratoMusico, on_delete=models.CASCADE, related_name='detalles_diarios')

    fecha = models.DateField(help_text="Fecha específica del evento")

    monto_asignado = models.DecimalField(max_digits=10, decimal_places=2, verbose_name="Monto Asignado", help_text="Monto específico para esta fecha")

    motivo_variacion = models.TextField(blank=True, help_text="Motivo de la variación del monto")

    aprobado_por = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True, related_name='montos_diarios_aprobados')

    fecha_aprobacion = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, null=True)



    class Meta:

        unique_together = ['contrato', 'fecha']

        verbose_name = 'Detalle de Monto Diario'

        verbose_name_plural = 'Detalles de Montos Diarios'



    def __str__(self):

        return f"{self.contrato.musico.nombre_completo} - {self.fecha} - ${self.monto_asignado}"





class Asistencia(models.Model):

    ESTADOS = [

        ('PRESENTE', 'Presente'),

        ('TARDANZA', 'Tardanza'),

        ('AUSENTE', 'Ausente'),

        ('JUSTIFICADO', 'Justificado'),

    ]



    musico = models.ForeignKey(Musico, on_delete=models.CASCADE)

    evento = models.ForeignKey(Evento, on_delete=models.CASCADE)

    estado = models.CharField(max_length=20, choices=ESTADOS, default='AUSENTE')

    hora_llegada = models.TimeField(null=True, blank=True)

    observaciones = models.TextField(blank=True)

    contrato = models.ForeignKey(ContratoMusico, on_delete=models.SET_NULL, null=True, blank=True, help_text="Contrato personalizado para este evento")

    fecha_asistencia = models.DateField(default=timezone.localdate, help_text="Fecha específica de asistencia (para eventos multi-día)")

    monto_acordado = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name="Monto Acordado", help_text="Pago asignado por el directorio para este día específico")

    liquidado = models.BooleanField(default=False, help_text="Indica si este día ya fue pagado")



    @property

    def minutos_tardanza(self):

        if not self.hora_llegada:

            return 0



        configura = ConfiguracionSistema.objects.first()

        if configura and configura.hora_limite_tardanza:

            hora_citada = configura.hora_limite_tardanza

        else:

            hora_citada = self.evento.fecha_hora_cita.time()



        llegada = datetime.datetime.combine(self.evento.fecha_hora_cita.date(), self.hora_llegada)

        citada = datetime.datetime.combine(self.evento.fecha_hora_cita.date(), hora_citada)

        if llegada > citada:

            return (llegada - citada).total_seconds() / 60

        return 0



    class Meta:

        unique_together = ['musico', 'evento']

        verbose_name = 'Asistencia'

        verbose_name_plural = 'Asistencias'





class JefeSeccion(models.Model):

    """Jefes de sección que controlan los descuentos de los músicos"""

    musico = models.OneToOneField(Musico, on_delete=models.CASCADE, related_name='jefe_seccion')

    seccion = models.CharField(max_length=50, choices=Musico.INSTRUMENTOS)

    activo = models.BooleanField(default=True)

    fecha_nombramiento = models.DateField(default=timezone.localdate)



    def __str__(self):

        return f"Jefe de {self.get_seccion_display()}: {self.musico.nombre_completo}"



    class Meta:

        verbose_name = 'Jefe de Sección'

        verbose_name_plural = 'Jefes de Sección'





class Descuento(models.Model):

    """Descuentos por faltas registrados por jefe de sección"""

    ESTADOS = [

        ('APROBADA', 'Aprobada'),

        ('LIQUIDADA', 'Liquidada en Pago')

    ]



    ORIGEN = [

        ('APP_MOVIL', 'App Móvil'),

        ('FRONTEND', 'Frontend'),

    ]



    uuid = models.UUIDField(default=uuid.uuid4, editable=False, unique=True, null=True)

    musico = models.ForeignKey(Musico, on_delete=models.CASCADE, related_name='descuentos')

    evento = models.ForeignKey(Evento, on_delete=models.CASCADE, related_name='descuentos', null=True, blank=True, help_text="Evento o contrato en el que ocurrió la falta")

    jefe_seccion = models.ForeignKey(JefeSeccion, on_delete=models.CASCADE, related_name="descuentos_aplicados", null=True, blank=True)

    monto = models.DecimalField(max_digits=10, decimal_places=2)

    motivo = models.TextField(help_text="Descripción detallada de la falta")

    fecha_falta = models.DateField(null=True, blank=True)

    origen = models.CharField(max_length=20, choices=ORIGEN, default='FRONTEND')

    estado = models.CharField(max_length=20, choices=ESTADOS, default='APROBADA')

    creado_en = models.DateTimeField(auto_now_add=True, null=True)



    def __str__(self):

        return f"{self.musico.nombre_completo} - ${self.monto} - {self.get_estado_display()}"



    class Meta:

        ordering = ['-fecha_falta']

        verbose_name = 'Descuento'

        verbose_name_plural = 'Descuentos'

        indexes = [

            models.Index(fields=['musico', '-fecha_falta']),

            models.Index(fields=['jefe_seccion', '-fecha_falta']),

        ]





class Adelanto(models.Model):

    """Adelantos registrados por el directorio al contratar"""

    ESTADOS = [

        ('APROBADA', 'Aprobada'),

        ('LIQUIDADA', 'Liquidada en Pago')

    ]



    ORIGEN = [

        ('APP_MOVIL', 'App Móvil'),

        ('FRONTEND', 'Frontend'),

    ]



    musico = models.ForeignKey(Musico, on_delete=models.CASCADE, related_name='adelantos')

    contrato = models.ForeignKey(ContratoMusico, on_delete=models.CASCADE, related_name='adelantos', null=True, blank=True)

    monto = models.DecimalField(max_digits=10, decimal_places=2)

    motivo = models.CharField(max_length=200)

    fecha = models.DateField(default=timezone.localdate)

    origen = models.CharField(max_length=20, choices=ORIGEN, default='FRONTEND')

    estado = models.CharField(max_length=20, choices=ESTADOS, default='APROBADA')

    registrado_por = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True, related_name='adelantos_registrados')

    creado_en = models.DateTimeField(auto_now_add=True, null=True)



    def __str__(self):

        return f"{self.musico.nombre_completo} - ${self.monto} (Adelanto)"



    class Meta:

        ordering = ['-fecha']

        verbose_name = 'Adelanto'

        verbose_name_plural = 'Adelantos'

        indexes = [

            models.Index(fields=['musico', '-fecha']),

        ]





class PlanillaLiquidacion(models.Model):

    ORIGEN = [

        ('APP_MOVIL', 'App Móvil'),

        ('FRONTEND', 'Frontend'),

    ]



    titulo = models.CharField(max_length=200)

    eventos = models.ManyToManyField(Evento, blank=True, related_name='planillas')

    fecha_creacion = models.DateTimeField(auto_now_add=True, null=True)

    completada = models.BooleanField(default=False)

    observaciones = models.TextField(blank=True)

    origen = models.CharField(max_length=20, choices=ORIGEN, default='FRONTEND')

    registrado_por = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True, related_name='planillas_registradas')



    def __str__(self):

        return self.titulo



    class Meta:

        ordering = ['-fecha_creacion']

        verbose_name = 'Planilla de Liquidación'

        verbose_name_plural = 'Planillas de Liquidación'





class Pago(models.Model):

    """Liquidación final de pago a músicos"""

    ESTADOS = [

        ('PENDIENTE', 'Pendiente'),

        ('PAGADO', 'Pagado'),

    ]



    musico = models.ForeignKey(Musico, on_delete=models.CASCADE, related_name='pagos')

    planilla = models.ForeignKey(PlanillaLiquidacion, on_delete=models.CASCADE, related_name='pagos', null=True, blank=True)



    salario_base = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Salario Base', default=0)

    descuentos_totales = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="Suma de descuentos aprobados")

    adelantos_totales = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="Suma de adelantos (deudas) aprobados")

    neto_pagar = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="salario_base - descuentos_totales - adelantos_totales")



    estado = models.CharField(max_length=20, choices=ESTADOS, default='PENDIENTE')

    fecha_liquidacion = models.DateTimeField(auto_now_add=True, null=True)

    pagado_en = models.DateTimeField(null=True, blank=True)

    observaciones = models.TextField(blank=True)

    origen = models.CharField(max_length=20, choices=PlanillaLiquidacion.ORIGEN, null=True, blank=True)

    registrado_por = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True, related_name='pagos_registrados')



    def calcular_totales(self):

        """Calcula automáticamente descuentos y adelantos del músico"""

        desc = Descuento.objects.filter(

            musico=self.musico,

            estado='APROBADA'

        ).aggregate(total=models.Sum('monto'))['total'] or Decimal('0.00')



        adelanto = Adelanto.objects.filter(

            musico=self.musico,

            estado='APROBADA'

        ).aggregate(total=models.Sum('monto'))['total'] or Decimal('0.00')



        self.descuentos_totales = desc

        self.adelantos_totales = adelanto

        self.neto_pagar = self.salario_base - self.descuentos_totales - self.adelantos_totales # CORRECCIÓN MATEMÁTICA: Restar adelantos



    def save(self, *args, **kwargs):

        super().save(*args, **kwargs)



    def __str__(self):

        return f"{self.musico.nombre_completo} - ${self.neto_pagar}"



    class Meta:

        ordering = ['-fecha_liquidacion']

        verbose_name = 'Pago'

        verbose_name_plural = 'Pagos'





class RendimientoMusico(models.Model):

    musico = models.OneToOneField(Musico, on_delete=models.CASCADE, related_name='rendimiento')

    score_lealtad = models.IntegerField(default=0)

    porcentaje_asistencia = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    puntualidad_promedio = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    antiguedad_meses = models.IntegerField(default=0)

    total_descuentos = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    ultima_actualizacion = models.DateTimeField(auto_now=True)



    def calcular_score_lealtad(self):

        """Calcula el score de lealtad basado en 4 componentes (máx 100 puntos)."""

        puntualidad = float(self.puntualidad_promedio)

        asistencia = float(self.porcentaje_asistencia)

        descuentos = float(self.total_descuentos)



        # Asistencia: 0-40 puntos (40% del peso)

        score_asistencia = min(asistencia * 0.4, 40)



        # Puntualidad: 0-30 puntos (mayor puntualidad = mayor score)

        score_puntualidad = min(puntualidad * 0.3, 30)



        # Antigüedad: 0-20 puntos (máx a los 40 meses)

        score_antiguedad = min(self.antiguedad_meses * 0.5, 20)



        # Descuentos: 0-10 puntos (penaliza descuentos acumulados)

        score_descuentos = max(10 - (descuentos * 0.1), 0)



        self.score_lealtad = int(score_asistencia + score_puntualidad + score_antiguedad + score_descuentos)

        self.save()



    def __str__(self):

        return f"{self.musico.nombre_completo} - Score: {self.score_lealtad}"



    class Meta:

        ordering = ['-score_lealtad']

        verbose_name = 'Rendimiento de Músico'

        verbose_name_plural = 'Rendimientos de Músicos'





def default_hora_tardanza():

    return datetime.time(19, 5)



class ConfiguracionSistema(models.Model):

    nombre_banda = models.CharField(max_length=200, default="Banda de Música")

    monto_por_evento = models.DecimalField(max_digits=10, decimal_places=2, default=100.00)

    hora_limite_tardanza = models.TimeField(default=default_hora_tardanza)

    email_director = models.EmailField(blank=True)

    telefono_contacto = models.CharField(max_length=20, blank=True)



    def __str__(self):

        return self.nombre_banda



    class Meta:

        verbose_name = 'Configuración del Sistema'

        verbose_name_plural = 'Configuraciones del Sistema'





class Deuda(models.Model):

    """Representa una deuda de un músico por financiamiento (ej. compra de instrumentos)"""

    musico = models.ForeignKey(Musico, on_delete=models.CASCADE, related_name='deudas')

    motivo = models.CharField(max_length=200)

    monto_total = models.DecimalField(max_digits=10, decimal_places=2)

    monto_pagado = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    fecha_creacion = models.DateField(default=timezone.localdate)

    estado = models.CharField(max_length=20, choices=[('PENDIENTE', 'Pendiente'), ('PAGADA', 'Pagada')], default='PENDIENTE')

    observaciones = models.TextField(blank=True)



    @property

    def saldo_restante(self):

        return self.monto_total - self.monto_pagado



    def check_estado(self):

        if self.monto_pagado >= self.monto_total:

            self.estado = 'PAGADA'

        else:

            self.estado = 'PENDIENTE'

        self.save()



    def __str__(self):

        return f"{self.musico.nombre_completo} - {self.motivo} ({self.saldo_restante} restantes)"



    class Meta:

        ordering = ['-fecha_creacion']

        verbose_name = 'Deuda/Financiamiento'

        verbose_name_plural = 'Deudas/Financiamientos'





class AbonoDeuda(models.Model):

    """Pagos parciales o totales de una deuda, usualmente descontados en liquidaciones"""

    deuda = models.ForeignKey(Deuda, on_delete=models.CASCADE, related_name='abonos')

    planilla = models.ForeignKey('PlanillaLiquidacion', on_delete=models.SET_NULL, null=True, blank=True, related_name='abonos_deuda')

    monto = models.DecimalField(max_digits=10, decimal_places=2)

    fecha = models.DateField(default=timezone.localdate)



    def save(self, *args, **kwargs):

        super().save(*args, **kwargs)

        pagado = self.deuda.abonos.aggregate(total=models.Sum('monto'))['total'] or 0

        self.deuda.monto_pagado = pagado

        self.deuda.check_estado()



    def __str__(self):

        return f"Abono de ${self.monto} a {self.deuda.motivo}"



    class Meta:

        ordering = ['-fecha']

        verbose_name = 'Abono de Deuda'

        verbose_name_plural = 'Abonos de Deudas'





class CampanaCanaston(models.Model):

    """Campaña de canastón - período de evaluación para incentivos"""

    titulo = models.CharField(max_length=200)

    fecha_inicio_calculo = models.DateField(help_text="Fecha inicio para cálculo de rendimiento")

    fecha_fin_calculo = models.DateField(help_text="Fecha fin para cálculo de rendimiento")

    fecha_entrega = models.DateField(null=True, blank=True, help_text="Fecha prevista para entrega de canastones")

    estado = models.CharField(max_length=20, choices=[('ABIERTO', 'Abierto'), ('CERRADO', 'Cerrado')], default='ABIERTO')

    observaciones = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True, null=True)



    def __str__(self):

        return f"{self.titulo} ({self.fecha_inicio_calculo} - {self.fecha_fin_calculo})"



    class Meta:

        ordering = ['-created_at']

        verbose_name = 'Campaña de Canastón'

        verbose_name_plural = 'Campañas de Canastón'





class ResultadoCanaston(models.Model):

    """Resultado de evaluación de un músico en una campaña de canastón"""

    ESTADOS_ENTREGA = [

        ('PENDIENTE', 'Pendiente de Entrega'),

        ('ENTREGADO', 'Entregado'),

        ('NO_ELEGIBLE', 'No Elegible'),

    ]



    campana = models.ForeignKey(CampanaCanaston, on_delete=models.CASCADE, related_name='resultados')

    musico = models.ForeignKey(Musico, on_delete=models.CASCADE, related_name='resultados_canaston')

    score_lealtad_snapshot = models.IntegerField(help_text="Score de lealtad al momento del cálculo")

    porcentaje_asistencia_snapshot = models.DecimalField(max_digits=5, decimal_places=2, help_text="Porcentaje de asistencia en el período")

    es_elegible = models.BooleanField(default=False, help_text="Cumple con los requisitos para recibir canastón")

    estado_entrega = models.CharField(max_length=20, choices=ESTADOS_ENTREGA, default='PENDIENTE')

    fecha_calculo = models.DateTimeField(auto_now_add=True, null=True)



    def __str__(self):

        return f"{self.musico.nombre_completo} - {self.campana.titulo} ({'Elegible' if self.es_elegible else 'No Elegible'})"



    class Meta:

        unique_together = ['campana', 'musico']

        ordering = ['-score_lealtad_snapshot']

        verbose_name = 'Resultado de Canastón'

        verbose_name_plural = 'Resultados de Canastón'
