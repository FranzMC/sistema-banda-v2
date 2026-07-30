import uuid
from rest_framework import serializers
from decimal import Decimal
from decimal import Decimal
from django.db.models import Sum
from ..models import (
    Usuario, Modulo, RolModulo, UsuarioModulo, Musico, Evento, Asistencia, Descuento,
    Pago, RendimientoMusico, ConfiguracionSistema, Adelanto, PlanillaLiquidacion,
    ContratoMusico, DetalleMontoDiario, JefeSeccion, Deuda, AbonoDeuda,
    CampanaCanaston, ResultadoCanaston
)

class RendimientoSerializer(serializers.ModelSerializer):
    class Meta:
        model = RendimientoMusico
        fields = '__all__'


class MusicoSerializer(serializers.ModelSerializer):
    rendimiento = RendimientoSerializer(read_only=True)
    def get_fields(self):
        fields = super().get_fields()
        from .usuarios_serializers import UsuarioSerializer
        fields['usuario'] = UsuarioSerializer(read_only=True)
        return fields
    nombre_completo = serializers.CharField(read_only=True)
    ocupado_en_fecha = serializers.BooleanField(read_only=True, required=False)
    evento_ocupado_titulo = serializers.CharField(read_only=True, required=False)

    class Meta:
        model = Musico
        fields = ['id', 'usuario', 'documento_identidad', 'nombres', 'apellidos', 'telefono', 'direccion',
                  'talla_camisa', 'talla_chamarra', 'numero_calzado', 'instrumento', 'nivel',
                  'fecha_nacimiento', 'foto_perfil', 'orden', 'activo', 'created_at', 'rendimiento', 'nombre_completo',
                  'ocupado_en_fecha', 'evento_ocupado_titulo']

    def validate_documento_identidad(self, value):
        if not value:
            return value

        qs = Musico.objects.filter(documento_identidad=value)
        if self.instance:
            qs = qs.exclude(id=self.instance.id)

        if qs.exists():
            raise serializers.ValidationError("Ya existe Músico con este Documento de Identidad.")
        return value


class MusicoListSerializer(serializers.ModelSerializer):
    """Serializer ligero para listados (app móvil)"""
    nombre_completo = serializers.CharField(read_only=True)
    
    class Meta:
        model = Musico
        fields = ['id', 'nombre_completo', 'documento_identidad', 'instrumento', 'nivel', 'activo']


class ContratoMusicoSerializer(serializers.ModelSerializer):
    musico_nombre = serializers.CharField(source='musico.nombre_completo', read_only=True)
    evento_titulo = serializers.CharField(source='evento.titulo', read_only=True)
    aprobado_por_nombre = serializers.CharField(source='aprobado_por.get_full_name', read_only=True)
    def get_fields(self):
        fields = super().get_fields()
        from .finanzas_serializers import DetalleMontoDiarioSerializer
        fields['detalles_diarios'] = DetalleMontoDiarioSerializer(many=True, read_only=True)
        return fields
    monto_total_calculado = serializers.SerializerMethodField()

    class Meta:
        model = ContratoMusico
        fields = '__all__'

    def get_monto_total_calculado(self, obj):
        if obj.detalles_diarios.exists():
            return obj.detalles_diarios.aggregate(total=Sum('monto_asignado'))['total'] or Decimal('0.00')
        return obj.monto_diario


class JefeSeccionSerializer(serializers.ModelSerializer):
    musico_nombre = serializers.CharField(source='musico.nombre_completo', read_only=True)
    seccion_display = serializers.CharField(source='get_seccion_display', read_only=True)

    class Meta:
        model = JefeSeccion
        fields = '__all__'
