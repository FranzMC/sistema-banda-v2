from django.core.management.base import BaseCommand
from gestion_banda.models import Modulo, RolModulo

class Command(BaseCommand):
    help = 'Inicializa los módulos del sistema y asigna permisos por rol'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('=== Inicializando Módulos del Sistema ===\n'))
        
        # Definición de módulos
        modulos_definicion = [
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

        # Crear módulos si no existen
        modulos_creados = 0
        for clave, nombre in modulos_definicion:
            modulo, created = Modulo.objects.get_or_create(
                clave=clave,
                defaults={'nombre': nombre, 'activo': True}
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'✓ Módulo creado: {clave} - {nombre}'))
                modulos_creados += 1
            else:
                self.stdout.write(self.style.WARNING(f'- Módulo ya existe: {clave}'))
        
        if modulos_creados == 0:
            self.stdout.write(self.style.WARNING('No se crearon módulos nuevos'))
        else:
            self.stdout.write(self.style.SUCCESS(f'Total módulos creados: {modulos_creados}'))

        # Definición de permisos por rol
        permisos_por_rol = {
            'PRESIDENTE': [
                'DASHBOARD', 'MUSICOS', 'EVENTOS', 'LIQUIDACIONES', 
                'FINANCIAMIENTO', 'DESCUENTOS', 'ADELANTOS', 'ADMIN_USUARIOS', 'CANASTON'
            ],
            'DIRECTOR': [
                'DASHBOARD', 'MUSICOS', 'EVENTOS', 'LIQUIDACIONES', 
                'FINANCIAMIENTO', 'DESCUENTOS', 'ADELANTOS', 'CANASTON'
            ],
            'SUBDIRECTOR': [
                'DASHBOARD', 'MUSICOS', 'EVENTOS', 'LIQUIDACIONES', 
                'FINANCIAMIENTO', 'DESCUENTOS', 'ADELANTOS', 'CANASTON'
            ],
            'JEFE_SECCION': [
                'DASHBOARD', 'MUSICOS', 'EVENTOS', 'DESCUENTOS', 'CANASTON'
            ],
            'MUSICO': [
                'DASHBOARD', 'EVENTOS', 'DESCUENTOS', 'CANASTON'
            ],
        }

        # Limpiar asignaciones existentes y crear nuevas
        self.stdout.write(self.style.WARNING('\n=== Asignando Módulos por Rol ==='))
        RolModulo.objects.all().delete()
        
        asignaciones_creadas = 0
        for rol, modulos_claves in permisos_por_rol.items():
            self.stdout.write(self.style.WARNING(f'\nRol: {rol}'))
            for clave in modulos_claves:
                try:
                    modulo = Modulo.objects.get(clave=clave)
                    RolModulo.objects.create(rol=rol, modulo=modulo)
                    self.stdout.write(self.style.SUCCESS(f'  ✓ {clave}'))
                    asignaciones_creadas += 1
                except Modulo.DoesNotExist:
                    self.stdout.write(self.style.ERROR(f'  ✗ Módulo no encontrado: {clave}'))
        
        self.stdout.write(self.style.WARNING(f'\n=== Resumen ==='))
        self.stdout.write(self.style.SUCCESS(f'Total asignaciones creadas: {asignaciones_creadas}'))
        self.stdout.write(self.style.SUCCESS('✓ Sistema de módulos y roles inicializado correctamente'))
