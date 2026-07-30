# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🎯 Project Overview

**Sistema de Gestión de Banda de Música** (SisBanda) is a full-stack application for managing music bands with personnel, events, attendance, payments, and performance tracking.

- **Backend**: Django 4.2.7 + Django REST Framework (2862 lines of code concentrated in single api_views.py file)
- **Frontend**: React 19 + Vite + Tailwind CSS
- **Database**: SQLite (development) / PostgreSQL (production)
- **Key Features**: RBAC system, PDF processing, performance scoring (Canastón), financial management

## 🏗️ Architecture

### Backend Structure
```
gestion_banda/           # Main Django app
├── api_views.py         # All API ViewSets (2862 lines - NEEDS REFACTORING)
├── models.py            # Data models (RBAC, Musico, Evento, Asistencia, etc.)
├── serializers.py       # DRF serializers
├── urls.py              # API routing
└── management/          # Custom management commands

services/                # Business logic
├── pdf_processor.py     # PDF processing for discount uploads
├── rendimiento_calculator.py # Performance scoring algorithm
└── sancion_processor.py # Sanction/penalty logic

core/                    # Django project settings
└── settings.py          # Main configuration (HARDCODED IPs!)
```

### Frontend Structure
```
frontend/src/
├── pages/              # Route components (Login, Dashboard, etc.)
├── components/         # Reusable UI components
├── services/
│   └── api.js         # Axios instance with hardcoded backend URL
└── App.jsx            # Main router setup
```

### Current Issues Identified

#### 🔴 Critical Issues
1. **Hardcoded IP Addresses**: Backend URL is hardcoded as `http://192.168.3.179:8000` in:
   - `frontend/src/services/api.js`
   - `frontend/src/pages/Login.jsx`
   - `core/settings.py` (ALLOWED_HOSTS, CORS_ALLOWED_ORIGINS)
   
   **Impact**: Application breaks if IP changes; won't work in different environments

2. **No Environment Configuration**: No `.env` support in frontend; backend uses environment variables inconsistently

3. **Monolithic API File**: `api_views.py` has 2862 lines with 19 ViewSets in one file
   
   **Impact**: Hard to find code, difficult to test, violates single responsibility principle

4. **Incomplete Permission System**: Only `PresidentePermission` is used; other endpoints may lack proper authorization checks

#### ⚠️ Important Issues
5. **Token Storage Security**: localStorage used for JWT tokens without httpOnly/secure flags or refresh token rotation

6. **Large File Sizes**: api_views.py should be split into:
   - `usuarios_views.py`
   - `musicos_views.py`
   - `financiero_views.py` (descuentos, adelantos, pagos)
   - `eventos_views.py`
   - etc.

7. **No Proper Error Handling**: API responses don't consistently validate input or return meaningful error messages

8. **Missing Type Hints**: Python code lacks type annotations for better IDE support and documentation

## 🔌 API Integration Points

### Main Endpoints
- `POST /api/token/` - JWT authentication
- `GET /api/users/me/` - Current user info + modulos_asignados
- `GET /api/musicos/` - List active musicians
- `GET|POST /api/descuentos/` - Discounts (filtered by role)
- `GET|POST /api/eventos/` - Events
- `POST /api/descuentos/registrar_app/` - App-based discount registration
- `POST /api/planillas/<id>/liquidar_app/` - App-based liquidation

### CORS Configuration
- Hardcoded to: `http://localhost:5173,http://localhost:5174,http://127.0.0.1:5174`
- Must be updated via `CORS_ALLOWED_ORIGINS` environment variable

## 🔐 Security Concerns

1. **No HTTPS enforcement in dev mode** - Django debug mode is flexible but insecure
2. **JWT tokens live 200 days** - Very long expiration in settings.py (line 186)
3. **No rate limiting** - Throttling configured but not used on all endpoints
4. **No API versioning** - Breaking changes will affect all clients
5. **No input validation** - Some endpoints accept raw data without validation

## 📋 Development Commands

### Django Backend
```bash
# Activate environment
source env/Scripts/activate  # Windows
source env/bin/activate     # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Database operations
python manage.py migrate                    # Apply migrations
python manage.py makemigrations gestion_banda
python manage.py createsuperuser            # Create admin user
python manage.py shell                      # Interactive shell

# Run server
python manage.py runserver 192.168.3.179:8000  # DO NOT HARDCODE IPs

# Utilities
python seed_data.py                         # Populate test data
python restore_musicos.py                   # Restore musician data
```

### React Frontend
```bash
cd frontend

# Development
npm install
npm run dev                  # Start Vite dev server (http://localhost:5173)

# Production
npm run build               # Build for production
npm run lint                # Run ESLint
npm run preview             # Preview production build
```

### Running Both Together (Recommended)
```bash
# Terminal 1: Backend
python manage.py runserver 0.0.0.0:8000

# Terminal 2: Frontend
cd frontend && npm run dev
```

## 🧪 Testing

Current test setup is minimal:
- `gestion_banda/tests.py` has basic tests
- Frontend has no test files
- Use `pytest` for Django tests: `pytest`
- Use Vitest for frontend tests (not yet configured)

## 🚀 Deployment Notes

### Database
- Development: SQLite (db.sqlite3)
- Production: Should use PostgreSQL (psycopg2-binary in requirements.txt)
- Migrations: Always run `python manage.py migrate` before deploying

### Environment Variables
**Required for production:**
```env
DEBUG=False
SECRET_KEY=<generate-new-key>
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
CORS_ALLOWED_ORIGINS=https://yourdomain.com
DATABASE_URL=postgresql://user:pass@localhost/dbname
```

### Frontend Build
- Build output: `frontend/dist/`
- Serve static files via Django using `whitenoise` or nginx
- API URL must be configurable (currently hardcoded)

## 📚 Key Models to Understand

- **Usuario**: Custom user model with RBAC roles (PRESIDENTE, DIRECTOR, SUBDIRECTOR, MUSICO)
- **Musico**: Musician profile (CI, uniform size, instrument, performance level)
- **Evento**: Events (presentations, rehearsals)
- **Asistencia**: Attendance tracking with punctuality
- **Descuento/Adelanto**: Discounts/advances with role-based filtering
- **Modulo/RolModulo**: Feature-based access control
- **RendimientoMusico**: Performance scoring (0-100) based on attendance, punctuality, tenure, discounts

## ⚠️ Known Limitations

1. No database transaction management in complex operations
2. No logging/audit trail for financial operations
3. No background jobs (Celery) for heavy tasks
4. No caching strategy (Redis configured but not used)
5. PDF processing is synchronous (can timeout on large files)
6. No API documentation (Swagger/OpenAPI)

## 🔄 Next Steps for Developers

1. Create `.env` file for environment-specific configuration
2. Refactor api_views.py into separate modules
3. Add comprehensive input validation
4. Implement proper permission classes for all endpoints
5. Add API documentation with Swagger
6. Set up automated testing in CI/CD
7. Configure environment-based CORS and ALLOWED_HOSTS
8. Implement JWT refresh token rotation
9. Add logging for security audit trail
10. Migrate frontend to TypeScript (optional but recommended)
