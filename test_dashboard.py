import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
User = get_user_model()
client = APIClient(SERVER_NAME='localhost')
user = User.objects.get(username='presidente')
client.force_authenticate(user=user)
response = client.get('/api/dashboard/')
if hasattr(response, 'data'):
    print(f'Status: {response.status_code}, Data: {response.data}')
else:
    print(f'Status: {response.status_code}, Content: {response.content}')
