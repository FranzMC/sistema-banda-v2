import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from gestion_banda.models import Modulo, RolModulo, ConfiguracionSistema

# Crear config sistema si no existe
ConfiguracionSistema.objects.get_or_create(id=1, defaults={'hora_limite_tardanza': '08:00:00'})

opciones = [
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
]

for clave, nombre in opciones:
    m, _ = Modulo.objects.get_or_create(clave=clave, defaults={'nombre': nombre})
    RolModulo.objects.get_or_create(rol='PRESIDENTE', modulo=m)
    RolModulo.objects.get_or_create(rol='DIRECTOR', modulo=m)

print("Módulos y roles creados correctamente.")
