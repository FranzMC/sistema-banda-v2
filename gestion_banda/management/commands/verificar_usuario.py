from django.core.management.base import BaseCommand
from django.contrib.auth import authenticate
from gestion_banda.models import Usuario

class Command(BaseCommand):
    help = 'Verifica las credenciales de un usuario específico'

    def add_arguments(self, parser):
        parser.add_argument('username', type=str, help='Username del usuario a verificar')
        parser.add_argument('password', type=str, help='Password a probar')

    def handle(self, *args, **options):
        username = options['username']
        password = options['password']
        
        self.stdout.write(f'Verificando usuario: {username}')
        self.stdout.write(f'Password a probar: {password}')
        
        # Buscar el usuario
        try:
            usuario = Usuario.objects.get(username=username)
            self.stdout.write(self.style.SUCCESS(f'Usuario encontrado: {usuario.username}'))
            self.stdout.write(f'Rol: {usuario.rol}')
            self.stdout.write(f'Activo: {usuario.is_active}')
            
            # Intentar autenticar
            user = authenticate(username=username, password=password)
            if user:
                self.stdout.write(self.style.SUCCESS('✓ Autenticación exitosa'))
            else:
                self.stdout.write(self.style.ERROR('✗ Autenticación fallida'))
                
                # Verificar si la contraseña coincide usando check_password
                if usuario.check_password(password):
                    self.stdout.write(self.style.WARNING('✓ La contraseña coincide pero authenticate falló'))
                else:
                    self.stdout.write(self.style.ERROR('✗ La contraseña no coincide'))
                    
        except Usuario.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'Usuario {username} no encontrado'))
