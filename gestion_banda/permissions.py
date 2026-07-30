from rest_framework import permissions


class TieneModulo(permissions.BasePermission):
    """Verifica que usuario tenga acceso al módulo especificado"""
    modulo_requerido = None

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if self.modulo_requerido is None:
            return True

        return request.user.tiene_modulo(self.modulo_requerido)


class BaseRolePermission(permissions.BasePermission):
    """
    Permiso base genérico por roles.
    Subclases solo necesitan definir `allowed_roles`.
    PRESIDENTE siempre tiene acceso.
    """
    allowed_roles = []

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.rol in self.allowed_roles


class EsPresidente(BaseRolePermission):
    """Solo presidentes pueden acceder"""
    allowed_roles = ['PRESIDENTE']


class EsDirector(BaseRolePermission):
    """Solo directores y presidentes pueden acceder"""
    allowed_roles = ['DIRECTOR', 'PRESIDENTE']


class EsSubdirector(BaseRolePermission):
    """Solo subdirectores y presidentes pueden acceder"""
    allowed_roles = ['SUBDIRECTOR', 'PRESIDENTE']


class EsJefeSeccion(BaseRolePermission):
    """Solo jefes de sección y presidentes pueden acceder"""
    allowed_roles = ['JEFE_SECCION', 'PRESIDENTE']


class EsAdministrativo(BaseRolePermission):
    """Solo roles administrativos (Presidente, Director, Subdirector) pueden acceder"""
    allowed_roles = ['PRESIDENTE', 'DIRECTOR', 'SUBDIRECTOR']


# Alias para compatibilidad hacia atrás
EsDirectorOSubdirector = EsAdministrativo
