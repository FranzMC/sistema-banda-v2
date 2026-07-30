# 📚 GUÍA COMPLETA: ARQUITECTURA, PROTOCOLOS Y TESTING

**Documento:** Arquitectura de Módulos + Testing Unitario e Integración  
**Versión:** 1.0  
**Fecha:** 2026-06-12  
**Audiencia:** Desarrolladores Full-Stack (Backend + Mobile)

---

# TABLA DE CONTENIDOS

1. [Arquitectura General del Sistema](#arquitectura-general)
2. [Módulo 1: Autenticación (JWT)](#módulo-autenticación)
3. [Módulo 2: Descuentos](#módulo-descuentos)
4. [Módulo 3: Adelantos](#módulo-adelantos)
5. [Módulo 4: Pagos y Liquidación](#módulo-pagos)
6. [Protocolo de Comunicación](#protocolo-comunicación)
7. [Testing Unitario](#testing-unitario)
8. [Testing de Integración](#testing-integración)
9. [Flujos de Prueba End-to-End](#flujos-e2e)

---

# 🏗️ ARQUITECTURA GENERAL

## Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│              APLICACIÓN KOTLIN (Android)                │
│  ┌───────────────────────────────────────────────────┐  │
│  │ UI Layer (Activity/Fragment)                      │  │
│  │  - LoginActivity                                  │  │
│  │  - DescuentosFragment                             │  │
│  │  - AdelantosFragment                              │  │
│  └────────────────────┬────────────────────────────┘  │
│                       │                                 │
│  ┌────────────────────▼────────────────────────────┐  │
│  │ ViewModel + Repository Pattern                  │  │
│  │  - LoginViewModel / AuthRepository              │  │
│  │  - DescuentoViewModel / DescuentoRepository     │  │
│  │  - AdelantoViewModel / AdelantoRepository       │  │
│  └────────────────────┬────────────────────────────┘  │
│                       │                                 │
│  ┌────────────────────▼────────────────────────────┐  │
│  │ Local Database (Room)                           │  │
│  │  - Token Cache                                  │  │
│  │  - Descuentos Offline                           │  │
│  │  - Adelantos Offline                            │  │
│  └────────────────────┬────────────────────────────┘  │
│                       │                                 │
└───────────────────────┼─────────────────────────────────┘
                        │ HTTP/REST
         ┌──────────────┴──────────────┐
         │ RETROFIT 2 + OkHttp         │
         │ - Interceptor (Auth)        │
         │ - Token Refresh             │
         │ - Retry Logic               │
         └──────────────┬──────────────┘
                        │ HTTPS/TLS
┌───────────────────────▼─────────────────────────────────┐
│           BACKEND DJANGO (Python)                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Django REST Framework (DRF)                       │  │
│  │  - ViewSets (Descuento, Adelanto, Pago)         │  │
│  │  - Serializers                                    │  │
│  │  - Permissions & Authentication                  │  │
│  └────────────────────┬────────────────────────────┘  │
│                       │                                 │
│  ┌────────────────────▼────────────────────────────┐  │
│  │ Business Logic Layer (Services)                 │  │
│  │  - DescuentoService                             │  │
│  │  - AdelantoService                              │  │
│  │  - LiquidacionService                           │  │
│  │  - RendimientoService                           │  │
│  └────────────────────┬────────────────────────────┘  │
│                       │                                 │
│  ┌────────────────────▼────────────────────────────┐  │
│  │ ORM Layer (Django Models)                       │  │
│  │  - Usuario, Musico, Descuento, Adelanto, Pago  │  │
│  │  - Relationships & Constraints                  │  │
│  └────────────────────┬────────────────────────────┘  │
│                       │                                 │
└───────────────────────┼─────────────────────────────────┘
                        │ SQL
         ┌──────────────┴──────────────┐
         │ PostgreSQL (Producción)    │
         │ SQLite (Desarrollo)        │
         └────────────────────────────┘
```

---

# 🔐 MÓDULO 1: AUTENTICACIÓN (JWT)

## 1.1 Flujo de Autenticación

```
┌─────────────┐
│   Usuario   │
└──────┬──────┘
       │ 1. Ingresa credenciales
       │    (username, password)
       ▼
┌──────────────────────────────┐
│ LoginActivity (Kotlin)       │
│  - Valida formulario         │
│  - Muestra loading           │
└──────┬───────────────────────┘
       │ 2. POST /token/
       │    {"username": "...", "password": "..."}
       ▼
┌──────────────────────────────┐
│ Django: TokenObtainPairView  │
│  - Verifica credenciales     │
│  - Genera JWT (access/refresh)
└──────┬───────────────────────┘
       │ 3. Response 200 OK
       │    {"access": "...", "refresh": "..."}
       ▼
┌──────────────────────────────┐
│ TokenManager (Kotlin)        │
│  - Encripta tokens           │
│  - Guarda en SharedPreferences
└──────┬───────────────────────┘
       │ 4. Token guardado
       ▼
┌──────────────────────────────┐
│ App Protegida               │
│  - Acceso a módulos          │
│  - Token en header           │
└──────────────────────────────┘
```

## 1.2 Estructura de JWT Token

```json
// Header
{
  "alg": "HS256",
  "typ": "JWT"
}

// Payload
{
  "token_type": "access",
  "exp": 1781230304,           // Expira en 200 días
  "iat": 1781226704,           // Emitido en
  "jti": "96cddadade1e434882",
  "user_id": 3,
  "username": "jefe_trompeta",
  "rol": "JEFE_SECCION"
}

// Signature
HMACSHA256(
  base64UrlEncode(header) + "." +
  base64UrlEncode(payload),
  "tu_secret_key"
)
```

## 1.3 Flujo de Refresh Token

```
┌─────────────────────┐
│ Token Expirado 401  │
└──────────┬──────────┘
           │ 1. TokenRefreshInterceptor detecta 401
           ▼
┌──────────────────────────────┐
│ Verifica refresh_token       │
└──────────┬───────────────────┘
           │ 2. POST /token/refresh/
           │    {"refresh": "old_refresh_token"}
           ▼
┌──────────────────────────────┐
│ Django: TokenRefreshView     │
│  - Valida refresh token      │
│  - Emite nuevo access token  │
└──────────┬───────────────────┘
           │ 3. Response 200 OK
           │    {"access": "new_token"}
           ▼
┌──────────────────────────────┐
│ TokenManager                 │
│  - Actualiza access token    │
└──────────┬───────────────────┘
           │ 4. Reintenta petición original
           ▼
┌──────────────────────────────┐
│ Petición Exitosa 200         │
└──────────────────────────────┘
```

## 1.4 Implementación Backend (Django)

```python
# gestion_banda/urls.py
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]
```

## 1.5 Implementación Frontend (Kotlin)

### Data Classes

```kotlin
// LoginRequest.kt
data class LoginRequest(
    val username: String,
    val password: String
)

// TokenResponse.kt
data class TokenResponse(
    val access: String,
    val refresh: String
)

// RefreshTokenRequest.kt
data class RefreshTokenRequest(
    val refresh: String
)
```

### TokenManager - Gestión de Tokens

```kotlin
// TokenManager.kt
import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.google.gson.Gson

class TokenManager(context: Context) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val encryptedPreferences = EncryptedSharedPreferences.create(
        context,
        "auth_tokens",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    companion object {
        private const val ACCESS_TOKEN_KEY = "access_token"
        private const val REFRESH_TOKEN_KEY = "refresh_token"
        private const val USER_ID_KEY = "user_id"
        private const val USER_ROL_KEY = "user_rol"
    }

    // Guardar tokens después de login exitoso
    fun saveTokens(response: TokenResponse, userId: Int, rol: String) {
        encryptedPreferences.edit().apply {
            putString(ACCESS_TOKEN_KEY, response.access)
            putString(REFRESH_TOKEN_KEY, response.refresh)
            putInt(USER_ID_KEY, userId)
            putString(USER_ROL_KEY, rol)
            apply()
        }
    }

    // Obtener access token (usado en peticiones)
    fun getAccessToken(): String? {
        return encryptedPreferences.getString(ACCESS_TOKEN_KEY, null)
    }

    // Obtener refresh token (usado para renovar)
    fun getRefreshToken(): String? {
        return encryptedPreferences.getString(REFRESH_TOKEN_KEY, null)
    }

    // Obtener rol del usuario autenticado
    fun getUserRol(): String? {
        return encryptedPreferences.getString(USER_ROL_KEY, null)
    }

    // Verificar si hay sesión activa
    fun hasTokens(): Boolean {
        return getAccessToken() != null && getRefreshToken() != null
    }

    // Limpiar tokens (logout)
    fun clearTokens() {
        encryptedPreferences.edit().clear().apply()
    }

    // Verificar si token está próximo a expirar (en 5 minutos)
    fun isTokenExpiringSoon(): Boolean {
        val token = getAccessToken() ?: return true
        return try {
            val parts = token.split(".")
            if (parts.size != 3) return true
            
            val decoder = Base64.getDecoder()
            val payload = String(decoder.decode(parts[1]))
            val json = JSONObject(payload)
            val expiresAt = json.getLong("exp") * 1000
            val currentTime = System.currentTimeMillis()
            
            (expiresAt - currentTime) < 5 * 60 * 1000 // 5 minutos
        } catch (e: Exception) {
            true
        }
    }
}
```

### AuthInterceptor - Agregar Token a Peticiones

```kotlin
// AuthInterceptor.kt
import okhttp3.Interceptor
import okhttp3.Response

class AuthInterceptor(private val tokenManager: TokenManager) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = tokenManager.getAccessToken()
        
        val request = if (token != null) {
            chain.request().newBuilder()
                .addHeader("Authorization", "Bearer $token")
                .addHeader("User-Agent", "SisBanda-Mobile/1.0")
                .build()
        } else {
            chain.request()
        }
        
        return chain.proceed(request)
    }
}
```

### TokenRefreshInterceptor - Renovar Token Automático

```kotlin
// TokenRefreshInterceptor.kt
import okhttp3.Interceptor
import okhttp3.Response
import kotlinx.coroutines.runBlocking

class TokenRefreshInterceptor(
    private val tokenManager: TokenManager,
    private val apiService: SisBandaAPI
) : Interceptor {
    
    override fun intercept(chain: Interceptor.Chain): Response {
        val response = chain.proceed(chain.request())
        
        // Si recibe 401, intentar refrescar token
        if (response.code == 401) {
            val refreshToken = tokenManager.getRefreshToken()
            
            if (refreshToken != null) {
                try {
                    // Bloquear hasta obtener nuevo token
                    val newTokenResponse = runBlocking {
                        apiService.refreshToken(
                            RefreshTokenRequest(refreshToken)
                        )
                    }
                    
                    // Guardar nuevo token
                    tokenManager.saveTokens(newTokenResponse, -1, "")
                    
                    // Reintentar petición original con nuevo token
                    val newRequest = chain.request().newBuilder()
                        .header("Authorization", "Bearer ${newTokenResponse.access}")
                        .build()
                    
                    response.close()
                    return chain.proceed(newRequest)
                    
                } catch (e: Exception) {
                    // Error refrescando, limpiar y redirigir a login
                    tokenManager.clearTokens()
                }
            }
        }
        
        return response
    }
}
```

### LoginViewModel - Lógica de Login

```kotlin
// LoginViewModel.kt
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.liveData
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class LoginViewModel(
    private val authRepository: AuthRepository,
    private val tokenManager: TokenManager
) : ViewModel() {
    
    fun login(username: String, password: String) = liveData(Dispatchers.Main) {
        try {
            emit(Resource.Loading())
            
            // Validar campos
            if (username.isBlank() || password.isBlank()) {
                emit(Resource.Error("Ingresa usuario y contraseña"))
                return@liveData
            }
            
            // Llamar API
            val response = withContext(Dispatchers.IO) {
                authRepository.login(LoginRequest(username, password))
            }
            
            // Guardar tokens
            tokenManager.saveTokens(response, 0, "")
            
            emit(Resource.Success("Login exitoso"))
            
        } catch (e: HttpException) {
            when (e.code()) {
                401 -> emit(Resource.Error("Usuario o contraseña incorrectos"))
                500 -> emit(Resource.Error("Error del servidor"))
                else -> emit(Resource.Error(e.message ?: "Error desconocido"))
            }
        } catch (e: Exception) {
            emit(Resource.Error("Error de conexión: ${e.message}"))
        }
    }
    
    fun logout() {
        tokenManager.clearTokens()
    }
}

// Factory para ViewModel
class LoginViewModelFactory(
    private val authRepository: AuthRepository,
    private val tokenManager: TokenManager
) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return LoginViewModel(authRepository, tokenManager) as T
    }
}
```

---

# 💰 MÓDULO 2: DESCUENTOS

## 2.1 Flujo de Negocio - Registrar Descuentos

```
┌──────────────────────┐
│ Jefe de Sección      │
│ (App Kotlin)         │
└──────────┬───────────┘
           │ 1. Selecciona músicos de su sección
           │ 2. Ingresa montos y motivos
           │ 3. Presiona "Registrar"
           ▼
┌──────────────────────────────────────────┐
│ DescuentosViewModel.registrarDescuentos()│
│ - Valida montos > 0                      │
│ - Valida motivos no vacíos               │
│ - Prepara payload JSON                   │
└──────────┬───────────────────────────────┘
           │ 4. POST /descuentos/registrar_app/
           │    Body: {"musicos": [...]}
           ▼
┌──────────────────────────────────────────┐
│ Django: DescuentoViewSet.registrar_app() │
│                                          │
│ 1. Verifica Authorization header         │
│    - Extrae JWT token                    │
│    - Valida firma                        │
│    - Obtiene request.user                │
│                                          │
│ 2. Valida permisos                       │
│    - Si rol == JEFE_SECCION:             │
│      obtener JefeSeccion.seccion         │
│    - Si rol != [DIR, PRES]:              │
│      return 403 Forbidden                │
│                                          │
│ 3. Por cada músico:                      │
│    - Buscar Musico por ID/CI/nombre     │
│    - Validar monto > 0                   │
│    - Si JEFE_SECCION:                    │
│      validar musico.instrumento          │
│      == jefe.seccion                     │
│    - Crear Descuento.objects.create()   │
│                                          │
│ 4. Registrar en auditoría                │
│    - descuento.jefe_seccion = jefe       │
│    - descuento.origen = 'APP_MOVIL'      │
│    - descuento.estado = 'APROBADA'       │
│                                          │
│ 5. Retornar respuesta                    │
└──────────┬───────────────────────────────┘
           │ 5. Response 200 OK
           │    {"success": true,
           │     "registrados": 3,
           │     "total_descuentos": 325.50}
           ▼
┌──────────────────────────────────────────┐
│ DescuentosRepository.guardarLocalmente() │
│ - Almacena en Room DB (cache)            │
│ - Sincroniza timestamp                   │
└──────────┬───────────────────────────────┘
           │ 6. DescuentosViewModel
           │    emit(Success)
           ▼
┌──────────────────────────────────────────┐
│ UI: DescuentosFragment                   │
│ - Muestra "Registrado exitosamente"      │
│ - Recarga lista de descuentos            │
│ - Actualiza totales                      │
└──────────────────────────────────────────┘
```

## 2.2 Modelo de Datos - Descuento

### Backend (Django)

```python
# gestion_banda/models.py
class Descuento(models.Model):
    ESTADOS = [
        ('APROBADA', 'Aprobada'),
        ('LIQUIDADA', 'Liquidada en Pago')
    ]
    
    musico = models.ForeignKey(Musico, on_delete=models.CASCADE)
    jefe_seccion = models.ForeignKey(JefeSeccion, on_delete=models.CASCADE, 
                                     null=True, blank=True)
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    motivo = models.TextField()
    fecha_falta = models.DateField(null=True, blank=True)
    origen = models.CharField(max_length=20, choices=[
        ('APP_MOVIL', 'App Móvil'),
        ('FRONTEND', 'Frontend'),
    ])
    estado = models.CharField(max_length=20, choices=ESTADOS)
    creado_en = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['musico', '-fecha_falta']),
            models.Index(fields=['jefe_seccion', '-fecha_falta']),
        ]
```

### Kotlin (Room Database)

```kotlin
// Database Entity
@Entity(
    tableName = "descuentos",
    indices = [
        Index(value = ["musico_id"]),
        Index(value = ["fecha_falta"])
    ]
)
data class DescuentoEntity(
    @PrimaryKey
    val id: Int,
    val musico_id: Int,
    val monto: Double,
    val motivo: String,
    val fecha_falta: String,
    val origen: String, // "APP_MOVIL", "FRONTEND"
    val estado: String, // "APROBADA", "LIQUIDADA"
    val creado_en: String,
    val sincronizado: Boolean = false
)

// DAO (Data Access Object)
@Dao
interface DescuentoDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(descuento: DescuentoEntity)
    
    @Query("SELECT * FROM descuentos ORDER BY fecha_falta DESC")
    fun getAllDescuentos(): Flow<List<DescuentoEntity>>
    
    @Query("SELECT * FROM descuentos WHERE musico_id = :musicoId")
    suspend fun getDescuentosPorMusico(musicoId: Int): List<DescuentoEntity>
    
    @Query("DELETE FROM descuentos WHERE sincronizado = 1")
    suspend fun limpiarSincronizados()
}
```

## 2.3 Serializers (Validación Backend)

```python
# gestion_banda/serializers.py
from rest_framework import serializers
from .models import Descuento, Musico

class DescuentoSerializer(serializers.ModelSerializer):
    musico_nombre = serializers.CharField(
        source='musico.nombre_completo', 
        read_only=True
    )
    
    class Meta:
        model = Descuento
        fields = ['id', 'musico', 'musico_nombre', 'monto', 'motivo',
                  'fecha_falta', 'origen', 'estado', 'creado_en']
        read_only_fields = ['id', 'estado', 'creado_en']
    
    def validate_monto(self, value):
        """Monto debe ser positivo"""
        if value <= 0:
            raise serializers.ValidationError("El monto debe ser mayor a 0")
        if value > 10000:
            raise serializers.ValidationError("El monto no puede exceder 10,000 Bs")
        return value
    
    def validate_motivo(self, value):
        """Motivo debe tener contenido"""
        if not value or len(value.strip()) < 5:
            raise serializers.ValidationError(
                "El motivo debe tener al menos 5 caracteres"
            )
        return value
```

## 2.4 Repository Pattern (Kotlin)

```kotlin
// DescuentoRepository.kt
class DescuentoRepository(
    private val apiService: SisBandaAPI,
    private val descuentoDao: DescuentoDao,
    private val tokenManager: TokenManager
) {
    
    // Registrar descuentos (POST a servidor)
    suspend fun registrarDescuentos(
        musicos: List<DescuentoItemRequest>
    ): Result<DescuentoResponse> = withContext(Dispatchers.IO) {
        try {
            // Validar localmente primero
            if (musicos.isEmpty()) {
                return@withContext Result.failure(
                    Exception("Debe seleccionar al menos un músico")
                )
            }
            
            musicos.forEach { item ->
                if (item.monto <= 0) {
                    return@withContext Result.failure(
                        Exception("Todos los montos deben ser mayores a 0")
                    )
                }
                if (item.motivo.length < 5) {
                    return@withContext Result.failure(
                        Exception("El motivo debe tener al menos 5 caracteres")
                    )
                }
            }
            
            // Llamar API
            val request = DescuentoRequest(musicos)
            val response = apiService.registrarDescuentos(request)
            
            // Guardar localmente si fue exitoso
            if (response.success) {
                musicos.forEach { item ->
                    descuentoDao.insert(
                        DescuentoEntity(
                            id = item.musico_id ?: -1,
                            musico_id = item.musico_id ?: 0,
                            monto = item.monto,
                            motivo = item.motivo,
                            fecha_falta = item.fecha,
                            origen = "APP_MOVIL",
                            estado = "APROBADA",
                            creado_en = System.currentTimeMillis().toString(),
                            sincronizado = true
                        )
                    )
                }
            }
            
            Result.success(response)
            
        } catch (e: HttpException) {
            Result.failure(
                ApiException(
                    code = e.code(),
                    message = e.response()?.errorBody()?.string() ?: e.message()
                )
            )
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    // Obtener descuentos desde servidor
    suspend fun obtenerDescuentos(): Result<List<DescuentoResponse>> = 
        withContext(Dispatchers.IO) {
        try {
            val response = apiService.obtenerDescuentos()
            Result.success(response.results)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    // Obtener descuentos locales (offline)
    fun obtenerDescuentosLocales(): Flow<List<DescuentoEntity>> {
        return descuentoDao.getAllDescuentos()
    }
}

// DTOs para requests
data class DescuentoItemRequest(
    val musico_id: Int? = null,
    val documento_identidad: String? = null,
    val nombre: String? = null,
    val monto: Double,
    val motivo: String,
    val fecha: String = LocalDate.now().toString()
)

data class DescuentoRequest(
    val musicos: List<DescuentoItemRequest>,
    val observaciones: String = "Registro desde app móvil"
)

data class DescuentoResponse(
    val id: Int,
    val musico: Int,
    val musico_nombre: String,
    val monto: Double,
    val motivo: String,
    val fecha_falta: String,
    val origen: String,
    val estado: String,
    val creado_en: String
)
```

## 2.5 ViewModel (Kotlin)

```kotlin
// DescuentosViewModel.kt
class DescuentosViewModel(
    private val repository: DescuentoRepository
) : ViewModel() {
    
    private val _registroState = MutableLiveData<Resource<DescuentoResponse>>()
    val registroState: LiveData<Resource<DescuentoResponse>> = _registroState
    
    private val _descuentosList = MutableLiveData<Resource<List<DescuentoResponse>>>()
    val descuentosList: LiveData<Resource<List<DescuentoResponse>>> = _descuentosList
    
    // Registrar nuevos descuentos
    fun registrarDescuentos(musicos: List<DescuentoItemRequest>) {
        viewModelScope.launch {
            _registroState.value = Resource.Loading()
            
            val result = repository.registrarDescuentos(musicos)
            
            result.onSuccess { response ->
                _registroState.value = Resource.Success(response)
                // Recargar lista
                obtenerDescuentos()
            }.onFailure { error ->
                _registroState.value = Resource.Error(error.message ?: "Error desconocido")
            }
        }
    }
    
    // Obtener listado de descuentos
    fun obtenerDescuentos() {
        viewModelScope.launch {
            _descuentosList.value = Resource.Loading()
            
            val result = repository.obtenerDescuentos()
            
            result.onSuccess { descuentos ->
                _descuentosList.value = Resource.Success(descuentos)
            }.onFailure { error ->
                _descuentosList.value = Resource.Error(
                    error.message ?: "Error cargando descuentos"
                )
            }
        }
    }
}

// Resource wrapper para estados
sealed class Resource<T> {
    data class Loading<T> : Resource<T>()
    data class Success<T>(val data: T) : Resource<T>()
    data class Error<T>(val message: String) : Resource<T>()
}
```

---

# 💸 MÓDULO 3: ADELANTOS

## 3.1 Flujo de Negocio - Registrar Adelantos

```
┌──────────────────────┐
│ Director/Presidente  │
│ (App Kotlin)         │
└──────────┬───────────┘
           │ 1. Selecciona músicos
           │ 2. Ingresa montos (adelantos de dinero)
           │ 3. Presiona "Registrar"
           ▼
┌──────────────────────────────────────────┐
│ AdelantosViewModel.registrarAdelantos()  │
│ - Valida montos > 0                      │
│ - Valida motivos                         │
│ - Prepara payload JSON                   │
└──────────┬───────────────────────────────┘
           │ 4. POST /adelantos/registrar_app/
           │    Body: {"musicos": [...]}
           ▼
┌──────────────────────────────────────────┐
│ Django: AdelantoViewSet.registrar_app()  │
│                                          │
│ 1. Verifica Authorization header         │
│    - Extrae JWT token                    │
│    - Valida firma                        │
│                                          │
│ 2. Valida permisos ESTRICTOS             │
│    - Solo DIRECTOR, SUBDIRECTOR,         │
│      PRESIDENTE, SUPERUSER               │
│    - Si no: return 403 Forbidden         │
│                                          │
│ 3. Por cada músico:                      │
│    - Buscar Musico por ID/CI/nombre     │
│    - Validar monto > 0                   │
│    - Crear Adelanto.objects.create()     │
│    - Registrar quién lo hizo             │
│      (Adelanto.registrado_por)           │
│                                          │
│ 4. Retornar respuesta                    │
└──────────┬───────────────────────────────┘
           │ 5. Response 200 OK
           │    {"success": true,
           │     "registrados": 2,
           │     "total_adelantos": 1050.00}
           ▼
┌──────────────────────────────────────────┐
│ AdelantosRepository.guardarLocalmente()  │
│ - Almacena en Room DB                    │
└──────────┬───────────────────────────────┘
           │ 6. UI actualizado
           ▼
┌──────────────────────────────────────────┐
│ ✅ "Adelantos registrados exitosamente"  │
└──────────────────────────────────────────┘
```

## 3.2 Diferencia Crítica: Adelantos vs Descuentos

| Aspecto | Descuentos | Adelantos |
|---------|-----------|----------|
| **Quién registra** | Jefe de Sección | Director/Presidente |
| **Aplica a** | Músicos de su sección | Cualquier músico |
| **Representa** | Dinero a restar (falta) | Dinero a restar (deuda) |
| **Efecto en liquidación** | `neto = salario - descuentos` | `neto = salario - adelantos` |
| **Auditoría** | `Descuento.jefe_seccion` | `Adelanto.registrado_por` |
| **Origen típico** | App móvil + Frontend | Frontend (raramente mobile) |

## 3.3 Implementación (Similar a Descuentos)

```kotlin
// AdelantoRepository.kt
class AdelantoRepository(
    private val apiService: SisBandaAPI,
    private val adelantoDao: AdelantoDao
) {
    
    suspend fun registrarAdelantos(
        musicos: List<AdelantoItemRequest>
    ): Result<AdelantoResponse> = withContext(Dispatchers.IO) {
        try {
            // Mismo patrón que descuentos
            val request = AdelantoRequest(musicos)
            val response = apiService.registrarAdelantos(request)
            
            if (response.success) {
                // Guardar localmente
                musicos.forEach { item ->
                    adelantoDao.insert(AdelantoEntity(...))
                }
            }
            
            Result.success(response)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

// AdelantoDAO
@Dao
interface AdelantoDao {
    @Insert
    suspend fun insert(adelanto: AdelantoEntity)
    
    @Query("SELECT * FROM adelantos ORDER BY fecha DESC")
    fun getAllAdelantos(): Flow<List<AdelantoEntity>>
}
```

---

# 📊 MÓDULO 4: PAGOS Y LIQUIDACIÓN

## 4.1 Flujo de Liquidación

```
┌─────────────────────────────────────────┐
│ Liquidar Evento (Backend - Programado)  │
└──────────┬────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│ 1. Obtener todos los Pagos PENDIENTES    │
│    SELECT * FROM pago WHERE estado='...' │
└──────────┬────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│ 2. Por cada Pago:                        │
│                                          │
│   a. Obtener musico                      │
│   b. SELECT SUM(monto) FROM descuentos   │
│      WHERE musico_id = X                 │
│      AND estado = 'APROBADA'             │
│                                          │
│   c. SELECT SUM(monto) FROM adelantos    │
│      WHERE musico_id = X                 │
│      AND estado = 'APROBADA'             │
│                                          │
│   d. CALCULAR:                           │
│      neto = salario_base                 │
│              - descuentos_totales        │
│              - adelantos_totales         │
│                                          │
│   e. UPDATE Pago SET:                    │
│       - descuentos_totales = ...         │
│       - adelantos_totales = ...          │
│       - neto_pagar = ...                 │
│       - estado = 'PAGADO'                │
│                                          │
│   f. UPDATE Descuentos SET:              │
│       - estado = 'LIQUIDADA'             │
│                                          │
│   g. UPDATE Adelantos SET:               │
│       - estado = 'LIQUIDADA'             │
│                                          │
└──────────┬────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────┐
│ 3. Retornar resumen:                     │
│    {                                     │
│      "total_pagado": 45000.00,           │
│      "cantidad_musicos": 25,             │
│      "promedio_por_musico": 1800.00      │
│    }                                     │
└──────────────────────────────────────────┘
```

## 4.2 Modelo de Pago

```python
# gestion_banda/models.py
class Pago(models.Model):
    ESTADOS = [
        ('PENDIENTE', 'Pendiente'),
        ('PAGADO', 'Pagado'),
    ]
    
    musico = models.ForeignKey(Musico, on_delete=models.CASCADE)
    planilla = models.ForeignKey(PlanillaLiquidacion, on_delete=models.CASCADE)
    
    salario_base = models.DecimalField(max_digits=10, decimal_places=2)
    descuentos_totales = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    adelantos_totales = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    neto_pagar = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    estado = models.CharField(max_length=20, choices=ESTADOS)
    fecha_liquidacion = models.DateTimeField(auto_now_add=True)
    pagado_en = models.DateTimeField(null=True, blank=True)
    observaciones = models.TextField(blank=True)
    
    def calcular_totales(self):
        """Calcula automáticamente descuentos y adelantos"""
        # Sumar descuentos aprobados
        desc = Descuento.objects.filter(
            musico=self.musico,
            estado='APROBADA'
        ).aggregate(total=models.Sum('monto'))['total'] or Decimal('0.00')
        
        # Sumar adelantos aprobados
        adelanto = Adelanto.objects.filter(
            musico=self.musico,
            estado='APROBADA'
        ).aggregate(total=models.Sum('monto'))['total'] or Decimal('0.00')
        
        # FÓRMULA CLAVE
        self.descuentos_totales = desc
        self.adelantos_totales = adelanto
        self.neto_pagar = self.salario_base - self.descuentos_totales - self.adelantos_totales
    
    def save(self, *args, **kwargs):
        self.calcular_totales()  # Ejecutar siempre antes de guardar
        super().save(*args, **kwargs)
```

---

# 🔄 PROTOCOLO DE COMUNICACIÓN

## Tabla de Resumen de Endpoints

| Módulo | Método | Endpoint | Autenticación | Permisos |
|--------|--------|----------|---|---|
| **Auth** | POST | /token/ | ❌ No | Público |
| **Auth** | POST | /token/refresh/ | ❌ No | Público |
| **Descuentos** | POST | /descuentos/registrar_app/ | ✅ JWT | JEFE_SECCION, DIRECTOR, PRESIDENTE |
| **Descuentos** | GET | /descuentos/ | ✅ JWT | Autenticado |
| **Adelantos** | POST | /adelantos/registrar_app/ | ✅ JWT | DIRECTOR, PRESIDENTE |
| **Adelantos** | GET | /adelantos/ | ✅ JWT | Autenticado |
| **Pagos** | GET | /pagos/ | ✅ JWT | DIRECTOR, PRESIDENTE |

## Estructura General de Petición

```
GET/POST/PUT/DELETE /api/endpoint/

Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  Content-Type: application/json
  User-Agent: SisBanda-Mobile/1.0
  X-Request-ID: 550e8400-e29b-41d4-a716-446655440000 (Opcional)

Body (solo POST/PUT):
  {
    "key1": "value1",
    "key2": "value2"
  }

Parámetros Query (solo GET):
  ?search=texto&ordering=-fecha&page=1
```

## Estructura General de Respuesta

```
200 OK:
  {
    "id": 1,
    "campo1": "valor1",
    "campo2": "valor2"
  }

201 Created:
  {
    "id": 123,
    "mensaje": "Recurso creado exitosamente"
  }

400 Bad Request:
  {
    "error": "La lista de músicos es obligatoria"
  }

401 Unauthorized:
  {
    "detail": "Invalid token"
  }

403 Forbidden:
  {
    "error": "Sin permisos"
  }

500 Server Error:
  {
    "error": "Internal server error"
  }
```

---

# ✅ TESTING UNITARIO

## 1. Testing Backend (Django + pytest)

### 1.1 Instalación de Dependencias

```bash
pip install pytest pytest-django pytest-asyncio factory-boy faker
```

### 1.2 Configuración de pytest

```python
# pytest.ini
[pytest]
DJANGO_SETTINGS_MODULE = core.settings
python_files = tests.py test_*.py *_tests.py
addopts = --verbose --tb=short
testpaths = gestion_banda/tests
```

### 1.3 Test de Autenticación

```python
# gestion_banda/tests/test_auth.py
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()

@pytest.mark.django_db
class TestAuthenticationEndpoints:
    """Suite de tests para autenticación"""
    
    def setup_method(self):
        """Preparar datos antes de cada test"""
        self.client = APIClient()
        self.user = User.objects.create_user(
            username='jefe_test',
            password='testpass123',
            rol='JEFE_SECCION'
        )
    
    def test_login_exitoso(self):
        """Test: Login con credenciales válidas"""
        response = self.client.post('/api/token/', {
            'username': 'jefe_test',
            'password': 'testpass123'
        }, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        assert 'access' in response.data
        assert 'refresh' in response.data
        assert isinstance(response.data['access'], str)
    
    def test_login_fallido_usuario_no_existe(self):
        """Test: Login con usuario inexistente"""
        response = self.client.post('/api/token/', {
            'username': 'usuario_no_existe',
            'password': 'pass123'
        }, format='json')
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_login_fallido_password_incorreto(self):
        """Test: Login con contraseña incorrecta"""
        response = self.client.post('/api/token/', {
            'username': 'jefe_test',
            'password': 'password_incorrecto'
        }, format='json')
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_refresh_token(self):
        """Test: Renovar token"""
        # Obtener tokens
        login_response = self.client.post('/api/token/', {
            'username': 'jefe_test',
            'password': 'testpass123'
        }, format='json')
        
        refresh_token = login_response.data['refresh']
        
        # Refrescar
        refresh_response = self.client.post('/api/token/refresh/', {
            'refresh': refresh_token
        }, format='json')
        
        assert refresh_response.status_code == status.HTTP_200_OK
        assert 'access' in refresh_response.data
        assert refresh_response.data['access'] != login_response.data['access']
```

### 1.4 Test de Descuentos

```python
# gestion_banda/tests/test_descuentos.py
import pytest
from decimal import Decimal
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from gestion_banda.models import Musico, Descuento, JefeSeccion

User = get_user_model()

@pytest.mark.django_db
class TestDescuentosAPI:
    """Suite de tests para endpoint de descuentos"""
    
    def setup_method(self):
        """Preparar datos antes de cada test"""
        self.client = APIClient()
        
        # Crear usuarios
        self.jefe_user = User.objects.create_user(
            username='jefe_trompeta',
            password='pass123',
            rol='JEFE_SECCION'
        )
        
        self.director_user = User.objects.create_user(
            username='director',
            password='pass123',
            rol='DIRECTOR'
        )
        
        # Crear músicos
        self.musico_trompeta = Musico.objects.create(
            nombres='Juan',
            apellidos='Pérez',
            instrumento='TROMPETA',
            nivel='INTERMEDIO'
        )
        
        self.musico_saxo = Musico.objects.create(
            nombres='Carlos',
            apellidos='López',
            instrumento='SAXOFON',
            nivel='AVANZADO'
        )
        
        # Crear jefe de sección
        self.jefe_seccion = JefeSeccion.objects.create(
            musico=self.musico_trompeta,
            seccion='TROMPETA',
            activo=True
        )
        self.jefe_user.perfil_musico = self.musico_trompeta
        self.jefe_user.save()
    
    def test_registrar_descuento_exitoso(self):
        """Test: Registrar descuento como Jefe de Sección"""
        self.client.force_authenticate(user=self.jefe_user)
        
        response = self.client.post('/api/descuentos/registrar_app/', {
            'musicos': [
                {
                    'musico_id': self.musico_trompeta.id,
                    'monto': 150.00,
                    'motivo': 'Falta a ensayo',
                    'fecha': '2026-06-12'
                }
            ],
            'observaciones': 'Descuento de prueba'
        }, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['success'] == True
        assert response.data['registrados'] == 1
        assert response.data['total_descuentos'] == 150.00
        assert len(response.data['errores']) == 0
    
    def test_registrar_descuento_musico_otra_seccion(self):
        """Test: Jefe intenta registrar descuento a músico de otra sección"""
        self.client.force_authenticate(user=self.jefe_user)
        
        response = self.client.post('/api/descuentos/registrar_app/', {
            'musicos': [
                {
                    'musico_id': self.musico_saxo.id,  # Otro sección
                    'monto': 100.00,
                    'motivo': 'Falta a ensayo'
                }
            ]
        }, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['success'] == True
        assert response.data['registrados'] == 0  # No registró
        assert len(response.data['errores']) == 1  # Tiene error
        assert 'no pertenece a tu sección' in response.data['errores'][0]['error']
    
    def test_registrar_descuento_monto_negativo(self):
        """Test: Validación de monto negativo"""
        self.client.force_authenticate(user=self.jefe_user)
        
        response = self.client.post('/api/descuentos/registrar_app/', {
            'musicos': [
                {
                    'musico_id': self.musico_trompeta.id,
                    'monto': -50.00,  # Negativo
                    'motivo': 'Falta a ensayo'
                }
            ]
        }, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['registrados'] == 0
        assert len(response.data['errores']) == 1
    
    def test_registrar_descuento_sin_autenticacion(self):
        """Test: Rechazar petición sin token"""
        response = self.client.post('/api/descuentos/registrar_app/', {
            'musicos': [...]
        }, format='json')
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_director_puede_registrar_cualquier_seccion(self):
        """Test: Director puede registrar descuentos en cualquier sección"""
        self.client.force_authenticate(user=self.director_user)
        
        response = self.client.post('/api/descuentos/registrar_app/', {
            'musicos': [
                {
                    'musico_id': self.musico_saxo.id,
                    'monto': 200.00,
                    'motivo': 'Falta a ensayo'
                }
            ]
        }, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['success'] == True
        assert response.data['registrados'] == 1
```

### 1.5 Test de Adelantos

```python
# gestion_banda/tests/test_adelantos.py
import pytest
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from gestion_banda.models import Musico, JefeSeccion

User = get_user_model()

@pytest.mark.django_db
class TestAdelantosAPI:
    """Suite de tests para endpoint de adelantos"""
    
    def setup_method(self):
        self.client = APIClient()
        
        # Solo Director puede registrar adelantos
        self.director = User.objects.create_user(
            username='director',
            password='pass123',
            rol='DIRECTOR'
        )
        
        self.jefe = User.objects.create_user(
            username='jefe',
            password='pass123',
            rol='JEFE_SECCION'
        )
        
        self.musico = Musico.objects.create(
            nombres='Roberto',
            apellidos='Silva',
            instrumento='TROMPETA'
        )
    
    def test_jefe_seccion_NO_puede_registrar_adelantos(self):
        """Test: Jefe de Sección rechazado al registrar adelantos"""
        self.client.force_authenticate(user=self.jefe)
        
        response = self.client.post('/api/adelantos/registrar_app/', {
            'musicos': [
                {
                    'musico_id': self.musico.id,
                    'monto': 500.00,
                    'motivo': 'Adelanto de sueldo'
                }
            ]
        }, format='json')
        
        assert response.status_code == status.HTTP_403_FORBIDDEN
    
    def test_director_puede_registrar_adelantos(self):
        """Test: Director registra adelantos exitosamente"""
        self.client.force_authenticate(user=self.director)
        
        response = self.client.post('/api/adelantos/registrar_app/', {
            'musicos': [
                {
                    'musico_id': self.musico.id,
                    'monto': 500.00,
                    'motivo': 'Adelanto de sueldo'
                }
            ]
        }, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['success'] == True
```

## 2. Testing Frontend (Kotlin + Mockito)

### 2.1 Instalación de Dependencias

```gradle
// build.gradle (Module: app)
dependencies {
    // Testing
    testImplementation 'junit:junit:4.13.2'
    testImplementation 'org.mockito:mockito-core:5.2.0'
    testImplementation 'org.mockito.kotlin:mockito-kotlin:5.1.0'
    testImplementation 'androidx.arch.core:core-testing:2.2.0'
    testImplementation 'org.jetbrains.kotlinx:kotlinx-coroutines-test:1.7.0'
    
    // UI Testing
    androidTestImplementation 'androidx.test.espresso:espresso-core:3.5.1'
    androidTestImplementation 'androidx.test:runner:1.5.2'
}
```

### 2.2 Test de LoginViewModel

```kotlin
// LoginViewModelTest.kt
import androidx.arch.core.executor.testing.InstantTaskExecutorRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.example.sisbanda.presentation.viewmodel.LoginViewModel
import com.example.sisbanda.domain.repository.AuthRepository
import com.example.sisbanda.data.local.TokenManager
import com.example.sisbanda.domain.model.LoginRequest
import com.example.sisbanda.domain.model.TokenResponse
import kotlinx.coroutines.test.runTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mock
import org.mockito.MockitoAnnotations
import org.mockito.kotlin.whenever

@RunWith(AndroidJUnit4::class)
class LoginViewModelTest {
    
    @get:Rule
    val instantExecutorRule = InstantTaskExecutorRule()
    
    @Mock
    private lateinit var mockAuthRepository: AuthRepository
    
    @Mock
    private lateinit var mockTokenManager: TokenManager
    
    private lateinit var viewModel: LoginViewModel
    
    @Before
    fun setup() {
        MockitoAnnotations.openMocks(this)
        viewModel = LoginViewModel(mockAuthRepository, mockTokenManager)
    }
    
    @Test
    fun testLoginExitoso() = runTest {
        // Given
        val loginRequest = LoginRequest("usuario", "pass")
        val tokenResponse = TokenResponse(
            access = "access_token_123",
            refresh = "refresh_token_123"
        )
        
        whenever(mockAuthRepository.login(loginRequest))
            .thenReturn(tokenResponse)
        
        // When
        val result = viewModel.login("usuario", "pass")
        
        // Then
        assert(result != null)
        // Verificar que se guardó el token
        verify(mockTokenManager).saveTokens(
            tokenResponse,
            eq(0),
            eq("")
        )
    }
    
    @Test
    fun testLoginFalloPorCredencialesInvalidas() = runTest {
        // Given
        whenever(mockAuthRepository.login(any()))
            .thenThrow(HttpException(Response.error(401, "")))
        
        // When
        val result = viewModel.login("usuario", "pass_incorrecto")
        
        // Then
        assert(result == "Usuario o contraseña incorrectos")
    }
    
    @Test
    fun testValidacionCamposVacios() = runTest {
        // When
        val result = viewModel.login("", "")
        
        // Then
        assert(result == "Ingresa usuario y contraseña")
    }
}
```

### 2.3 Test de DescuentoRepository

```kotlin
// DescuentoRepositoryTest.kt
import kotlinx.coroutines.test.runTest
import org.junit.Before
import org.junit.Test
import org.mockito.Mock
import org.mockito.MockitoAnnotations
import org.mockito.kotlin.whenever
import retrofit2.HttpException

class DescuentoRepositoryTest {
    
    @Mock
    private lateinit var mockApiService: SisBandaAPI
    
    @Mock
    private lateinit var mockDescuentoDao: DescuentoDao
    
    @Mock
    private lateinit var mockTokenManager: TokenManager
    
    private lateinit var repository: DescuentoRepository
    
    @Before
    fun setup() {
        MockitoAnnotations.openMocks(this)
        repository = DescuentoRepository(
            mockApiService,
            mockDescuentoDao,
            mockTokenManager
        )
    }
    
    @Test
    fun testRegistrarDescuentoExitoso() = runTest {
        // Given
        val item = DescuentoItemRequest(
            musico_id = 5,
            monto = 150.00,
            motivo = "Falta a ensayo",
            fecha = "2026-06-12"
        )
        
        val response = DescuentoResponse(
            success = true,
            registrados = 1,
            total_descuentos = 150.00,
            errores = emptyList()
        )
        
        whenever(mockApiService.registrarDescuentos(any()))
            .thenReturn(response)
        
        // When
        val result = repository.registrarDescuentos(listOf(item))
        
        // Then
        assert(result.isSuccess)
        assert(result.getOrNull()?.success == true)
    }
    
    @Test
    fun testValidacionMontoCero() = runTest {
        // Given
        val item = DescuentoItemRequest(
            musico_id = 5,
            monto = 0.00,
            motivo = "Falta a ensayo"
        )
        
        // When
        val result = repository.registrarDescuentos(listOf(item))
        
        // Then
        assert(result.isFailure)
        assert(result.exceptionOrNull()?.message?.contains("mayor a 0") == true)
    }
    
    @Test
    fun testRegistroOfflineGuardaEnBD() = runTest {
        // Given
        val item = DescuentoItemRequest(
            musico_id = 5,
            monto = 150.00,
            motivo = "Falta a ensayo"
        )
        
        val response = DescuentoResponse(
            success = true,
            registrados = 1,
            total_descuentos = 150.00,
            errores = emptyList()
        )
        
        whenever(mockApiService.registrarDescuentos(any()))
            .thenReturn(response)
        
        // When
        repository.registrarDescuentos(listOf(item))
        
        // Then
        verify(mockDescuentoDao).insert(any())
    }
    
    @Test
    fun testManejoDeErrorHTTP403() = runTest {
        // Given
        whenever(mockApiService.registrarDescuentos(any()))
            .thenThrow(HttpException(Response.error(403, "")))
        
        // When
        val result = repository.registrarDescuentos(listOf(
            DescuentoItemRequest(musico_id = 5, monto = 100.0, motivo = "test")
        ))
        
        // Then
        assert(result.isFailure)
    }
}
```

---

# 🧪 TESTING DE INTEGRACIÓN

## 1. Test E2E: Login → Registrar Descuento

### 1.1 Backend (Django Integration Test)

```python
# gestion_banda/tests/test_integration_descuentos.py
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from gestion_banda.models import Musico, JefeSeccion, Descuento

User = get_user_model()

@pytest.mark.django_db
class TestIntegrationDescuentosFlow:
    """Test de integración completo: Login → Registrar Descuentos"""
    
    def setup_method(self):
        self.client = APIClient()
        
        # Crear usuario Jefe de Sección
        self.jefe_user = User.objects.create_user(
            username='jefe_trompeta',
            password='securepass123',
            rol='JEFE_SECCION',
            first_name='Juan',
            last_name='Pérez'
        )
        
        # Crear músico para la sección
        self.musico_trompeta = Musico.objects.create(
            usuario=self.jefe_user,
            nombres='Juan',
            apellidos='Pérez',
            documento_identidad='12345678',
            instrumento='TROMPETA',
            nivel='INTERMEDIO'
        )
        
        # Crear relación Jefe de Sección
        self.jefe_seccion = JefeSeccion.objects.create(
            musico=self.musico_trompeta,
            seccion='TROMPETA',
            activo=True
        )
        
        # Otro músico de la misma sección
        self.musico_trompeta2 = Musico.objects.create(
            nombres='Carlos',
            apellidos='López',
            documento_identidad='87654321',
            instrumento='TROMPETA',
            nivel='AVANZADO'
        )
        
        # Músico de otra sección
        self.musico_saxo = Musico.objects.create(
            nombres='Roberto',
            apellidos='Silva',
            documento_identidad='55555555',
            instrumento='SAXOFON',
            nivel='INTERMEDIO'
        )
    
    def test_flujo_completo_login_descuentos(self):
        """
        Test E2E:
        1. Login
        2. Obtener token
        3. Registrar descuentos
        4. Verificar en BD
        """
        
        # PASO 1: Login
        login_response = self.client.post('/api/token/', {
            'username': 'jefe_trompeta',
            'password': 'securepass123'
        }, format='json')
        
        assert login_response.status_code == status.HTTP_200_OK
        access_token = login_response.data['access']
        
        # PASO 2: Usar token en descuentos
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        
        response = self.client.post('/api/descuentos/registrar_app/', {
            'musicos': [
                {
                    'musico_id': self.musico_trompeta2.id,
                    'monto': 150.00,
                    'motivo': 'Falta a ensayo del 10 de junio',
                    'fecha': '2026-06-10'
                },
                {
                    'musico_id': self.musico_trompeta.id,
                    'monto': 75.50,
                    'motivo': 'Tardanza (20 minutos)',
                    'fecha': '2026-06-12'
                }
            ],
            'observaciones': 'Descuentos del evento San Juan'
        }, format='json')
        
        # PASO 3: Verificar respuesta
        assert response.status_code == status.HTTP_200_OK
        assert response.data['success'] == True
        assert response.data['registrados'] == 2
        assert response.data['total_descuentos'] == 225.50
        
        # PASO 4: Verificar en Base de Datos
        descuentos = Descuento.objects.all()
        assert descuentos.count() == 2
        
        desc1 = Descuento.objects.get(musico=self.musico_trompeta2)
        assert desc1.monto == 150.00
        assert desc1.estado == 'APROBADA'
        assert desc1.origen == 'APP_MOVIL'
        assert desc1.jefe_seccion == self.jefe_seccion
        
        desc2 = Descuento.objects.get(musico=self.musico_trompeta)
        assert desc2.monto == 75.50
    
    def test_validacion_cross_section(self):
        """
        Test: Validar que Jefe de Sección NO pueda registrar
        descuentos a músicos de otra sección
        """
        
        # Login
        login_response = self.client.post('/api/token/', {
            'username': 'jefe_trompeta',
            'password': 'securepass123'
        }, format='json')
        
        access_token = login_response.data['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        
        # Intentar registrar a músico de otra sección
        response = self.client.post('/api/descuentos/registrar_app/', {
            'musicos': [
                {
                    'musico_id': self.musico_saxo.id,  # Sección diferente
                    'monto': 100.00,
                    'motivo': 'Falta'
                }
            ]
        }, format='json')
        
        assert response.status_code == status.HTTP_200_OK
        assert response.data['success'] == True
        assert response.data['registrados'] == 0  # No se registró
        assert len(response.data['errores']) == 1
        assert 'no pertenece a tu sección' in response.data['errores'][0]['error']
        
        # Verificar que NO se creó descuento en BD
        assert not Descuento.objects.filter(musico=self.musico_saxo).exists()
```

### 1.2 Frontend (Kotlin Integration Test)

```kotlin
// DescuentosIntegrationTest.kt
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.rule.ActivityTestRule
import com.example.sisbanda.presentation.activity.MainActivity
import com.example.sisbanda.data.local.AppDatabase
import kotlinx.coroutines.test.runTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class DescuentosIntegrationTest {
    
    @get:Rule
    val activityRule = ActivityTestRule(MainActivity::class.java)
    
    private lateinit var database: AppDatabase
    
    @Before
    fun setup() {
        database = Room.inMemoryDatabaseBuilder(
            activityRule.activity.applicationContext,
            AppDatabase::class.java
        ).allowMainThreadQueries().build()
    }
    
    @Test
    fun testFlujoCompletoRegistroDescuentos() = runTest {
        val context = activityRule.activity
        
        // Simular login
        val tokenManager = TokenManager(context)
        tokenManager.saveTokens(
            TokenResponse(
                access = "test_access_token",
                refresh = "test_refresh_token"
            ),
            0,
            "JEFE_SECCION"
        )
        
        // Verificar que se guardó
        assert(tokenManager.getAccessToken() != null)
        assert(tokenManager.getUserRol() == "JEFE_SECCION")
        
        // Preparar descuentos
        val descuentos = listOf(
            DescuentoItemRequest(
                musico_id = 5,
                monto = 150.00,
                motivo = "Falta a ensayo",
                fecha = "2026-06-12"
            ),
            DescuentoItemRequest(
                musico_id = 6,
                monto = 75.50,
                motivo = "Tardanza",
                fecha = "2026-06-12"
            )
        )
        
        // Guardar localmente
        descuentos.forEach { item ->
            database.descuentoDao().insert(
                DescuentoEntity(
                    id = item.musico_id ?: -1,
                    musico_id = item.musico_id ?: 0,
                    monto = item.monto,
                    motivo = item.motivo,
                    fecha_falta = item.fecha,
                    origen = "APP_MOVIL",
                    estado = "APROBADA",
                    creado_en = System.currentTimeMillis().toString(),
                    sincronizado = false
                )
            )
        }
        
        // Verificar en BD local
        val descuentosLocales = database.descuentoDao().getAllDescuentos()
        assert(descuentosLocales.isNotEmpty())
    }
}
```

## 2. Test de Liquidación

```python
# gestion_banda/tests/test_integration_liquidacion.py
import pytest
from decimal import Decimal
from django.contrib.auth import get_user_model
from gestion_banda.models import (
    Musico, Descuento, Adelanto, Pago, 
    PlanillaLiquidacion, ContratoMusico, Evento,
    JefeSeccion
)

User = get_user_model()

@pytest.mark.django_db
class TestIntegrationLiquidacion:
    """Test de integración: Liquidación completa"""
    
    def setup_method(self):
        # Crear estructura de test
        self.director = User.objects.create_user(
            username='director',
            password='pass123',
            rol='DIRECTOR'
        )
        
        # Crear músicos
        self.musico1 = Musico.objects.create(
            nombres='Juan',
            apellidos='Pérez',
            instrumento='TROMPETA'
        )
        
        self.musico2 = Musico.objects.create(
            nombres='Carlos',
            apellidos='López',
            instrumento='SAXOFON'
        )
        
        # Crear evento y contrato
        self.evento = Evento.objects.create(
            titulo='Evento San Juan',
            fecha_hora_cita='2026-06-20 14:00'
        )
        
        self.contrato1 = ContratoMusico.objects.create(
            musico=self.musico1,
            evento=self.evento,
            monto_diario=Decimal('500.00'),
            aprobado_por=self.director
        )
        
        self.contrato2 = ContratoMusico.objects.create(
            musico=self.musico2,
            evento=self.evento,
            monto_diario=Decimal('400.00'),
            aprobado_por=self.director
        )
        
        # Crear descuentos
        self.desc1 = Descuento.objects.create(
            musico=self.musico1,
            monto=Decimal('50.00'),
            motivo='Falta',
            estado='APROBADA'
        )
        
        # Crear adelantos
        self.adelanto1 = Adelanto.objects.create(
            musico=self.musico1,
            monto=Decimal('100.00'),
            motivo='Adelanto sueldo',
            registrado_por=self.director,
            estado='APROBADA'
        )
    
    def test_liquidacion_calculo_correcto(self):
        """
        Test: Verificar que la liquidación calcula correctamente:
        neto = salario_base - descuentos - adelantos
        
        Caso:
        - Salario base: 500
        - Descuentos: 50
        - Adelantos: 100
        - Neto esperado: 350
        """
        
        # Crear planilla
        planilla = PlanillaLiquidacion.objects.create(
            titulo='Liquidación Evento San Juan'
        )
        planilla.eventos.add(self.evento)
        
        # Crear pago
        pago = Pago.objects.create(
            musico=self.musico1,
            planilla=planilla,
            salario_base=Decimal('500.00'),
            estado='PENDIENTE'
        )
        
        # Liquidar (calcular automáticamente)
        pago.save()  # Dispara calcular_totales()
        
        # Verificar cálculos
        assert pago.descuentos_totales == Decimal('50.00')
        assert pago.adelantos_totales == Decimal('100.00')
        assert pago.neto_pagar == Decimal('350.00')  # 500 - 50 - 100
    
    def test_liquidacion_multiples_musicos(self):
        """Test: Liquidación de múltiples músicos"""
        
        planilla = PlanillaLiquidacion.objects.create(
            titulo='Liquidación Evento'
        )
        planilla.eventos.add(self.evento)
        
        # Crear pagos para ambos músicos
        pago1 = Pago.objects.create(
            musico=self.musico1,
            planilla=planilla,
            salario_base=Decimal('500.00')
        )
        
        pago2 = Pago.objects.create(
            musico=self.musico2,
            planilla=planilla,
            salario_base=Decimal('400.00')
        )
        
        # Crear descuento solo para músico2
        desc2 = Descuento.objects.create(
            musico=self.musico2,
            monto=Decimal('75.00'),
            motivo='Falta',
            estado='APROBADA'
        )
        
        # Recalcular pagos
        pago1.save()
        pago2.save()
        
        # Verificar
        pago1.refresh_from_db()
        pago2.refresh_from_db()
        
        # Músico 1: 500 - 50 - 100 = 350
        assert pago1.neto_pagar == Decimal('350.00')
        
        # Músico 2: 400 - 75 - 0 = 325
        assert pago2.neto_pagar == Decimal('325.00')
        
        # Total a pagar
        total = pago1.neto_pagar + pago2.neto_pagar
        assert total == Decimal('675.00')
```

---

# 🔀 FLUJOS E2E (END-TO-END)

## Flujo 1: Jefe de Sección Registra Descuentos

```
┌──────────────────────────────────────────────────────────┐
│ 1. JEFE ABRE APP                                         │
│    - Pantalla: LoginActivity                             │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│ 2. INGRESA CREDENCIALES                                  │
│    - Usuario: jefe_trompeta                              │
│    - Pass: securepass123                                 │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│ 3. APP VALIDA LOCALMENTE                                 │
│    - Revisa que campos no sean vacíos                    │
│    - Muestra loading spinner                             │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│ 4. REQUEST A BACKEND                                     │
│    POST /api/token/                                      │
│    {                                                     │
│      "username": "jefe_trompeta",                        │
│      "password": "securepass123"                         │
│    }                                                     │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│ 5. BACKEND VALIDA                                        │
│    - Verifica usuario existe                             │
│    - Verifica password (hashed con bcrypt)               │
│    - Genera JWT tokens                                   │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│ 6. RESPONSE 200 OK                                       │
│    {                                                     │
│      "access": "eyJ...",                                 │
│      "refresh": "eyJ..."                                 │
│    }                                                     │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│ 7. APP GUARDA TOKENS                                     │
│    - TokenManager.saveTokens()                           │
│    - Encripta con EncryptedSharedPreferences             │
│    - Navega a DescuentosFragment                         │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│ 8. PANTALLA DESCUENTOS                                   │
│    - Carga lista de músicos (desde BD local)             │
│    - Muestra solo TROMPETA (su sección)                  │
│    - Permite seleccionar múltiples                       │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│ 9. JEFE SELECCIONA MÚSICOS Y MONTOS                      │
│    - Juan Pérez: 150 Bs (Falta)                         │
│    - Carlos López: 75.50 Bs (Tardanza)                  │
│    - Presiona "Registrar"                                │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│ 10. APP VALIDA DATOS                                     │
│     - Montos > 0: ✓                                      │
│     - Motivos >= 5 chars: ✓                              │
│     - Al menos 1 músico: ✓                               │
│     - Muestra loading                                    │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│ 11. REQUEST A BACKEND                                    │
│     POST /api/descuentos/registrar_app/                  │
│     Headers: Authorization: Bearer eyJ...                │
│     {                                                    │
│       "musicos": [                                       │
│         {"musico_id": 5, "monto": 150, ...},            │
│         {"musico_id": 6, "monto": 75.5, ...}            │
│       ],                                                 │
│       "observaciones": "..."                             │
│     }                                                    │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│ 12. BACKEND PROCESA                                      │
│     - Verifica JWT: ✓                                    │
│     - Extrae rol: JEFE_SECCION                           │
│     - Obtiene sección: TROMPETA                          │
│     - Para cada músico:                                  │
│       · Busca en BD                                      │
│       · Valida pertenencia a sección                     │
│       · Valida montos                                    │
│       · Crea Descuento.objects.create()                  │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│ 13. RESPONSE 200 OK                                      │
│     {                                                    │
│       "success": true,                                   │
│       "registrados": 2,                                  │
│       "total_descuentos": 225.50,                        │
│       "errores": []                                      │
│     }                                                    │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│ 14. APP GUARDA LOCALMENTE                                │
│     - DescuentoRepository.guardarLocalmente()            │
│     - Inserta en Room DB                                 │
│     - Marca como sincronizado: true                      │
└──────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│ 15. UI ACTUALIZADO                                       │
│     ✅ "Registrado exitosamente"                         │
│     - Recarga lista de descuentos                        │
│     - Muestra totales actualizados                       │
│     - Limpia formulario                                  │
└──────────────────────────────────────────────────────────┘
```

## Test para Flujo 1

```python
# gestion_banda/tests/test_e2e_jefe_descuentos.py
import pytest
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model
from gestion_banda.models import Musico, JefeSeccion, Descuento

User = get_user_model()

@pytest.mark.django_db
def test_e2e_jefe_registra_descuentos_exitosamente():
    """
    E2E Test: Flujo completo desde login hasta registro de descuentos
    """
    client = APIClient()
    
    # Setup: Crear datos
    jefe_user = User.objects.create_user(
        username='jefe_trompeta',
        password='securepass123',
        rol='JEFE_SECCION'
    )
    
    musico1 = Musico.objects.create(
        usuario=jefe_user,
        nombres='Juan',
        apellidos='Pérez',
        instrumento='TROMPETA'
    )
    
    JefeSeccion.objects.create(
        musico=musico1,
        seccion='TROMPETA'
    )
    
    musico2 = Musico.objects.create(
        nombres='Carlos',
        apellidos='López',
        instrumento='TROMPETA'
    )
    
    # PASO 1: Login
    login_resp = client.post('/api/token/', {
        'username': 'jefe_trompeta',
        'password': 'securepass123'
    }, format='json')
    
    assert login_resp.status_code == status.HTTP_200_OK
    token = login_resp.data['access']
    
    # PASO 2: Registrar descuentos
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    
    desc_resp = client.post('/api/descuentos/registrar_app/', {
        'musicos': [
            {
                'musico_id': musico1.id,
                'monto': 150.00,
                'motivo': 'Falta a ensayo',
                'fecha': '2026-06-12'
            },
            {
                'musico_id': musico2.id,
                'monto': 75.50,
                'motivo': 'Tardanza'
            }
        ]
    }, format='json')
    
    # VERIFICACIONES
    assert desc_resp.status_code == status.HTTP_200_OK
    assert desc_resp.data['success'] == True
    assert desc_resp.data['registrados'] == 2
    assert desc_resp.data['total_descuentos'] == 225.50
    
    # Verificar en BD
    assert Descuento.objects.count() == 2
    assert Descuento.objects.filter(
        musico=musico1,
        monto=150.00,
        origen='APP_MOVIL'
    ).exists()
```

---

# 📈 CHECKLIST DE TESTING

## Para Desarrolladores Backend

- [ ] Tests de unidad para cada modelo (Descuento, Adelanto, Pago)
- [ ] Tests de validación de serializers
- [ ] Tests de permisos (JefeSeccion, Director, etc)
- [ ] Tests de endpoints con autenticación
- [ ] Tests de endpoints sin autenticación (401)
- [ ] Tests de endpoints sin permisos (403)
- [ ] Tests de liquidación (cálculos correctos)
- [ ] Tests de manejo de excepciones
- [ ] Tests de concurrencia (múltiples requests simultáneos)

## Para Desarrolladores Kotlin

- [ ] Tests unitarios de ViewModels
- [ ] Tests unitarios de Repositories
- [ ] Tests de validación de formularios
- [ ] Tests de Token Manager
- [ ] Tests de Room Database
- [ ] Tests de Interceptors (Auth, Refresh)
- [ ] Tests UI con Espresso
- [ ] Tests de manejo de errores
- [ ] Tests de flujos offline

---

**FIN DE DOCUMENTACIÓN**

*Este documento es la guía completa para entender, desarrollar y probar el sistema SisBanda.*
