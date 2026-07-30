# 📱 Contrato de API - App Kotlin (SisBanda Mobile)

**Versión:** 1.0  
**Fecha:** 2026-06-12  
**Audiencia:** Desarrolladores Android/Kotlin  
**Base URL:** `http://192.168.3.179:8000/api/` (o variable de entorno `API_BASE_URL`)

---

## 🔐 Autenticación (JWT)

### 1. Login - Obtener Token de Acceso

**Endpoint:** `POST /token/`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "username": "jefe_trompeta",
  "password": "tu_password"
}
```

**Response (200 OK):**
```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (401 Unauthorized):**
```json
{
  "detail": "Invalid username or password"
}
```

### 2. Refrescar Token (Cuando Expire)

**Endpoint:** `POST /token/refresh/`

**Headers:**
```
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**
```json
{
  "access": "nuevo_access_token",
  "refresh": "nuevo_refresh_token"
}
```

---

## 📝 Headers Requeridos en Todas las Peticiones

```kotlin
// En Retrofit 2, usar Interceptor:
class AuthInterceptor(private val tokenManager: TokenManager) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = tokenManager.getAccessToken()
        val request = chain.request().newBuilder()
            .addHeader("Authorization", "Bearer $token")
            .build()
        return chain.proceed(request)
    }
}

// Aplicar al OkHttpClient:
val okHttpClient = OkHttpClient.Builder()
    .addInterceptor(AuthInterceptor(tokenManager))
    .connectTimeout(10, TimeUnit.SECONDS)
    .readTimeout(10, TimeUnit.SECONDS)
    .build()

val retrofit = Retrofit.Builder()
    .baseUrl("http://192.168.3.179:8000/api/")
    .addConverterFactory(GsonConverterFactory.create())
    .client(okHttpClient)
    .build()
```

---

## 📊 Endpoints por Rol

### 👨‍💼 JEFE DE SECCIÓN - Registrar Descuentos

**Endpoint:** `POST /descuentos/registrar_app/`

**Autenticación:** Token Bearer (obligatorio)

**Permisos:** Solo Jefes de Sección pueden registrar descuentos en su sección

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "musicos": [
    {
      "musico_id": 5,
      "monto": 150.00,
      "motivo": "Falta a ensayo",
      "fecha": "2026-06-12"
    },
    {
      "documento_identidad": "12345678",
      "monto": 75.50,
      "motivo": "Tardanza (15 minutos)",
      "fecha": "2026-06-11"
    },
    {
      "nombre": "Juan Pérez",
      "monto": 100.00,
      "motivo": "Uniforme incompleto",
      "fecha": "2026-06-12"
    }
  ],
  "observaciones": "Descuentos del evento San Juan"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "registrados": 3,
  "total_descuentos": 325.50,
  "errores": []
}
```

**Response (400 Bad Request):**
```json
{
  "success": false,
  "registrados": 1,
  "total_descuentos": 225.50,
  "errores": [
    {
      "item": {"nombre": "Roberto Silva", "monto": 100.00},
      "error": "Músico no pertenece a tu sección (TROMPETA)"
    }
  ]
}
```

**Response (403 Forbidden):**
```json
{
  "error": "Sin permisos. Solo Directores, Subdirectores, Presidentes y Jefes de Sección pueden registrar descuentos."
}
```

---

### 🎯 DIRECTOR / PRESIDENTE - Registrar Adelantos

**Endpoint:** `POST /adelantos/registrar_app/`

**Autenticación:** Token Bearer (obligatorio)

**Permisos:** Solo Director, Subdirector y Presidente

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Body (JSON):**
```json
{
  "musicos": [
    {
      "musico_id": 12,
      "monto": 500.00,
      "motivo": "Adelanto para compra de instrumento",
      "fecha": "2026-06-12"
    },
    {
      "documento_identidad": "87654321",
      "monto": 300.00,
      "motivo": "Adelanto de honorarios",
      "fecha": "2026-06-12"
    },
    {
      "nombre": "Carlos López",
      "monto": 250.00,
      "motivo": "Soporte económico",
      "fecha": "2026-06-12"
    }
  ],
  "observaciones": "Adelantos aprobados en junta directiva"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "registrados": 3,
  "total_adelantos": 1050.00,
  "errores": []
}
```

**Response (403 Forbidden):**
```json
{
  "error": "Sin permisos. Solo Directores, Subdirectores, Presidentes y Jefes de Sección pueden registrar descuentos."
}
```

---

## 🔍 Endpoints de Consulta (Ambos Roles)

### Listar Descuentos

**Endpoint:** `GET /descuentos/`

**Parámetros Query:** (opcionales)
- `search`: Buscar por nombre del músico o motivo
- `ordering`: `-fecha_falta` (por defecto, más recientes primero)

**Response (200 OK):**
```json
{
  "count": 150,
  "next": "http://192.168.3.179:8000/api/descuentos/?page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "musico": 5,
      "musico_nombre": "Juan Pérez",
      "jefe_seccion": 3,
      "monto": 150.00,
      "motivo": "Falta a ensayo",
      "fecha_falta": "2026-06-12",
      "origen": "APP_MOVIL",
      "estado": "APROBADA",
      "creado_en": "2026-06-12T14:30:00Z"
    }
  ]
}
```

### Listar Adelantos

**Endpoint:** `GET /adelantos/`

**Response (200 OK):**
```json
{
  "count": 45,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": 101,
      "musico": 12,
      "musico_nombre": "Roberto Silva",
      "monto": 500.00,
      "motivo": "Adelanto para compra de instrumento",
      "fecha": "2026-06-12",
      "origen": "APP_MOVIL",
      "estado": "APROBADA",
      "registrado_por": 1,
      "registrado_por_nombre": "Director Juan",
      "creado_en": "2026-06-12T10:15:00Z"
    }
  ]
}
```

---

## 🛠️ Implementación en Retrofit (Kotlin)

### Data Classes

```kotlin
// Request DTOs
data class LoginRequest(
    val username: String,
    val password: String
)

data class TokenResponse(
    val access: String,
    val refresh: String
)

data class DescuentoItem(
    val musico_id: Int? = null,
    val documento_identidad: String? = null,
    val nombre: String? = null,
    val monto: Double,
    val motivo: String,
    val fecha: String = LocalDate.now().toString()
)

data class DescuentoRequest(
    val musicos: List<DescuentoItem>,
    val observaciones: String = "Registro desde app móvil"
)

data class DescuentoResponse(
    val success: Boolean,
    val registrados: Int,
    val total_descuentos: Double,
    val errores: List<ErrorItem>
)

data class AdelantoItem(
    val musico_id: Int? = null,
    val documento_identidad: String? = null,
    val nombre: String? = null,
    val monto: Double,
    val motivo: String,
    val fecha: String = LocalDate.now().toString()
)

data class AdelantoRequest(
    val musicos: List<AdelantoItem>,
    val observaciones: String = "Registro desde app móvil"
)

data class AdelantoResponse(
    val success: Boolean,
    val registrados: Int,
    val total_adelantos: Double,
    val errores: List<ErrorItem>
)

data class ErrorItem(
    val item: Any,
    val error: String
)
```

### API Service Interface

```kotlin
interface SisBandaAPI {
    
    @POST("token/")
    suspend fun login(@Body request: LoginRequest): TokenResponse
    
    @POST("token/refresh/")
    suspend fun refreshToken(@Body request: RefreshRequest): TokenResponse
    
    @POST("descuentos/registrar_app/")
    suspend fun registrarDescuentos(
        @Body request: DescuentoRequest
    ): DescuentoResponse
    
    @POST("adelantos/registrar_app/")
    suspend fun registrarAdelantos(
        @Body request: AdelantoRequest
    ): AdelantoResponse
    
    @GET("descuentos/")
    suspend fun obtenerDescuentos(
        @Query("search") search: String? = null,
        @Query("ordering") ordering: String = "-fecha_falta"
    ): PaginatedResponse<DescuentoResponse>
    
    @GET("adelantos/")
    suspend fun obtenerAdelantos(
        @Query("ordering") ordering: String = "-fecha"
    ): PaginatedResponse<AdelantoResponse>
}
```

### Token Manager

```kotlin
class TokenManager(context: Context) {
    private val preferences = context.getSharedPreferences("tokens", Context.MODE_PRIVATE)
    
    fun saveTokens(access: String, refresh: String) {
        preferences.edit().apply {
            putString("access_token", access)
            putString("refresh_token", refresh)
            commit()
        }
    }
    
    fun getAccessToken(): String? = preferences.getString("access_token", null)
    fun getRefreshToken(): String? = preferences.getString("refresh_token", null)
    
    fun clearTokens() {
        preferences.edit().clear().commit()
    }
}
```

---

## 🔔 Manejo de Errores

| Código HTTP | Significado | Acción |
|---|---|---|
| **200 OK** | Petición exitosa | Procesar respuesta normalmente |
| **201 Created** | Recurso creado | Mostrar confirmación |
| **400 Bad Request** | Datos inválidos | Validar formulario, mostrar `error` en JSON |
| **401 Unauthorized** | Token expirado o inválido | Refrescar token o redirigir a login |
| **403 Forbidden** | Sin permisos (rol incorrecto) | Mostrar mensaje: "No tienes permisos para esta acción" |
| **404 Not Found** | Endpoint no existe | Verificar URL y versión de API |
| **500 Server Error** | Error del servidor | Reintentar después de 5 segundos |

---

## 📋 Reglas de Negocio (Validaciones Cliente)

1. **Jefe de Sección**
   - ✅ Puede registrar descuentos en su sección
   - ✅ Puede ver descuentos de su sección
   - ❌ No puede registrar adelantos
   - ❌ No puede ver adelantos

2. **Director / Subdirector / Presidente**
   - ✅ Pueden registrar descuentos en cualquier sección
   - ✅ Pueden registrar adelantos
   - ✅ Pueden ver todos los descuentos y adelantos
   - ✅ Acceso total a todas las funciones

3. **Validaciones de Formulario**
   - Monto debe ser > 0
   - Fecha no puede ser futura
   - Motivo debe tener al menos 5 caracteres
   - Debe seleccionar al menos 1 músico

---

## 🧪 Ejemplo Completo: Registrar Descuentos (Jefe de Sección)

```kotlin
// 1. Login
val loginRequest = LoginRequest("jefe_trompeta", "password123")
val tokenResponse = api.login(loginRequest)
tokenManager.saveTokens(tokenResponse.access, tokenResponse.refresh)

// 2. Preparar descuentos
val descuentos = listOf(
    DescuentoItem(
        musico_id = 5,
        monto = 150.00,
        motivo = "Falta a ensayo",
        fecha = "2026-06-12"
    ),
    DescuentoItem(
        documento_identidad = "12345678",
        monto = 75.50,
        motivo = "Tardanza (15 minutos)"
    )
)

// 3. Registrar
val request = DescuentoRequest(descuentos, "Descuentos del evento San Juan")
try {
    val response = api.registrarDescuentos(request)
    if (response.success) {
        println("✅ ${response.registrados} descuentos registrados")
        println("💰 Total: Bs${response.total_descuentos}")
        if (response.errores.isNotEmpty()) {
            println("⚠️ ${response.errores.size} errores:")
            response.errores.forEach { error ->
                println("  - ${error.error}")
            }
        }
    }
} catch (e: HttpException) {
    when (e.code()) {
        403 -> println("❌ No tienes permisos")
        401 -> println("❌ Token expirado, re-autentica")
        else -> println("❌ Error: ${e.message()}")
    }
}
```

---

## 🔄 Flujo de Autenticación con Refresh Token

```kotlin
class ApiClient(context: Context) {
    private val tokenManager = TokenManager(context)
    private val httpClient = OkHttpClient.Builder()
        .addInterceptor(AuthInterceptor(tokenManager))
        .addInterceptor(TokenRefreshInterceptor(this))
        .build()
    
    private val retrofit = Retrofit.Builder()
        .baseUrl("http://192.168.3.179:8000/api/")
        .addConverterFactory(GsonConverterFactory.create())
        .client(httpClient)
        .build()
    
    val api = retrofit.create(SisBandaAPI::class.java)
    
    suspend fun refreshAccessToken(): Boolean {
        val refresh = tokenManager.getRefreshToken() ?: return false
        return try {
            val response = api.refreshToken(RefreshRequest(refresh))
            tokenManager.saveTokens(response.access, response.refresh)
            true
        } catch (e: Exception) {
            tokenManager.clearTokens()
            false
        }
    }
}

class TokenRefreshInterceptor(private val apiClient: ApiClient) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val response = chain.proceed(chain.request())
        
        if (response.code == 401) {
            // Token expirado, intentar refrescar
            runBlocking {
                if (apiClient.refreshAccessToken()) {
                    // Reintentar con nuevo token
                    return chain.proceed(chain.request())
                }
            }
        }
        return response
    }
}
```

---

## 📌 Notas Importantes

- **Timeout:** 10 segundos para todas las peticiones
- **Paginación:** Soportada (parámetro `page` en query)
- **Rate Limiting:** No implementado (agregarlo en producción)
- **SSL/TLS:** Usar HTTPS en producción
- **User-Agent:** Incluir identificación de la app: `SisBanda-Mobile/1.0`

---

## 🚀 Deploy Checklist

- [ ] Configurar variable de entorno `API_BASE_URL`
- [ ] Implementar manejo de RefreshToken
- [ ] Encriptar tokens en SharedPreferences (EncryptedSharedPreferences)
- [ ] Agregar retry logic con exponential backoff
- [ ] Implementar logging con Timber
- [ ] Agregar analytics para errores
- [ ] Configurar SSL pinning en producción
- [ ] Probar en emulador y dispositivo real

---

**Fin del contrato de API**
