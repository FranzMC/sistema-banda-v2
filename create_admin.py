import os
import django
import traceback

def main():
    try:
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
        django.setup()
        
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        if not User.objects.filter(username='admin').exists():
            User.objects.create_superuser('admin', 'admin@admin.com', 'Banda12345')
            print("Superusuario admin creado correctamente.")
        else:
            print("El superusuario admin ya existe.")
    except Exception as e:
        print(f"Error al crear superusuario: {e}")
        traceback.print_exc()

if __name__ == '__main__':
    main()
