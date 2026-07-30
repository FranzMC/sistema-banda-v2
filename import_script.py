import os
import json
import django
import sys
from datetime import datetime

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import transaction
from django.contrib.auth.hashers import make_password
from gestion_banda.models import Usuario, Musico

def get_unique_username(base_username):
    username = base_username.lower().replace(" ", "_")
    counter = 1
    unique_username = username
    while Usuario.objects.filter(username=unique_username).exists():
        unique_username = f"{username}_{counter}"
        counter += 1
    return unique_username

def get_unique_document(doc):
    counter = 1
    unique_doc = doc
    while Musico.objects.filter(documento_identidad=unique_doc).exists():
        unique_doc = f"000000{counter}" if doc == "00000000" else f"{doc}_{counter}"
        counter += 1
    return unique_doc

def run_import(json_file_path):
    with open(json_file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    created_count = 0
    with transaction.atomic():
        for index, item in enumerate(data):
            nombres = item.get('nombres', '').strip()
            apellidos = item.get('apellidos', '').strip()
            documento_identidad = item.get('documento_identidad', '').strip()
            
            # Generate unique document identity to avoid DB collision
            documento_identidad = get_unique_document(documento_identidad)

            base_username = f"{nombres.split(' ')[0]}_{apellidos.split(' ')[0]}".lower()
            username = get_unique_username(base_username)
            
            # Use first 4 digits of original identity as PIN (if possible, else default to '0000')
            original_doc = item.get('documento_identidad', '').strip()
            pin = original_doc[:4] if len(original_doc) >= 4 else "0000"
            password = make_password(pin)
            
            telefono = item.get('telefono', '').strip()

            # Create User
            usuario = Usuario.objects.create(
                username=username,
                password=password,
                first_name=nombres,
                last_name=apellidos,
                rol='MUSICO',
                telefono=telefono,
                is_active=True
            )
            
            # Create Musico Profile
            fecha_nac = item.get('fecha_nacimiento')
            if not fecha_nac:
                fecha_nac = None
                
            Musico.objects.create(
                usuario=usuario,
                documento_identidad=documento_identidad,
                nombres=nombres,
                apellidos=apellidos,
                telefono=telefono,
                fecha_nacimiento=fecha_nac,
                direccion=item.get('direccion', ''),
                instrumento=item.get('instrumento', 'OTRO').strip().upper(),
                nivel=item.get('nivel', 'INTERMEDIO').strip().upper(),
                talla_camisa=item.get('talla_camisa', '').strip(),
                talla_chamarra=item.get('talla_chamarra', '').strip(),
                numero_calzado=item.get('numero_calzado', '').strip(),
                activo=True
            )
            created_count += 1
            print(f"[{created_count}] Creado: {nombres} {apellidos} (Username: {username}, DNI: {documento_identidad}, PIN: {pin})")

    print(f"\n¡Importación completada! {created_count} músicos importados exitosamente.")

if __name__ == '__main__':
    run_import('musicos_import.json')
