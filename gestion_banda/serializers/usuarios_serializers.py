import uuid
from rest_framework import serializers
from django.db.models import Sum
from decimal import Decimal
from ..models import (
    Usuario, Modulo, RolModulo, UsuarioModulo, Musico, Evento, Asistencia, Descuento,
    Pago, RendimientoMusico, ConfiguracionSistema, Adelanto, PlanillaLiquidacion,
    ContratoMusico, DetalleMontoDiario, JefeSeccion, Deuda, AbonoDeuda,
    CampanaCanaston, ResultadoCanaston
)

class UsuarioSerializer(serializers.ModelSerializer):
    modulos = serializers.SerializerMethodField()
    modulos_personales = serializers.SerializerMethodField()
    musico_data = serializers.SerializerMethodField()

    class Meta:
        model = Usuario
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'rol', 'telefono', 'is_active', 'modulos', 'modulos_personales', 'musico_data', 'seccion_encargada']
        read_only_fields = ['id', 'username', 'modulos', 'modulos_personales', 'musico_data']

    def get_modulos(self, obj):
        # Retorna módulos según rol del usuario
        modulos = obj.modulos_asignados.values('id', 'clave', 'nombre')
        return list(modulos)

    def get_modulos_personales(self, obj):
        # Retorna módulos personalizados adicionales (a través de la relación UsuarioModulo)
        modulos = obj.modulos_personales.filter(modulo__activo=True).values(
            'modulo__id', 'modulo__clave', 'modulo__nombre'
        )
        # Remapear los campos para que coincidan con la estructura esperada
        return [
            {
                'id': m['modulo__id'],
                'clave': m['modulo__clave'],
                'nombre': m['modulo__nombre']
            }
            for m in modulos
        ]

    def get_musico_data(self, obj):
        try:
            perfil = obj.perfil_musico
            return {
                'documento_identidad': perfil.documento_identidad,
                'nombres': perfil.nombres,
                'apellidos': perfil.apellidos,
                'telefono': perfil.telefono,
                'direccion': perfil.direccion,
                'instrumento': perfil.instrumento,
                'nivel': perfil.nivel,
                'talla_camisa': perfil.talla_camisa,
                'talla_chamarra': perfil.talla_chamarra,
                'numero_calzado': perfil.numero_calzado,
                'fecha_nacimiento': perfil.fecha_nacimiento,
            }
        except AttributeError:
            return None

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        # Solo el Presidente/Fundador puede ver el pin_actual
        if request and hasattr(request, 'user') and request.user.rol in ['PRESIDENTE', 'PRESIDENTE FUNDADOR']:
            data['pin_actual'] = instance.pin_actual
        return data


class UsuarioCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    ci = serializers.CharField(write_only=True, required=False, allow_blank=True)
    musico_data = serializers.DictField(write_only=True, required=False)
    modulos_personales = serializers.ListField(
        child=serializers.CharField(), required=False, write_only=True
    )
    seccion_encargada = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = Usuario
        fields = ['id', 'username', 'password', 'ci', 'first_name', 'last_name', 'email', 'rol', 'telefono', 'is_active', 'musico_data', 'modulos_personales', 'seccion_encargada']
        read_only_fields = ['id']

    def validate(self, attrs):
        if self.instance is None and not attrs.get('username'):
            nombres = attrs.get('first_name', '')
            base = (nombres.split()[0] if nombres else 'user').lower()
            attrs['username'] = f"{base}_{uuid.uuid4().hex[:6]}"

        if attrs.get('rol') == 'MUSICO' and not attrs.get('musico_data') and self.instance is None:
            raise serializers.ValidationError({'musico_data': 'Se requieren datos de músico para crear un usuario de rol MUSICO.'})

        return attrs

    def generate_default_password(self, ci_value):
        ci_digits = ''.join(ch for ch in (ci_value or '') if ch.isdigit())
        if len(ci_digits) >= 4:
            base = ci_digits[:4]
        else:
            base = ci_digits.ljust(4, '0')
        return base

    def create(self, validated_data):
        musico_data = validated_data.pop('musico_data', None)
        personal_modules = validated_data.pop('modulos_personales', [])
        password = validated_data.pop('password', None)
        ci_value = validated_data.pop('ci', None)

        if not password:
            ci_source = ci_value or (musico_data or {}).get('documento_identidad')
            password = self.generate_default_password(ci_source)

        user = Usuario.objects.create(
            username=validated_data['username'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            email=validated_data.get('email', ''),
            rol=validated_data.get('rol', 'MUSICO'),
            telefono=validated_data.get('telefono', ''),
            is_active=validated_data.get('is_active', True),
            seccion_encargada=validated_data.get('seccion_encargada', None),
        )

        user.set_password(password)
        user.pin_actual = password
        user.save()

        if user.rol == 'MUSICO' and musico_data:
            Musico.objects.create(usuario=user, **musico_data)

        if personal_modules:
            self._assign_personal_modules(user, personal_modules)

        return user

    def update(self, instance, validated_data):
        musico_data = validated_data.pop('musico_data', None)
        personal_modules = validated_data.pop('modulos_personales', None)
        password = validated_data.pop('password', None)
        ci_value = validated_data.pop('ci', None)

        # Si se proporciona una nueva contraseña, usarla
        if password:
            instance.set_password(password)
            instance.pin_actual = password
        # Si no se proporciona contraseña pero se proporciona CI, regenerar contraseña
        elif ci_value:
            password = self.generate_default_password(ci_value)
            instance.set_password(password)
            instance.pin_actual = password

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()

        if instance.rol == 'MUSICO' and musico_data:
            Musico.objects.update_or_create(usuario=instance, defaults=musico_data)

        if personal_modules is not None:
            self._assign_personal_modules(instance, personal_modules)

        return instance

    def _assign_personal_modules(self, user, module_claves):
        from ..models import Modulo, UsuarioModulo

        UsuarioModulo.objects.filter(usuario=user).delete()
        modulos = Modulo.objects.filter(clave__in=module_claves)
        for modulo in modulos:
            UsuarioModulo.objects.create(usuario=user, modulo=modulo)


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    documento_identidad = serializers.CharField(required=False, allow_blank=True)
    direccion = serializers.CharField(required=False, allow_blank=True)
    talla_camisa = serializers.CharField(required=False, allow_blank=True)
    talla_chamarra = serializers.CharField(required=False, allow_blank=True)
    numero_calzado = serializers.CharField(required=False, allow_blank=True)
    fecha_nacimiento = serializers.DateField(required=False, allow_null=True)

    class Meta:
        model = Usuario
        fields = ['username', 'password', 'first_name', 'last_name', 'telefono', 
                  'documento_identidad', 'direccion', 'talla_camisa', 'talla_chamarra', 
                  'numero_calzado', 'fecha_nacimiento']

    def validate_password(self, value):
        if value:
            import re
            if not re.match(r'^\d{4}$', value):
                raise serializers.ValidationError("La contraseña (PIN) debe tener exactamente 4 dígitos numéricos.")
        return value

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        
        # Extra fields for Musico
        musico_fields = ['documento_identidad', 'direccion', 'talla_camisa', 'talla_chamarra', 'numero_calzado', 'fecha_nacimiento']
        musico_data = {k: validated_data.pop(k) for k in musico_fields if k in validated_data}
        
        # Update user fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
            
        # Update password if provided
        if password:
            instance.set_password(password)
            instance.pin_actual = password
            
        instance.save()
        
        # Also update Musico profile if it exists to keep in sync
        if hasattr(instance, 'perfil_musico') and instance.perfil_musico:
            perfil = instance.perfil_musico
            if 'first_name' in validated_data:
                perfil.nombres = validated_data['first_name']
            if 'last_name' in validated_data:
                perfil.apellidos = validated_data['last_name']
            if 'telefono' in validated_data:
                perfil.telefono = validated_data['telefono']
                
            for attr, value in musico_data.items():
                setattr(perfil, attr, value)
                
            perfil.save()
                
        return instance


class ModuloSerializer(serializers.ModelSerializer):
    class Meta:
        model = Modulo
        fields = ['id', 'clave', 'nombre', 'descripcion', 'activo']


class RolModuloSerializer(serializers.ModelSerializer):
    modulo = ModuloSerializer(read_only=True)
    modulo_id = serializers.PrimaryKeyRelatedField(queryset=Modulo.objects.all(), source='modulo', write_only=True)

    class Meta:
        model = RolModulo
        fields = ['id', 'rol', 'modulo', 'modulo_id']
