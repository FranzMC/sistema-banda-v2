from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Usuario, Musico

@receiver(post_save, sender=Musico)
def sync_musico_to_usuario(sender, instance, **kwargs):
    """Sincroniza Nombres, Apellidos y Teléfono desde Musico hacia Usuario"""
    if hasattr(instance, '_syncing_from_usuario') and instance._syncing_from_usuario:
        return
        
    usuario = instance.usuario
    if usuario:
        # Prevenir ciclo infinito
        usuario._syncing_from_musico = True
        
        needs_save = False
        if usuario.first_name != instance.nombres:
            usuario.first_name = instance.nombres
            needs_save = True
            
        if usuario.last_name != instance.apellidos:
            usuario.last_name = instance.apellidos
            needs_save = True
            
        if usuario.telefono != instance.telefono:
            usuario.telefono = instance.telefono
            needs_save = True
            
        if needs_save:
            usuario.save(update_fields=['first_name', 'last_name', 'telefono'])
            
        delattr(usuario, '_syncing_from_musico')

@receiver(post_save, sender=Usuario)
def sync_usuario_to_musico(sender, instance, **kwargs):
    """Sincroniza Nombres, Apellidos y Teléfono desde Usuario hacia Musico"""
    if hasattr(instance, '_syncing_from_musico') and instance._syncing_from_musico:
        return
        
    try:
        musico = instance.perfil_musico
        if musico:
            # Prevenir ciclo infinito
            musico._syncing_from_usuario = True
            
            needs_save = False
            if musico.nombres != instance.first_name:
                musico.nombres = instance.first_name
                needs_save = True
                
            if musico.apellidos != instance.last_name:
                musico.apellidos = instance.last_name
                needs_save = True
                
            if musico.telefono != instance.telefono:
                musico.telefono = instance.telefono
                needs_save = True
                
            if needs_save:
                musico.save(update_fields=['nombres', 'apellidos', 'telefono'])
                
            delattr(musico, '_syncing_from_usuario')
    except Exception:
        # Si el usuario no tiene perfil de músico asociado
        pass
