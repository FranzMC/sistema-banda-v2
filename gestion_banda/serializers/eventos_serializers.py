import uuid
from rest_framework import serializers
from decimal import Decimal
from decimal import Decimal
from ..models import (
    Usuario, Modulo, RolModulo, UsuarioModulo, Musico, Evento, Asistencia, Descuento,
    Pago, RendimientoMusico, ConfiguracionSistema, Adelanto, PlanillaLiquidacion,
    ContratoMusico, DetalleMontoDiario, JefeSeccion, Deuda, AbonoDeuda,
    CampanaCanaston, ResultadoCanaston
)

class AsistenciaSerializer(serializers.ModelSerializer):
    musico_nombre = serializers.CharField(source='musico.nombre_completo', read_only=True)
    evento_titulo = serializers.CharField(source='evento.titulo', read_only=True)

    class Meta:
        model = Asistencia
        fields = '__all__'


class EventoSerializer(serializers.ModelSerializer):
    asistencias = AsistenciaSerializer(source='asistencia_set', many=True, read_only=True)

    class Meta:
        model = Evento
        fields = '__all__'


class AsistenciaExtendedSerializer(serializers.ModelSerializer):
    musico_nombre = serializers.CharField(source='musico.nombre_completo', read_only=True)
    evento_titulo = serializers.CharField(source='evento.titulo', read_only=True)
    def get_fields(self):
        fields = super().get_fields()
        from .musicos_serializers import ContratoMusicoSerializer
        fields['contrato_detalle'] = ContratoMusicoSerializer(source='contrato', read_only=True)
        return fields

    class Meta:
        model = Asistencia
        fields = '__all__'
