from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import (
    Usuario, Musico, Evento, Asistencia, Descuento, Pago, 
    RendimientoMusico, ConfiguracionSistema, Adelanto, PlanillaLiquidacion,
    Modulo, RolModulo, UsuarioModulo
)

@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    list_display = ('username', 'email', 'first_name', 'last_name', 'rol', 'is_staff')
    list_filter = ('rol', 'is_staff', 'is_superuser', 'is_active')
    search_fields = ('username', 'first_name', 'last_name', 'email')
    
    fieldsets = UserAdmin.fieldsets + (
        ('Información Adicional', {'fields': ('rol', 'telefono')}),
    )

@admin.register(Musico)
class MusicoAdmin(admin.ModelAdmin):
    list_display = ('orden', 'nombre_completo', 'documento_identidad', 'telefono', 'instrumento', 'nivel', 'fecha_nacimiento', 'activo')
    list_filter = ('instrumento', 'nivel', 'activo')
    search_fields = ('nombres', 'apellidos', 'documento_identidad', 'telefono')
    ordering = ('orden', 'apellidos', 'nombres')
    
    fieldsets = (
        ('Información Personal', {
            'fields': ('usuario', 'documento_identidad', 'nombres', 'apellidos', 'telefono', 'direccion', 'fecha_nacimiento', 'foto_perfil')
        }),
        ('Datos de Uniforme', {
            'fields': ('talla_camisa', 'talla_chamarra', 'numero_calzado')
        }),
        ('Información Musical', {
            'fields': ('orden', 'instrumento', 'nivel', 'activo')
        }),
    )

@admin.register(Evento)
class EventoAdmin(admin.ModelAdmin):
    list_display = ('titulo', 'uniforme_display', 'fecha_hora_cita', 'lugar_concentracion')
    list_filter = ('uniforme',)
    search_fields = ('titulo', 'lugar_concentracion')
    ordering = ('-fecha_hora_cita',)
    filter_horizontal = ('convocados',)
    
    def uniforme_display(self, obj):
        if obj.uniforme == 'OTRO':
            return obj.uniforme_personalizado
        return obj.get_uniforme_display()
    uniforme_display.short_description = 'Uniforme'

@admin.register(Asistencia)
class AsistenciaAdmin(admin.ModelAdmin):
    list_display = ('musico', 'evento', 'estado', 'hora_llegada', 'minutos_tardanza', 'monto_acordado')
    list_filter = ('estado', 'evento__fecha_hora_cita')
    search_fields = ('musico__nombres', 'musico__apellidos', 'evento__titulo')
    ordering = ('-evento__fecha_hora_cita', 'musico__apellidos')
    list_editable = ('monto_acordado', 'estado')
    
    def minutos_tardanza(self, obj):
        return f"{obj.minutos_tardanza:.0f} min" if obj.minutos_tardanza > 0 else "A tiempo"
    minutos_tardanza.short_description = 'Tardanza'

@admin.register(Descuento)
class DescuentoAdmin(admin.ModelAdmin):
    list_display = ('musico', 'monto', 'motivo', 'fecha_falta',  'estado')
    list_filter = ('estado', 'fecha_falta')
    search_fields = ('musico__nombres', 'musico__apellidos', 'motivo')
    ordering = ('-fecha_falta',)

@admin.register(Adelanto)
class AdelantoAdmin(admin.ModelAdmin):
    list_display = ('musico', 'monto', 'motivo', 'fecha', 'estado')
    list_filter = ('estado', 'fecha')
    search_fields = ('musico__nombres', 'musico__apellidos', 'motivo')
    ordering = ('-fecha',)

@admin.register(PlanillaLiquidacion)
class PlanillaLiquidacionAdmin(admin.ModelAdmin):
    list_display = ('titulo', 'fecha_creacion', 'completada')
    list_filter = ('completada', 'fecha_creacion')
    search_fields = ('titulo', 'observaciones')
    filter_horizontal = ('eventos',)

@admin.register(Pago)
class PagoAdmin(admin.ModelAdmin):
    list_display = ('musico', 'planilla', 'salario_base', 'descuentos_totales', 'adelantos_totales', 'neto_pagar', 'fecha_liquidacion', 'estado')
    list_filter = ('estado', 'fecha_liquidacion')
    search_fields = ('musico__nombres', 'musico__apellidos', 'planilla__titulo')
    ordering = ('-fecha_liquidacion',)

@admin.register(RendimientoMusico)
class RendimientoMusicoAdmin(admin.ModelAdmin):
    list_display = ('musico', 'score_lealtad', 'porcentaje_asistencia', 'puntualidad_promedio')
    search_fields = ('musico__nombres', 'musico__apellidos')
    ordering = ('-score_lealtad',)

@admin.register(ConfiguracionSistema)
class ConfiguracionSistemaAdmin(admin.ModelAdmin):
    list_display = ('nombre_banda', 'monto_por_evento', 'hora_limite_tardanza')


@admin.register(Modulo)
class ModuloAdmin(admin.ModelAdmin):
    list_display = ('clave', 'nombre', 'activo')
    list_filter = ('activo',)
    search_fields = ('clave', 'nombre')


@admin.register(RolModulo)
class RolModuloAdmin(admin.ModelAdmin):
    list_display = ('rol', 'modulo')
    list_filter = ('rol',)
    search_fields = ('modulo__nombre', 'modulo__clave')

@admin.register(UsuarioModulo)
class UsuarioModuloAdmin(admin.ModelAdmin):
    list_display = ('usuario', 'modulo')
    list_filter = ('usuario__rol', 'modulo__activo')
    search_fields = ('usuario__username', 'modulo__clave', 'modulo__nombre')

admin.site.site_header = 'Sistema de Gestión de Banda'
admin.site.site_title = 'Administración'
admin.site.index_title = 'Panel de Finanzas y Músicos'
