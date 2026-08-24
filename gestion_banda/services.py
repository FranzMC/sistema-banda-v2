from django.contrib.auth import get_user_model
from django.db import transaction
from .models import Musico, Descuento, Adelanto, JefeSeccion, Asistencia, Evento
from django.utils import timezone
from decimal import Decimal

Usuario = get_user_model()


def create_user_for_musico(nombres, apellidos, ci):
    """
    Crea un usuario Django para un mÃºsico nuevo.
    Genera username automÃ¡ticamente y contraseÃ±a segura aleatoria.
    """
    # Generar username usando el CI
    username = str(ci).strip()
    
    # Si el CI ya existe como usuario (raro, pero por si acaso), agregarle un sufijo
    if Usuario.objects.filter(username=username).exists():
        import uuid
        username = f"{username}_{uuid.uuid4().hex[:4]}"

    # El PIN (contraseña) serán los primeros 4 dígitos del CI
    password = str(ci).strip()[:4]

    # Crear usuario
    user = Usuario.objects.create(
        username=username,
        first_name=nombres,
        last_name=apellidos,
        rol='MUSICO',
        is_active=True
    )
    user.set_password(password)
    user.save()

    return user


def create_bulk_descuentos_seccion(user, data):
    """
    Crea mÃºltiples descuentos para una secciÃ³n en un evento.
    Usado por jefes de secciÃ³n desde la app mÃ³vil.
    """
    try:
        evento_id = data.get('evento_id')
        descuentos_data = data.get('descuentos', [])

        if not evento_id or not descuentos_data:
            return {
                'success': False,
                'error': 'Datos incompletos: se requiere evento_id y descuentos',
                'status': 400
            }

        try:
            evento = Evento.objects.get(id=evento_id)
        except Evento.DoesNotExist:
            return {
                'success': False,
                'error': 'Evento no encontrado',
                'status': 404
            }

        # Verificar permisos y determinar la secciÃ³n
        seccion_reporte = data.get('seccion')
        jefe = None
        
        if user.rol == 'JEFE_SECCION':
            try:
                jefe = JefeSeccion.objects.filter(musico__usuario=user).first()
                if jefe:
                    seccion_reporte = jefe.seccion
                elif not seccion_reporte:
                    return {'success': False, 'error': 'Falta indicar la secciÃ³n', 'status': 400}
            except Exception as e:
                return {'success': False, 'error': str(e), 'status': 403}
        elif user.rol in ['PRESIDENTE', 'DIRECTOR', 'SUBDIRECTOR'] or user.is_superuser:
            if not seccion_reporte:
                return {'success': False, 'error': 'Falta indicar la secciÃ³n', 'status': 400}
        else:
            return {'success': False, 'error': 'Permisos insuficientes', 'status': 403}

        # Pre-cargar todos los músicos necesarios en una sola query (evita N+1)
        musico_ids = [d.get('musico_id') for d in descuentos_data if d.get('musico_id')]
        musicos_map = Musico.objects.in_bulk(musico_ids)

        # Determinar los instrumentos permitidos (importante para PERCUSION que abarca BOMBO, TAMBOR, PLATILLOS)
        instrumentos_permitidos_jefe = user.get_instrumentos_encargados() if user.rol == 'JEFE_SECCION' else []

        creados = []
        with transaction.atomic():
            # Eliminamos la lógica de borrado porque la app móvil envía solo los descuentos no sincronizados
            # Usamos get_or_create más abajo para evitar duplicados en caso de reintentos

            for descuento_data in descuentos_data:
                musico_id = descuento_data.get('musico_id')
                monto = descuento_data.get('monto')
                motivo = descuento_data.get('concepto') or descuento_data.get('motivo', '')
                fecha_falta = descuento_data.get('fecha_falta')

                if not musico_id or not monto:
                    continue

                musico = musicos_map.get(musico_id)
                if not musico:
                    continue

                # Verificar que el músico pertenece a los instrumentos permitidos del jefe
                if user.rol == 'JEFE_SECCION' and instrumentos_permitidos_jefe:
                    if musico.instrumento not in instrumentos_permitidos_jefe:
                        continue
                elif user.rol == 'JEFE_SECCION':
                    # Si el jefe no tiene instrumentos asignados, verificar por seccion_reporte
                    if musico.instrumento != seccion_reporte:
                        continue

                descuento, created = Descuento.objects.get_or_create(
                    musico=musico,
                    evento=evento,
                    monto=Decimal(str(monto)),
                    motivo=motivo,
                    fecha_falta=fecha_falta or timezone.now().date(),
                    origen='APP_MOVIL',
                    defaults={
                        'jefe_seccion': jefe,
                        'estado': 'APROBADA'
                    }
                )

                if created:
                    creados.append({
                        'id': descuento.id,
                        'musico': musico.nombre_completo,
                        'monto': str(descuento.monto)
                    })

        return {
            'success': True,
            'data': {
                'creados': creados,
                'total': len(creados)
            },
            'status': 200
        }

    except Exception as e:
        return {
            'success': False,
            'error': f'Error al crear descuentos: {str(e)}',
            'status': 500
        }


def registrar_adelantos_app(user, data):
    """
    Registra mÃºltiples adelantos desde la app mÃ³vil.
    Usado por el directorio.
    """
    try:
        evento_id = data.get('evento_id')
        adelantos_data = data.get('adelantos', [])

        if not adelantos_data:
            return {
                'success': False,
                'error': 'No se proporcionaron adelantos',
                'status': 400
            }

        # Verificar permisos (solo directorio)
        if user.rol not in ['DIRECTOR', 'SUBDIRECTOR', 'PRESIDENTE']:
            return {
                'success': False,
                'error': 'Sin permisos para registrar adelantos',
                'status': 403
            }

        # Pre-cargar todos los mÃºsicos necesarios en una sola query (evita N+1)
        musico_ids = [d.get('musico_id') for d in adelantos_data if d.get('musico_id')]
        musicos_map = Musico.objects.in_bulk(musico_ids)

        # Pre-cargar contratos del evento para asociarlos al adelanto
        from .models import ContratoMusico
        contratos = ContratoMusico.objects.filter(evento_id=evento_id, musico_id__in=musico_ids)
        contratos_map = {c.musico_id: c for c in contratos}

        creados = []
        with transaction.atomic():
            for adelanto_data in adelantos_data:
                musico_id = adelanto_data.get('musico_id')
                monto = adelanto_data.get('monto')
                motivo = adelanto_data.get('motivo', '')
                fecha = adelanto_data.get('fecha')

                if not musico_id or not monto:
                    continue

                musico = musicos_map.get(musico_id)
                if not musico:
                    continue
                    
                contrato = contratos_map.get(musico_id)
                if not contrato:
                    contrato, _ = ContratoMusico.objects.get_or_create(
                        musico_id=musico_id,
                        evento_id=evento_id,
                        defaults={'monto_diario': 0}
                    )

                adelanto = Adelanto.objects.create(
                    musico=musico,
                    contrato=contrato,
                    monto=Decimal(str(monto)),
                    motivo=motivo,
                    fecha=fecha or timezone.now().date(),
                    origen='APP_MOVIL',
                    estado='APROBADA',
                    registrado_por=user
                )
                creados.append({
                    'id': adelanto.id,
                    'musico': musico.nombre_completo,
                    'monto': str(adelanto.monto)
                })

        return {
            'success': True,
            'data': {
                'creados': creados,
                'total': len(creados)
            }
        }

    except Exception as e:
        return {
            'success': False,
            'error': f'Error al registrar adelantos: {str(e)}'
        }

def create_bulk_adelantos_seccion(user, data):
    """
    Crea múltiples adelantos para una sección en un evento.
    Usado por jefes de sección desde la app móvil.
    Reemplaza todos los adelantos existentes de esa sección en el evento.
    """
    from decimal import Decimal
    from django.utils import timezone
    from django.db import transaction
    from .models import Evento, JefeSeccion, Musico, Adelanto, ContratoMusico

    try:
        evento_id = data.get('evento_id')
        adelantos_data = data.get('adelantos', [])

        if not evento_id:
            return {
                'success': False,
                'error': 'Datos incompletos: se requiere evento_id',
                'status': 400
            }

        try:
            evento = Evento.objects.get(id=evento_id)
        except Evento.DoesNotExist:
            return {
                'success': False,
                'error': 'Evento no encontrado',
                'status': 404
            }

        seccion_reporte = data.get('seccion') or 'TODOS'
        jefe = None
        
        if user.rol == 'JEFE_SECCION':
            return {'success': False, 'error': 'Los Jefes de Sección no pueden registrar adelantos', 'status': 403}
        elif user.rol in ['PRESIDENTE', 'DIRECTOR', 'SUBDIRECTOR'] or user.is_superuser:
            pass  # seccion_reporte ya tiene valor por defecto "TODOS"
        else:
            return {'success': False, 'error': 'Permisos insuficientes', 'status': 403}

        musico_ids = [a.get('musico_id') for a in adelantos_data if a.get('musico_id')]
        musicos_map = Musico.objects.in_bulk(musico_ids)
        
        contratos = ContratoMusico.objects.filter(evento_id=evento_id, musico_id__in=musico_ids)
        contratos_map = {c.musico_id: c for c in contratos}

        creados = []
        with transaction.atomic():
            # Eliminamos la lÃ³gica de borrado porque la app mÃ³vil envÃ­a solo los adelantos no sincronizados
            # En lugar de borrar, hacemos get_or_create para evitar duplicados exactos si hay reintentos de red

            for adelanto_data in adelantos_data:
                musico_id = adelanto_data.get('musico_id')
                monto = adelanto_data.get('monto')
                motivo = adelanto_data.get('motivo', '')
                fecha = adelanto_data.get('fecha')

                if not musico_id or not monto:
                    continue

                musico = musicos_map.get(musico_id)
                if not musico:
                    continue
                    
                contrato = contratos_map.get(musico_id)
                if not contrato:
                    contrato, _ = ContratoMusico.objects.get_or_create(
                        musico_id=musico_id,
                        evento_id=evento_id,
                        defaults={'monto_diario': 0}
                    )

                # Usamos get_or_create para no duplicar si el usuario re-enviÃ³ el mismo adelanto exacto por error de red
                adelanto, created = Adelanto.objects.get_or_create(
                    musico=musico,
                    contrato=contrato,
                    monto=Decimal(str(monto)),
                    motivo=motivo,
                    fecha=fecha or timezone.now().date(),
                    origen='APP_MOVIL',
                    defaults={
                        'estado': 'APROBADA',
                        'registrado_por': user
                    }
                )
                
                if created:
                    creados.append({
                        'id': adelanto.id,
                        'musico': musico.nombre_completo,
                        'monto': str(adelanto.monto)
                    })

        return {
            'success': True,
            'data': {
                'creados': creados,
                'total': len(creados),
                'seccion': seccion_reporte
            },
            'status': 200
        }

    except Exception as e:
        return {
            'success': False,
            'error': f'Error interno: {str(e)}',
            'status': 500
        }
