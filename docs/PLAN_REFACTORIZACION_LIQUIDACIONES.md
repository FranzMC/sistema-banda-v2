# 🔧 PLAN DE REFACTORIZACIÓN - SISTEMA DE LIQUIDACIONES

## 📊 Análisis de la estructura actual

**Lo que existe:**
- ❌ Módulos/Roles/Permisos complejos (RBAC)
- ❌ Descuentos manuales sin control de sección
- ❌ Adelantos sin relación clara con contratos
- ✅ Sanciones por jefe de sección (bien hecho)
- ✅ PlanillaLiquidacion/Pago (lógica correcta)

---

## 🎯 Objetivo final

```
ARQUITECTURA NUEVA Y LIMPIA:

┌─────────────────────────────────────────────────────────┐
│  INGRESO DE DATOS (Distribuido)                         │
├─────────────────────────────────────────────────────────┤
│ APP MÓVIL (Jefe Sección)                                │
│ └─ Registra descuentos por falta                        │
│    └─ GuardA localmente + Envía al sistema              │
│                                                          │
│ APP MÓVIL (Directorio)                                  │
│ └─ Registra adelantos al contratar                      │
│    └─ Guarda localmente + Envía al sistema              │
│                                                          │
│ FRONTEND REACT (Ambos)                                  │
│ └─ También pueden registrar aquí                        │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  BASE DE DATOS CENTRAL                                  │
├─────────────────────────────────────────────────────────┤
│ DescuentoFalta (NUEVO)                                  │
│ ├─ musico                                               │
│ ├─ jefe_seccion (control de acceso)                     │
│ ├─ monto (libre)                                        │
│ ├─ motivo                                               │
│ ├─ fecha_falta                                          │
│ ├─ origen (APP_MOVIL, FRONTEND)                         │
│ └─ estado (PENDIENTE, APROBADA, LIQUIDADA)              │
│                                                          │
│ AdelantoMusico (NUEVO)                                  │
│ ├─ musico                                               │
│ ├─ contrato                                             │
│ ├─ monto                                                │
│ ├─ motivo                                               │
│ ├─ fecha                                                │
│ ├─ origen (APP_MOVIL, FRONTEND)                         │
│ └─ estado (PENDIENTE, APROBADA, LIQUIDADA)              │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  MÓDULO DE LIQUIDACIÓN                                  │
├─────────────────────────────────────────────────────────┤
│ Pago (REFACTORIZADO)                                    │
│ ├─ musico                                               │
│ ├─ salario_base                                         │
│ ├─ descuentos_totales (suma de DescuentoFalta)          │
│ ├─ adelantos_totales (suma de AdelantoMusico)           │
│ ├─ neto_pagar = salario_base - descuentos + adelantos   │
│ ├─ estado (PENDIENTE, PAGADO)                           │
│ └─ fecha_liquidacion                                    │
└─────────────────────────────────────────────────────────┘
```

---

## 🗑️ Paso 1: Eliminar estos modelos

### 1.1 RBAC complejo (NO necesario para este caso)
```python
❌ Modulo
❌ RolModulo  
❌ UsuarioModulo
```

**Por qué:** 
- Solo necesitamos control simple: "Jefe de Sección ve solo su sección"
- Puede implementarse con permisos simples en los ViewSets
- No necesita tabla separada

### 1.2 Descuentos y Adelantos actuales (Muy complejos)
```python
❌ Descuento (Reemplazar)
❌ Adelanto (Reemplazar)
❌ DescuentoPorSeccion (Reemplazar por agregación simple)
❌ AdelantoPorSeccion (Reemplazar por agregación simple)
```

**Por qué:**
- Están mezclando PDFs, mantenimiento manual y múltiples orígenes
- No controlan sección
- Modelo nuevo es más simple y claro

### 1.3 Sanciones (Renombrar a DescuentoFalta - Es lo mismo)
```python
⚠️ Sancion → DescuentoFalta (Renombrar y simplificar)
```

---

## ✨ Paso 2: Crear estos nuevos modelos

### 2.1 DescuentoFalta
```python
class DescuentoFalta(models.Model):
    """Descuentos registrados por jefe de sección por faltas"""
    ESTADOS = [
        ('PENDIENTE', 'Pendiente de Aprobación'),
        ('APROBADA', 'Aprobada'),
        ('LIQUIDADA', 'Liquidada en Pago'),
    ]
    
    musico = ForeignKey(Musico)
    jefe_seccion = ForeignKey(Usuario, rol=SUBDIRECTOR)  # Control de acceso
    monto = DecimalField()  # Libre, no categorizado
    motivo = CharField()    # "Llegó tarde", "No asistió", etc
    fecha_falta = DateField()
    origen = CharField(choices=['APP_MOVIL', 'FRONTEND'])
    estado = CharField(choices=ESTADOS, default='PENDIENTE')
    creado_en = DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.musico} - ${self.monto} ({self.estado})"
```

**Permisos:**
- Jefe Sección: Crea descuentos de su sección
- Directorio: Aprueba
- API: Verifica jefe_seccion == usuario actual

### 2.2 AdelantoMusico
```python
class AdelantoMusico(models.Model):
    """Adelantos registrados por directorio al contratar"""
    ESTADOS = [
        ('PENDIENTE', 'Pendiente'),
        ('APROBADA', 'Aprobada'),
        ('LIQUIDADA', 'Liquidada en Pago'),
    ]
    
    musico = ForeignKey(Musico)
    contrato = ForeignKey(ContratoMusico)  # Fecha del contrato
    monto = DecimalField()  # Libre
    motivo = CharField()    # "Adelanto inicial", "Solicitud especial", etc
    fecha = DateField()
    origen = CharField(choices=['APP_MOVIL', 'FRONTEND'])
    estado = CharField(choices=ESTADOS, default='PENDIENTE')
    registrado_por = ForeignKey(Usuario)  # Quién lo registró
    creado_en = DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.musico} - ${self.monto} (Adelanto)"
```

**Permisos:**
- Solo Director/Presidente crea adelantos
- API: Verifica rol == DIRECTOR

### 2.3 Pago (REFACTORIZAR existente)
```python
class Pago(models.Model):
    """Liquidación final de pago a músico"""
    musico = ForeignKey(Musico)
    periodo = CharField()  # "2024-06-01 a 2024-06-30"
    
    # Montos base
    salario_base = DecimalField()
    eventos_pagados = IntegerField()  # Cantidad de eventos
    
    # Agregaciones automáticas
    descuentos_totales = DecimalField()  # Sum(DescuentoFalta)
    adelantos_totales = DecimalField()   # Sum(AdelantoMusico)
    
    # Resultado
    neto_pagar = DecimalField()  # salario_base - desc + adelantos
    
    estado = CharField(choices=['PENDIENTE', 'PAGADO'])
    fecha_liquidacion = DateTimeField()
    pagado_en = DateTimeField(null=True)
    
    def calcular_automaticamente(self):
        """Se ejecuta cuando el directorio genera la liquidación"""
        self.descuentos_totales = DescuentoFalta.objects\
            .filter(musico=self.musico, estado='APROBADA')\
            .aggregate(Sum('monto'))['monto__sum'] or 0
            
        self.adelantos_totales = AdelantoMusico.objects\
            .filter(musico=self.musico, estado='APROBADA')\
            .aggregate(Sum('monto'))['monto__sum'] or 0
            
        self.neto_pagar = self.salario_base - self.descuentos_totales + self.adelantos_totales
        self.save()
```

---

## 📱 Paso 3: API Endpoints (Nuevos y refactorizados)

### APP MÓVIL (Jefe Sección)
```
POST /api/descuentos-falta/
├─ Body: {
│   "musico_id": 5,
│   "monto": 50,
│   "motivo": "Llegó 30 minutos tarde",
│   "fecha_falta": "2024-06-04",
│   "origen": "APP_MOVIL"
│ }
└─ Response: {"id": 123, "estado": "PENDIENTE"}

# Automáticamente se guarda:
# - En la app (Room Database)
# - En el sistema (Django)

GET /api/descuentos-falta/?fecha_min=2024-06-01&fecha_max=2024-06-30
└─ Retorna solo descuentos de su sección
```

### APP MÓVIL (Directorio)
```
POST /api/adelantos-musico/
├─ Body: {
│   "musico_id": 5,
│   "contrato_id": 12,
│   "monto": 100,
│   "motivo": "Adelanto inicial al contratar",
│   "fecha": "2024-06-04",
│   "origen": "APP_MOVIL"
│ }
└─ Response: {"id": 456, "estado": "PENDIENTE"}

GET /api/adelantos-musico/
└─ Retorna todos los adelantos
```

### FRONTEND REACT (Ambos)
```
POST /api/descuentos-falta/  (Mismo que app)
POST /api/adelantos-musico/  (Mismo que app)

GET /api/pagos/ (Ver liquidaciones)
POST /api/pagos/generar-liquidacion/
├─ Body: {
│   "musico_ids": [1, 2, 3, 4, 5],
│   "salario_base": 2000,
│   "periodo": "2024-06-01 a 2024-06-30"
│ }
└─ Calcula automáticamente y genera Pagos
```

---

## 🔐 Sistema de Permisos (SIMPLE)

### Rol: SUBDIRECTOR (Jefe de Sección)
```
✅ Ver descuentos de su sección
✅ Crear descuentos en su sección
❌ Ver/editar descuentos de otras secciones
❌ Crear adelantos
❌ Generar liquidaciones
```

### Rol: DIRECTOR (Directorio)
```
✅ Ver todos los descuentos
✅ Crear adelantos
✅ Aprobar/rechazar descuentos
✅ Generar liquidaciones
✅ Ver/editar pagos
```

### Rol: PRESIDENTE
```
✅ Todo (supervisar)
```

**Implementación:** Decoradores en ViewSets, NO en tabla separada

---

## 🔄 Flujo de datos (Paso a Paso)

### Escenario: Jefe de Sección registra una falta

```
1. APP MÓVIL (Jefe Sección)
   └─ Click "Registrar descuento"
   └─ Input: Músico, monto, motivo, fecha
   └─ Guarda en Room Database (local)
   └─ API: POST /api/descuentos-falta/
        └─ Django recibe y guarda en PostgreSQL
        
2. SISTEMA (Backend)
   └─ Descuento guardado en estado PENDIENTE
   └─ Asociado a jefe_seccion (para control)
   
3. FRONTEND REACT (Directorio)
   └─ GET /api/descuentos-falta/
   └─ Ve todos los descuentos PENDIENTE
   └─ Revisa y hace click "Aprobar"
   └─ PATCH /api/descuentos-falta/{id}/ 
        └─ estado: PENDIENTE → APROBADA
        
4. LIQUIDACIÓN (Directorio genera pago)
   └─ Click "Generar liquidación"
   └─ POST /api/pagos/generar-liquidacion/
   └─ Sistema calcula automáticamente:
      ├─ Sum(descuentos APROBADA para este músico)
      ├─ Sum(adelantos APROBADA para este músico)
      └─ neto = salario - desc + adelantos
      
5. PAGO REALIZADO
   └─ Directorio marca como PAGADO
   └─ Descuentos y Adelantos → estado LIQUIDADA
```

---

## 🛠️ Cambios en models.py

```python
# ELIMINAR
- Modulo
- RolModulo
- UsuarioModulo
- Descuento (antiguo)
- Adelanto (antiguo)
- DescuentoPorSeccion
- AdelantoPorSeccion
- TipoSancion (simplificar)

# MANTENER (Refactorizar)
- Musico
- Usuario (solo rol)
- Evento
- Asistencia
- Pago (refactorizar cálculos)
- ContratoMusico

# CREAR
- DescuentoFalta (basado en Sancion)
- AdelantoMusico (nuevo, simple)

# RENOMBRAR
- Sancion → DescuentoFalta
```

---

## 📋 Checklist de implementación

- [ ] Eliminar models: Modulo, RolModulo, UsuarioModulo
- [ ] Eliminar models: Descuento, Adelanto, DescuentoPorSeccion, AdelantoPorSeccion
- [ ] Renombrar Sancion → DescuentoFalta
- [ ] Crear model AdelantoMusico
- [ ] Refactorizar Pago con cálculos automáticos
- [ ] Eliminar serializers antiguos
- [ ] Crear serializers nuevos: DescuentoFaltaSerializer, AdelantoMusicoSerializer
- [ ] Eliminar ViewSets antiguos
- [ ] Crear ViewSets nuevos con permisos simples
- [ ] Actualizar URLs (api/urls.py)
- [ ] Crear y ejecutar migraciones
- [ ] Crear script de dato de prueba
- [ ] Crear usuario admin + jefe de sección + directorio
- [ ] Probar APIs
- [ ] Actualizar Android para nuevos endpoints
- [ ] Actualizar React para nuevos endpoints

---

## ✨ Ventajas de esta arquitectura

✅ **Simple:** Modelos claros, sin sobrecarga
✅ **Seguro:** Control por sección sin RBAC complejo
✅ **Escalable:** Fácil agregar más secciones
✅ **Transparente:** El directorio ve exactamente de dónde vinieron los datos
✅ **Automático:** Liquidaciones se calculan sin error manual
✅ **Distribuido:** Datos entran desde app móvil + frontend

---

**¿Aprobas este plan para proceder?** ✅

Si apruebas, haré:
1. Eliminar modelos innecesarios
2. Crear modelos nuevos (DescuentoFalta, AdelantoMusico)
3. Refactorizar Pago
4. Crear nuevos serializers y ViewSets
5. Actualizar URLs
6. Crear migraciones
7. Script de datos de prueba
