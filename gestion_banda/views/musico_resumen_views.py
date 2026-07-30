from rest_framework import views, status, permissions
from rest_framework.response import Response
from django.db.models import Sum
from django.utils import timezone
from datetime import datetime, date
from decimal import Decimal

from ..models import (
    Musico, Asistencia, Descuento, Pago, Deuda, Adelanto
)

class MusicoResumenView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            musico = request.user.perfil_musico
        except Musico.DoesNotExist:
            return Response({"error": "El usuario no tiene un perfil de músico asociado."}, status=status.HTTP_400_BAD_REQUEST)

        year = timezone.localdate().year
        
        # Filtros de fecha (opcionales)
        fecha_inicio_str = request.query_params.get('fecha_inicio')
        fecha_fin_str = request.query_params.get('fecha_fin')
        
        if fecha_inicio_str and fecha_fin_str:
            try:
                fecha_inicio = datetime.strptime(fecha_inicio_str, '%Y-%m-%d').date()
                fecha_fin = datetime.strptime(fecha_fin_str, '%Y-%m-%d').date()
            except ValueError:
                fecha_inicio = date(year, 1, 1)
                fecha_fin = date(year, 12, 31)
        else:
            fecha_inicio = date(year, 1, 1)
            fecha_fin = date(year, 12, 31)

        # 1. Pagos del año
        pagos_anuales = Pago.objects.filter(
            musico=musico,
            estado='PAGADO',
            fecha_liquidacion__year=year
        ).order_by('-fecha_liquidacion')
        
        total_pagado = pagos_anuales.aggregate(total=Sum('neto_pagar'))['total'] or Decimal('0.00')
        
        lista_pagos = [
            {
                "id": p.id,
                "neto_pagar": str(p.neto_pagar),
                "fecha": p.pagado_en.strftime('%Y-%m-%d') if p.pagado_en else p.fecha_liquidacion.strftime('%Y-%m-%d'),
                "planilla": p.planilla.titulo if p.planilla else "Sin planilla"
            } for p in pagos_anuales
        ]

        # 2. Contratos (Eventos)
        asistencias_anuales = Asistencia.objects.filter(
            musico=musico,
            fecha_asistencia__year=year,
            estado__in=['PRESENTE', 'TARDANZA']
        )
        total_contratos_asistidos = asistencias_anuales.count()
        contratos_pagados = asistencias_anuales.filter(liquidado=True).count()
        contratos_pendientes = asistencias_anuales.filter(liquidado=False).count()

        lista_contratos = []
        for a in asistencias_anuales:
            pago = Pago.objects.filter(musico=musico, planilla__eventos=a.evento).first()
            if pago:
                adelantos = pago.adelantos_totales
                descuentos = pago.descuentos_totales
                saldo = pago.neto_pagar
                estado_pago = pago.estado
            else:
                adelantos = Decimal('0.00')
                descuentos = Decimal('0.00')
                saldo = a.monto_acordado
                estado_pago = 'PENDIENTE'

            lista_contratos.append({
                "id": a.id,
                "evento": a.evento.titulo,
                "fecha": a.fecha_asistencia.strftime('%Y-%m-%d'),
                "monto_acordado": str(a.monto_acordado),
                "adelantos": str(adelantos),
                "descuentos": str(descuentos),
                "saldo": str(saldo),
                "estado": estado_pago
            })

        # 3. Descuentos (usando fecha_inicio y fecha_fin)
        descuentos_periodo = Descuento.objects.filter(
            musico=musico,
            fecha_falta__gte=fecha_inicio,
            fecha_falta__lte=fecha_fin
        ).order_by('-fecha_falta')
        
        total_descuentos_periodo = descuentos_periodo.aggregate(total=Sum('monto'))['total'] or Decimal('0.00')
        contratos_con_descuento = descuentos_periodo.values('evento').distinct().count()

        lista_descuentos = [
            {
                "id": d.id,
                "evento": d.evento.titulo if d.evento else "S/E",
                "monto": str(d.monto),
                "motivo": d.motivo,
                "fecha": d.fecha_falta.strftime('%Y-%m-%d') if d.fecha_falta else "",
                "estado": d.get_estado_display()
            } for d in descuentos_periodo
        ]

        # 4. Deudas y Adelantos Pendientes
        deudas_pendientes = Deuda.objects.filter(musico=musico, estado='PENDIENTE')
        total_deuda = sum([d.saldo_restante for d in deudas_pendientes])

        adelantos_pendientes = Adelanto.objects.filter(musico=musico, estado='APROBADA')
        total_adelantos = adelantos_pendientes.aggregate(total=Sum('monto'))['total'] or Decimal('0.00')

        return Response({
            "pagos": {
                "total_anual": str(total_pagado),
                "historial": lista_pagos
            },
            "contratos": {
                "total_asistidos_anual": total_contratos_asistidos,
                "pagados": contratos_pagados,
                "pendientes": contratos_pendientes,
                "historial_contratos": lista_contratos
            },
            "descuentos": {
                "periodo": f"{fecha_inicio.strftime('%d/%m/%Y')} a {fecha_fin.strftime('%d/%m/%Y')}",
                "total_monto": str(total_descuentos_periodo),
                "contratos_afectados": contratos_con_descuento,
                "historial": lista_descuentos
            },
            "deudas": {
                "total_deudas": str(total_deuda),
                "total_adelantos": str(total_adelantos)
            }
        })
