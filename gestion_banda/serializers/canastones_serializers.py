import uuid
from rest_framework import serializers
from django.db.models import Sum
from decimal import Decimal
from ..models import (
    Usuario, Modulo, RolModulo, UsuarioModulo, Musico, Evento, Asistencia, Descuento,
    Pago, RendimientoMusico, ConfiguracionSistema, Adelanto, PlanillaLiquidacion,
    ContratoMusico, DetalleMontoDiario, JefeSeccion, Deuda, AbonoDeuda,
    CampanaCanaston, ResultadoCanaston
)

class CampanaCanastonSerializer(serializers.ModelSerializer):
    class Meta:
        model = CampanaCanaston
        fields = '__all__'


class ResultadoCanastonSerializer(serializers.ModelSerializer):
    musico_nombre = serializers.CharField(source='musico.nombre_completo', read_only=True)
    musico_instrumento = serializers.CharField(source='musico.get_instrumento_display', read_only=True)
    campana_titulo = serializers.CharField(source='campana.titulo', read_only=True)

    class Meta:
        model = ResultadoCanaston
        fields = '__all__'
