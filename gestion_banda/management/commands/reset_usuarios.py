from django.core.management.base import BaseCommand
from gestion_banda.models import Usuario, Musico

class Command(BaseCommand):
    help = 'Reinicia todos los usuarios: rol=MUSICO, username=primer nombre, password=4 dígitos CI'

    def handle(self, *args, **options):
        usuarios = Usuario.objects.all()
        actualizados = 0
        errores = 0
        
        self.stdout.write(self.style.WARNING('=== Reiniciando todos los usuarios ===\n'))
        
        for usuario in usuarios:
            try:
                # Obtener datos del perfil de músico si existe
                ci = None
                nombres = None
                
                if hasattr(usuario, 'perfil_musico') and usuario.perfil_musico:
                    ci = usuario.perfil_musico.documento_identidad
                    nombres = usuario.perfil_musico.nombres
                
                # Establecer rol MUSICO
                usuario.rol = 'MUSICO'
                
                # Generar username desde primer nombre
                if nombres:
                    primer_nombre = nombres.strip().split(' ')[0].lower()
                    usuario.username = primer_nombre
                else:
                    usuario.username = usuario.username.lower()
                
                # Generar contraseña de 4 dígitos del CI
                if ci:
                    ci_digits = ''.join(ch for ch in ci if ch.isdigit())
                    if len(ci_digits) >= 4:
                        password = ci_digits[:4]
                    else:
                        password = ci_digits.ljust(4, '0')
                else:
                    password = '0000'
                
                usuario.set_password(password)
                usuario.save()
                
                self.stdout.write(
                    self.style.SUCCESS(
                        f'✓ Usuario: {usuario.username} | Rol: MUSICO | Password: {password}'
                    )
                )
                actualizados += 1
                
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f'✗ Error con usuario {usuario.username}: {e}')
                )
                errores += 1
        
        self.stdout.write(self.style.WARNING(f'\n=== Resumen ==='))
        self.stdout.write(self.style.SUCCESS(f'Usuarios actualizados: {actualizados}'))
        self.stdout.write(self.style.ERROR(f'Errores: {errores}'))
        self.stdout.write(self.style.WARNING(f'Total procesados: {actualizados + errores}'))
