from gestion_banda.models import Usuario, Musico

def update_user_passwords():
    """Actualiza las contraseñas de todos los usuarios para usar solo 4 dígitos del CI"""
    
    usuarios = Usuario.objects.all()
    actualizados = 0
    errores = 0
    
    print("=== Actualizando contraseñas de usuarios ===\n")
    
    for usuario in usuarios:
        try:
            # Obtener el CI del perfil de músico si existe
            ci = None
            if hasattr(usuario, 'perfil_musico') and usuario.perfil_musico:
                ci = usuario.perfil_musico.documento_identidad
            
            if ci:
                # Extraer los primeros 4 dígitos del CI
                ci_digits = ''.join(ch for ch in ci if ch.isdigit())
                if len(ci_digits) >= 4:
                    nueva_password = ci_digits[:4]
                else:
                    nueva_password = ci_digits.ljust(4, '0')
                
                # Actualizar la contraseña
                usuario.set_password(nueva_password)
                usuario.save()
                
                print(f"✓ Usuario: {usuario.username} | CI: {ci} | Nueva contraseña: {nueva_password}")
                actualizados += 1
            else:
                print(f"✗ Usuario: {usuario.username} | Sin CI asociado")
                errores += 1
                
        except Exception as e:
            print(f"✗ Error actualizando usuario {usuario.username}: {e}")
            errores += 1
    
    print(f"\n=== Resumen ===")
    print(f"Usuarios actualizados: {actualizados}")
    print(f"Errores: {errores}")
    print(f"Total procesados: {actualizados + errores}")

# Ejecutar la función
update_user_passwords()
