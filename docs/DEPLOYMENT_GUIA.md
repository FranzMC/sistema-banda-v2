# FASE 3 - Deployment a Render.com: GUÍA COMPLETA

## 📋 Requisitos previos

Antes de hacer el deploy, asegúrate de tener:
- ✅ Proyecto en GitHub (público o privado)
- ✅ FASE 0 completada (variables de entorno)
- ✅ FASE 1 completada (Android refresh token)
- ✅ FASE 2 completada (React refresh token)
- ✅ Cuenta en Render.com (https://render.com)

---

## 🚀 Paso 1: Preparar el proyecto para Render

### 1.1 Crear archivo `render.yaml` ✅ HECHO
Este archivo describe cómo Render debe desplegar tu app.

**Ubicación:** `c:\dev\Sis_Banda\render.yaml`

**Qué hace:**
- Define la versión de Python (3.11)
- Build command: instala dependencias, corre migraciones, recolecta archivos estáticos
- Start command: inicia gunicorn (servidor WSGI)
- Configura variables de entorno
- Crea base de datos PostgreSQL automáticamente
- SSL/HTTPS automático

### 1.2 Verificar requirements.txt
✅ Ya tiene: gunicorn, whitenoise, psycopg2-binary

```bash
# Verificar que gunicorn esté en requirements.txt
grep gunicorn requirements.txt
# Output: gunicorn==21.2.0
```

### 1.3 Actualizar settings.py para producción (YA HECHO)
✅ Ya usa variables de entorno con django-environ

---

## 📁 Paso 2: Subir código a GitHub

### 2.1 Inicializar Git (si no lo hiciste)
```bash
cd c:\dev\Sis_Banda
git init
git config user.name "Tu Nombre"
git config user.email "tu@email.com"
```

### 2.2 Crear .gitignore actualizado
```bash
# Ver archivo .gitignore del proyecto
cat .gitignore
```

Asegurar que ignore:
```
.env.local          # Variables locales (NO en git)
.env.development    # Dev variables (opcional)
db.sqlite3          # Base de datos local
*.pyc
__pycache__/
env/
/staticfiles/       # Generados en build
/media/             # Archivos subidos
```

### 2.3 Hacer commit inicial
```bash
cd c:\dev\Sis_Banda
git add .
git commit -m "Initial commit: Sis Banda - Music Band Management System"
```

### 2.4 Crear repositorio en GitHub
1. Ir a https://github.com/new
2. Nombre: `sis-banda` (o lo que prefieras)
3. Descripción: "Sistema de Gestión de Banda de Música"
4. Privado o Público (a tu gusto)
5. NO inicializar con README (ya existe)
6. Click "Create repository"

### 2.5 Conectar y pushear a GitHub
```bash
cd c:\dev\Sis_Banda
git branch -M main
git remote add origin https://github.com/TU_USUARIO/sis-banda.git
git push -u origin main
```

---

## 🔌 Paso 3: Conectar Render a GitHub

### 3.1 Ir a Render.com
1. Loguéate en https://render.com
2. Click en "New +"
3. Selecciona "Web Service"

### 3.2 Conectar repositorio
1. Click "Connect a repository" o selecciona GitHub
2. Autoriza Render a acceder a tus repos
3. Selecciona `sis-banda` de tu lista

### 3.3 Configurar el deploy
- **Name:** `sis-banda-api`
- **Runtime:** Python 3
- **Build command:** (dejará vacío - usará render.yaml)
- **Start command:** (dejará vacío - usará render.yaml)
- **Plan:** Free (para empezar)

### 3.4 Configurar variables de entorno (render.yaml lo hace automáticamente)
Render creará:
- ✅ Base de datos PostgreSQL automáticamente
- ✅ Variables de entorno desde render.yaml
- ✅ SSL/HTTPS automático
- ✅ URL: https://sis-banda-api.onrender.com

### 3.5 Click "Create Web Service"
El deploy comenzará automáticamente:
1. Clona tu repo
2. Instala dependencias (`pip install -r requirements.txt`)
3. Corre migraciones (`python manage.py migrate`)
4. Recolecta archivos estáticos (`collectstatic`)
5. Inicia gunicorn

---

## 📡 Paso 4: Deploy del Frontend en Render

Una vez que el backend está en Render, necesitas actualizar el frontend:

### 4.1 Actualizar frontend para producción
El `.env.production` ya está configurado:
```
VITE_API_URL=https://sis-banda-api.onrender.com/api/
```

### 4.2 Build del frontend
```bash
cd c:\dev\Sis_Banda\frontend
npm run build
# Genera carpeta: frontend/dist/
```

### 4.3 Opción A: Servir frontend desde Django (Recomendado para empezar)
```bash
# Copiar dist a Django
cp -r frontend/dist/* gestion_banda/static/
```

### 4.3 Opción B: Deploy frontend separado en Render
1. Ir a Render.com
2. Crear nuevo "Static Site"
3. Conectar GitHub
4. Build command: `cd frontend && npm install && npm run build`
5. Publish directory: `frontend/dist`

---

## ✅ Paso 5: Verificar el deploy

### 5.1 Revisar logs en Render
1. Dashboard de Render → sis-banda-api
2. Click en "Logs"
3. Buscar errores (verás las migraciones y el startup)

### 5.2 Probar endpoints
```bash
# Verificar que el backend está vivo
curl https://sis-banda-api.onrender.com/api/

# Probar login (sin credenciales debería fallar, pero la API responde)
curl -X POST https://sis-banda-api.onrender.com/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'
```

### 5.3 Actualizar Android
En `RetrofitClient.kt`, cambiar:
```kotlin
private const val BASE_URL = BuildConfig.API_BASE_URL

// build.gradle
buildConfigField "String", "API_BASE_URL", '"https://sis-banda-api.onrender.com/api/"'
```

---

## 🔄 Paso 6: Configuración post-deployment

### 6.1 CORS debe estar correcto
Verificar en Render Dashboard:
- Environment: `CORS_ALLOWED_ORIGINS=https://sis-banda.onrender.com`

### 6.2 Base de datos PostgreSQL
Render crea automáticamente, pero verifica en Dashboard:
- "Resources" → "sis-banda-db"
- Debe estar disponible

### 6.3 Crear superuser en producción
```bash
# En Render Dashboard, click "Connect" en el web service
# O usar SSH si está disponible
python manage.py createsuperuser
```

O crear un usuario desde Django shell:
```bash
python manage.py shell
from gestion_banda.models import Usuario
Usuario.objects.create_superuser(username='admin', email='admin@banda.com', password='segura123')
exit()
```

---

## 📊 Resumen de URLs después del deploy

| Componente | URL | Tipo |
|---|---|---|
| **Backend API** | https://sis-banda-api.onrender.com/api/ | Python/Django |
| **Frontend** | https://sis-banda.onrender.com | React/Vite |
| **Android App** | Conecta a backend API | Kotlin |
| **Admin Django** | https://sis-banda-api.onrender.com/admin/ | Django Admin |

---

## 🔧 Troubleshooting

### ❌ Error: "ModuleNotFoundError: No module named 'core'"
**Causa:** Python path incorrecto
**Solución:** Asegurar que `manage.py` esté en root

### ❌ Error: "psycopg2" no instala
**Causa:** Falta compilador en Render
**Solución:** `psycopg2-binary` ya está en requirements.txt

### ❌ Error: Migraciones fallan
**Causa:** Errores en models.py
**Solución:** Verificar logs en Render y corregir localmente

### ❌ Error: "Static files not found" (404 en /admin/)
**Solución:** `collectstatic` debe ejecutarse en build
**Ya configurado en render.yaml**

### ❌ Render cancela el deploy después de 10 min
**Causa:** Build toma mucho tiempo
**Solución:** Optimizar requirements.txt o usar plan pagado

---

## 💾 Backup de datos

### Hacer backup de base de datos local antes de borrar
```bash
# Exportar datos SQLite a JSON
python manage.py dumpdata > backup.json

# En producción, importar
python manage.py loaddata backup.json
```

---

## 🔐 Variables de entorno en Render (render.yaml las crea automáticamente)

```
DEBUG=False                                    # IMPORTANTE: False en producción
SECRET_KEY=<generado automáticamente>        # Único y seguro
ALLOWED_HOSTS=sis-banda-api.onrender.com     # Tu dominio de Render
CORS_ALLOWED_ORIGINS=https://sis-banda.onrender.com  # Tu frontend
DATABASE_URL=postgresql://...                 # Creado por Render automáticamente
ACCESS_TOKEN_LIFETIME=3600                    # 1 hora
REFRESH_TOKEN_LIFETIME=2592000                # 30 días
SECURE_SSL_REDIRECT=True                      # HTTPS obligatorio
SESSION_COOKIE_SECURE=True
CSRF_COOKIE_SECURE=True
```

---

## 📈 Plan de mejora post-deploy

1. **Monitoreo:** Configurar alertas en Render
2. **Logs:** Usar datadog o similar para análisis
3. **Performance:** Implementar caché (Redis)
4. **Database:** Migrarse a PostgreSQL pagado si crece
5. **API Docs:** Agregar Swagger/OpenAPI
6. **Testing:** Agregar CI/CD con GitHub Actions

---

## 🎉 Checklist final antes de ir a producción

- [ ] Backend en Render con variables de entorno ✅
- [ ] Base de datos PostgreSQL funcionando ✅
- [ ] Frontend conecta a backend de Render ✅
- [ ] Tokens se renuevan automáticamente ✅
- [ ] Login funciona en producción
- [ ] Datos se guardan correctamente
- [ ] Android app conecta a API de Render
- [ ] HTTPS/SSL funcionando
- [ ] Admin panel accesible

---

**¿Necesitas ayuda con algún paso específico?** 🚀
