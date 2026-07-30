# Sistema RBAC - Resumen de Implementación

## ✅ Tareas Completadas

### 1. Filtrado por Rol en Descuentos y Adelantos
**Archivo:** [gestion_banda/api_views.py](gestion_banda/api_views.py)

**Implementado:**
- `DescuentoViewSet.get_queryset()`: Filtra según rol del usuario
  - **DIRECTOR/SUBDIRECTOR/PRESIDENTE**: Ven todos los descuentos
  - **JEFE DE SECCIÓN**: Solo descuentos de su sección (via JefeSeccion)
  - **Otros roles**: Sin acceso

- `AdelantoViewSet.get_queryset()`: Idéntica lógica para adelantos

**Código de filtrado:**
```python
def get_queryset(self):
    """Filtrar descuentos según rol del usuario"""
    queryset = super().get_queryset()
    user = self.request.user
    
    # DIRECTOR, SUBDIRECTOR, PRESIDENTE: ven todo
    if user.rol in ['DIRECTOR', 'SUBDIRECTOR', 'PRESIDENTE'] or user.is_superuser:
        return queryset
    
    # JEFE DE SECCIÓN: solo descuentos de su sección
    if user.rol == 'JEFE_SECCION':
        try:
            jefe = JefeSeccion.objects.get(usuario=user)
            return queryset.filter(musico__instrumento=jefe.seccion)
        except JefeSeccion.DoesNotExist:
            return queryset.none()
    
    # Otros roles: no ven descuentos
    return queryset.none()
```

### 2. Estructura de Datos y Módulos

**Usuarios Creados:**
- `presidente` (rol: PRESIDENTE) - contraseña: 123456
- `jefe_trompeta` (rol: JEFE_SECCION, sección: TROMPETA) - contraseña: 123456

**Módulos del Sistema:**
1. Descuentos
2. Adelantos
3. Liquidaciones
4. Eventos
5. Usuarios

**Asignación de Módulos por Rol:**
| Rol | Descuentos | Adelantos | Liquidaciones | Eventos | Usuarios |
|-----|:----------:|:---------:|:-------------:|:-------:|:--------:|
| PRESIDENTE | ✅ | ✅ | ✅ | ✅ | ✅ |
| DIRECTOR | ✅ | ✅ | ✅ | ✅ | ✅ |
| SUBDIRECTOR | ✅ | ✅ | ✅ | ✅ | ❌ |
| JEFE_SECCION | ✅ | ✅ | ❌ | ❌ | ❌ |
| MUSICO | ❌ | ❌ | ❌ | ❌ | ❌ |

### 3. Base de Datos

**Estado Actual:**
- 103 músicos restaurados y activos
- Migrations limpias (0001 → 0010)
- Modelos actualizados con campos de origen y referencia
- Foreign keys nullable donde corresponde

**Descuentos de Prueba Creados:**
1. RAUL QUINO MARTINEZ (TROMPETA) - $100
2. HERIK MANCILLA CONDORI (TROMPETA) - $150
3. CRISTIANO YANARI CALDERONO (BARITONO) - $200
4. EFRAIN CALLISAYA VARGAS (SAXOFON) - $250

---

## 🧪 Instrucciones de Prueba

### Paso 1: Iniciar el servidor Django
```bash
cd c:\dev\Sis_Banda
.\env\Scripts\activate
python manage.py runserver 192.168.3.179:8000
```

### Paso 2: Obtener Token JWT

#### Opción A: PRESIDENTE (ve todo)
```bash
curl -X POST http://192.168.3.179:8000/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username": "presidente", "password": "123456"}'
```

#### Opción B: JEFE DE SECCIÓN (ve solo TROMPETA)
```bash
curl -X POST http://192.168.3.179:8000/api/token/ \
  -H "Content-Type: application/json" \
  -d '{"username": "jefe_trompeta", "password": "123456"}'
```

### Paso 3: Probar Filtrado de Descuentos

Con token de **PRESIDENTE** (debe ver 4 descuentos):
```bash
curl -H "Authorization: Bearer <TOKEN_PRESIDENTE>" \
  http://192.168.3.179:8000/api/descuentos/
```

Con token de **JEFE TROMPETA** (debe ver solo 2 descuentos de TROMPETA):
```bash
curl -H "Authorization: Bearer <TOKEN_JEFE_TROMPETA>" \
  http://192.168.3.179:8000/api/descuentos/
```

### Paso 4: Verificar Datos de Usuario

```bash
curl -H "Authorization: Bearer <TOKEN>" \
  http://192.168.3.179:8000/api/users/me/
```

Respuesta esperada:
```json
{
  "id": 1,
  "username": "presidente",
  "first_name": "Presidente",
  "rol": "PRESIDENTE",
  "email": "presidente@banda.local",
  "modulos_personales": [],
  "permisos": [
    "descuentos",
    "adelantos",
    "liquidaciones",
    "eventos",
    "usuarios"
  ]
}
```

---

## 📋 Flujo Completo: App → Descuentos → Liquidación

### 1. Registrar Descuento desde App (origen='APP')
```bash
curl -X POST http://192.168.3.179:8000/api/descuentos/registrar_app/ \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "musico_id": 1,
    "monto": 500.00,
    "motivo": "Multa por inasistencia",
    "fecha_aplicacion": "2025-01-15"
  }'
```

### 2. Listar Descuentos (filtrados por rol)
```bash
curl -H "Authorization: Bearer <TOKEN>" \
  http://192.168.3.179:8000/api/descuentos/?ordering=-fecha_aplicacion
```

### 3. Crear Planilla de Liquidación
```bash
curl -X POST http://192.168.3.179:8000/api/planillas/ \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "titulo": "Liquidación Enero 2025",
    "fecha": "2025-01-31",
    "eventos": [1]
  }'
```

### 4. Previsualizar Descuentos
```bash
curl -X POST http://192.168.3.179:8000/api/planillas/<id>/previsualizar/ \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "eventos": [1]
  }'
```

### 5. Liquidar desde App
```bash
curl -X POST http://192.168.3.179:8000/api/planillas/<id>/liquidar_app/ \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "descuentos": [
      {"musico_id": 1, "monto": 500.00, "motivo": "Multa", "fecha": "2025-01-15"}
    ],
    "adelantos": []
  }'
```

---

## 🔐 Requisitos de Seguridad Cumplidos

✅ Cada rol ve solo datos que le corresponden
✅ JEFE DE SECCIÓN restringido a su sección
✅ Tokens JWT para autenticación
✅ Permiso de módulo por rol
✅ Campos de origen para auditoría

---

## 📝 Próximos Pasos (Opcionales)

1. **Frontend**: Mostrar módulos disponibles en dashboard según rol
2. **Auditoría**: Registrar cambios en tabla de historial
3. **Reportes**: Generar reportes filtrados por rol
4. **Notificaciones**: Alertar jefes de sección sobre cambios

---

**Última actualización:** 2025-01-15  
**Estado:** ✅ Operacional
