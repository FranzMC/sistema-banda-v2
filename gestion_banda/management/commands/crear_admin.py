from django.core.management.base import BaseCommand
from gestion_banda.models import Usuario

class Command(BaseCommand):
    help = 'Crea un usuario administrativo con rol PRESIDENTE'

    def handle(self, *args, **options):
        username = options.get('username', 'admin')
        password = options.get('password', 'admin1234')
        
        # Verificar si ya existe
        if Usuario.objects.filter(username=username).exists():
            self.stdout.write(
                self.style.WARNING(f'El usuario "{username}" ya existe.')
            )
            return
        
        # Crear usuario administrativo
        usuario = Usuario.objects.create_superuser(
            username=username,
            email='admin@banda.com',
            password=password,
            first_name='Administrador',
            last_name='Sistema',
            rol='PRESIDENTE',
            is_active=True
        )
        
        self.stdout.write(
            self.style.SUCCESS(
                f'✓ Usuario administrativo creado exitosamente:\n'
                f'  Username: {username}\n'
                f'  Password: {password}\n'
                f'  Rol: PRESIDENTE\n'
                f'  Puedes loguearte con estos datos en el sistema.'
            )
        )

    def add_arguments(self, parser):
        parser.add_argument(
            '--username',
            type=str,
            default='admin',
            help='Nombre de usuario para el administrador (default: admin)'
        )
        parser.add_argument(
            '--password',
            type=str,
            default='admin1234',
            help='Contraseña para el administrativo (default: admin1234)'
        )
