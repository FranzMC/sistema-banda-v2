# FASE 3 - Deployment: Instrucciones Paso a Paso

## 🎯 Objetivo
Desplegar tu aplicación Django en Render.com con:
- Backend: https://sis-banda-api.onrender.com
- Base de datos: PostgreSQL automático
- SSL/HTTPS: Automático

## ⏱️ Tiempo estimado: 15-20 minutos

---

## 📋 Paso 1: Crear cuenta en Render.com (5 minutos)

1. Ir a https://render.com
2. Click "Sign up"
3. Registrarse con GitHub (recomendado) o email
4. Confirmar email
5. ✅ Listo, tienes créditos gratis ($7/mes)

---

## 📁 Paso 2: Subir código a GitHub (10 minutos)

### Si NO tienes GitHub aún:
```bash
# Abrir PowerShell en: c:\dev\Sis_Banda

# Verificar git
git --version

# Configurar git
git config --global user.name "Tu Nombre"
git config --global user.email "tu@email.com"

# Inicializar repo
git init
git add .
git commit -m "Initial commit: Sis Banda System"

# Ir a https://github.com/new y crear repositorio "sis-banda"
# Luego:
git branch -M main
git remote add origin https://github.com/TU_USUARIO/sis-banda.git
git push -u origin main
```

### Si TIENES GitHub aún:
```bash
# Solo pushear los cambios de Fase 0-2
cd c:\dev\Sis_Banda
git add .
git commit -m "Add: Environment configuration, token refresh interceptors (Phases 0-2)"
git push origin main
```

✅ Verificar que en GitHub veas:
- render.yaml ✅
- Procfile ✅
- .env.example ✅
- .gitignore ✅

---

## 🚀 Paso 3: Deploy en Render.com (5 minutos)

### 3.1 Crear Web Service
1. Loguéate en https://render.com
2. Click "+ New"
3. Selecciona "Web Service"
4. Click "Connect a repository"

### 3.2 Autorizar GitHub
1. Click "GitHub" (si te lo pide)
2. Autorizar Render en tu cuenta GitHub
3. Selecciona "sis-banda" de la lista

### 3.3 Configurar el servicio
- **Name:** `sis-banda-api` 
- **Runtime:** `Python 3`
- **Build command:** Dejar vacío (usará render.yaml)
- **Start command:** Dejar vacío (usará render.yaml)
- **Plan:** Free ✅
- **Environment:** Ya viene configurado en render.yaml

### 3.4 Crear base de datos
1. Render debería mostrar "Create database"
2. Click "Create PostgreSQL database"
3. **Name:** `sis-banda-db`
4. **Plan:** Free

### 3.5 Deploy
Click "Create Web Service"

---

## ⏳ Paso 4: Esperar el deployment (3-5 minutos)

En el Dashboard de Render verás:
```
Building your application...
Deployed successfully! 🎉
```

Busca en los logs:
- `Running migrations...` ✅
- `Collecting static files...` ✅
- `Application started` ✅

Tu URL será: **https://sis-banda-api.onrender.com**

---

## ✅ Paso 5: Verificar que funciona

### Prueba 1: Backend responde
```bash
curl https://sis-banda-api.onrender.com/api/
# Deberías recibir respuesta (no error 500)
```

### Prueba 2: Admin panel
Abre: https://sis-banda-api.onrender.com/admin/
- User: admin
- Password: (la que configuraste en createsuperuser)

### Prueba 3: Endpoint de token
```bash
curl -X POST https://sis-banda-api.onrender.com/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"segura123"}'

# Si falla con 401 = correcto (credenciales inválidas)
# Si error 500 = problema en backend
```

---

## 📱 Paso 6: Actualizar Android para producción

En `build.gradle` de tu proyecto Android:

```gradle
buildTypes {
    debug {
        buildConfigField "String", "API_BASE_URL", '"http://192.168.3.179:8000/api/"'
    }
    release {
        buildConfigField "String", "API_BASE_URL", '"https://sis-banda-api.onrender.com/api/"'
    }
}
```

Luego en `RetrofitClient.kt`:
```kotlin
private const val BASE_URL = BuildConfig.API_BASE_URL
```

Build release y tu app conectará automáticamente al backend en cloud 🎉

---

## 🌐 Paso 7: Desplegar frontend en React (Opcional)

Si quieres servir el frontend desde Render también:

### Opción A: Estático en Render (RECOMENDADO)
```bash
# Terminal 1: Build frontend
cd c:\dev\Sis_Banda\frontend
npm run build

# Se genera: frontend/dist/
```

En Render Dashboard:
1. Click "+ New"
2. "Static Site"
3. Conectar GitHub
4. **Build command:** `cd frontend && npm install && npm run build`
5. **Publish directory:** `frontend/dist`

Tu frontend estará en: **https://sis-banda.onrender.com**

### Opción B: Servir desde Django
Copiar `frontend/dist` a `gestion_banda/static/` en Django.

---

## 📊 URLs finales

```
Backend API:     https://sis-banda-api.onrender.com/api/
Admin Panel:     https://sis-banda-api.onrender.com/admin/
Frontend:        https://sis-banda.onrender.com (si desplegaste)
Android App:     Conecta automáticamente a backend API
```

---

## 🔄 Hacer cambios después del deploy

```bash
# En tu PC:
cd c:\dev\Sis_Banda

# Hacer cambios locales
# ... editar archivos ...

# Commit y push
git add .
git commit -m "Descripción del cambio"
git push origin main

# Render redeploy automáticamente en 2-3 minutos
# Ver en Render Dashboard → Logs
```

---

## 🆘 Si algo falla

### El build se cancela
- Ver logs en Render Dashboard
- Buscar línea roja con error
- Corregir localmente y pushear de nuevo

### Base de datos no se conecta
- En Render, ir a "Data" → "sis-banda-db"
- Ver credentials
- Verificar que DATABASE_URL está configurada

### Migraciones fallan
- Conectar a la base de datos desde Render
- Ejecutar migrations manualmente
- O borrar base de datos y crear nueva

### Frontend no carga
- Verificar que .env.production tiene URL correcta
- Rebuilda: `npm run build`
- Pushear cambios

---

## 💡 Tips importantes

✅ **CORRECTO:**
```bash
git push origin main  # Automáticamente redeploya
```

❌ **NO HAGAS:**
```bash
# No edites directamente en Render
# No borres la base de datos sin backup
# No dejes .env.local en git
```

---

## 🎉 ¡Listo!

Tu aplicación está ahora en la nube y:
- ✅ Android conecta automáticamente
- ✅ React se renueva de tokens automáticamente
- ✅ Tokens expiran en 1 hora (seguro)
- ✅ Base de datos PostgreSQL en producción
- ✅ HTTPS/SSL automático
- ✅ Dominio profesional de Render

¿Necesitas ayuda con algo? 🚀
