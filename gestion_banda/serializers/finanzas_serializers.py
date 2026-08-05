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

class DescuentoSerializer(serializers.ModelSerializer):
    musico_nombre = serializers.CharField(source='musico.nombre_completo', read_only=True)
    seccion = serializers.CharField(source='musico.get_instrumento_display', read_only=True)
    evento_titulo = serializers.CharField(source='evento.titulo', read_only=True)

    class Meta:
        model = Descuento
        fields = '__all__'


class AdelantoSerializer(serializers.ModelSerializer):
    musico_nombre = serializers.CharField(source='musico.nombre_completo', read_only=True)
    seccion = serializers.CharField(source='musico.instrumento', read_only=True)
    evento_titulo = serializers.SerializerMethodField()
    evento_id = serializers.SerializerMethodField()

    def get_evento_titulo(self, obj):
        try:
            return obj.contrato.evento.titulo if obj.contrato and obj.contrato.evento else None
        except Exception:
            return None

    def get_evento_id(self, obj):
        try:
            return obj.contrato.evento_id if obj.contrato else None
        except Exception:
            return None

    class Meta:
        model = Adelanto
        fields = '__all__'


class PlanillaLiquidacionSerializer(serializers.ModelSerializer):
    def get_fields(self):
        fields = super().get_fields()
        from .eventos_serializers import EventoSerializer
        fields['eventos_detalles'] = EventoSerializer(source='eventos', many=True, read_only=True)
        return fields

    class Meta:
        model = PlanillaLiquidacion
        fields = '__all__'


class PagoSerializer(serializers.ModelSerializer):
    musico_nombre = serializers.CharField(source='musico.nombre_completo', read_only=True)
    planilla_titulo = serializers.CharField(source='planilla.titulo', read_only=True)

    class Meta:
        model = Pago
        fields = '__all__'


class PlanillaLiquidacionDetalleSerializer(serializers.ModelSerializer):
    def get_fields(self):
        fields = super().get_fields()
        from .eventos_serializers import EventoSerializer
        fields['eventos_detalles'] = EventoSerializer(source='eventos', many=True, read_only=True)
        fields['pagos_detalles'] = PagoSerializer(source='pagos', many=True, read_only=True)
        return fields
    total_pagos = serializers.SerializerMethodField()

    class Meta:
        model = PlanillaLiquidacion
        fields = '__all__'

    def get_total_pagos(self, obj):
        from django.db.models import Sum
        return obj.pagos.aggregate(total=Sum('neto_pagar'))['total'] or Decimal('0.00')


class DetalleMontoDiarioSerializer(serializers.ModelSerializer):
    musico_nombre = serializers.CharField(source='contrato.musico.nombre_completo', read_only=True)
    evento_titulo = serializers.CharField(source='contrato.evento.titulo', read_only=True)
    aprobado_por_nombre = serializers.CharField(source='aprobado_por.get_full_name', read_only=True)

    class Meta:
        model = DetalleMontoDiario
        fields = '__all__'


class DeudaSerializer(serializers.ModelSerializer):
    musico_nombre = serializers.CharField(source='musico.nombre_completo', read_only=True)
    saldo_restante = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = Deuda
        fields = '__all__'


class AbonoDeudaSerializer(serializers.ModelSerializer):
    deuda_motivo = serializers.CharField(source='deuda.motivo', read_only=True)
    musico_nombre = serializers.CharField(source='deuda.musico.nombre_completo', read_only=True)

    class Meta:
        model = AbonoDeuda
        fields = '__all__'
