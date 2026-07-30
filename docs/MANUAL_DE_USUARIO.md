# Manual de Usuario: Sistema "BandaGestion"

## 1. Introducción

El sistema "BandaGestion" es una aplicación web y móvil diseñada para la administración integral de una banda de música. Su objetivo es centralizar y automatizar la gestión de músicos, eventos, finanzas y logística, proporcionando herramientas específicas para los diferentes roles dentro de la organización.

Este manual describe las funcionalidades del sistema desde la perspectiva de cada usuario, facilitando su adopción y uso correcto.

## 2. Roles de Usuario

El sistema define tres roles principales con diferentes niveles de acceso y responsabilidades:

*   **Administrador (Director/Presidente):** Tiene acceso completo a todos los módulos del sistema. Es responsable de la configuración general, gestión de músicos, creación de eventos, administración financiera y supervisión de todas las operaciones.
*   **Jefe de Sección:** Responsable de un grupo específico de músicos (ej. Trombones, Trompetas). Sus funciones se centran en la gestión de su sección, como reportar sanciones y comunicar información relevante.
*   **Músico:** Es el usuario final del sistema. Puede consultar su información personal, los eventos a los que ha sido convocado y su historial de pagos y asistencias.

## 3. Guía de Módulos

### 3.1. Autenticación y Acceso

El acceso al sistema, especialmente desde la aplicación móvil, se realiza mediante un PIN de 4 dígitos. Este PIN corresponde a los primeros 4 dígitos del documento de identidad del músico, garantizando un método de acceso rápido y seguro sin necesidad de recordar contraseñas complejas.

### 3.2. Panel de Control (Dashboard)

El panel de control es la pantalla principal al ingresar al sistema y varía según el rol del usuario.

*   **Para Administradores:**
    *   **Estadísticas Clave:** Visualización rápida de métricas importantes como el número total de músicos activos, total de eventos registrados y eventos programados para el mes en curso.
    *   **Ranking de Músicos:** Un listado del "top 5" de músicos con mejor rendimiento.
    *   **Eventos Recientes:** Acceso directo a los últimos eventos creados.
    *   **Financiamiento por Sección:** Un gráfico o tabla que muestra el total pagado a cada sección, permitiendo un análisis financiero rápido.

*   **Para Músicos:**
    *   **Próximos Eventos:** Lista de los 5 eventos más cercanos a los que ha sido convocado.
    *   **Últimas Asistencias:** Historial de sus asistencias más recientes.
    *   **Últimos Pagos:** Resumen de los pagos más recientes que ha recibido.

### 3.3. Módulo de Músicos (Acceso Administrativo)

Este módulo centraliza toda la información del personal de la banda.

*   **Listado y Búsqueda:** Muestra una lista completa de todos los músicos activos, con opciones para buscar por nombre, apellido o documento de identidad, y filtrar por sección (instrumento).
*   **Creación y Edición:** Permite registrar nuevos músicos en el sistema, capturando información como nombres, datos de contacto, instrumento, tallas de uniforme, etc. También se puede editar la información de músicos existentes. Al crear un músico, el sistema genera automáticamente su cuenta de usuario.
*   **Orden de Lista:** Los administradores pueden reordenar la lista de músicos, lo cual es útil para la organización en desfiles o formaciones.
*   **Generación de Reportes:** Ofrece la capacidad de exportar la lista de músicos y sus datos a formatos PDF o Excel, con opciones para seleccionar las columnas deseadas en el reporte.

### 3.4. Módulo de Eventos

Este módulo gestiona toda la logística de las presentaciones y ensayos.

*   **Creación y Gestión (Admin):** Los administradores pueden crear nuevos eventos, especificando título, fecha, hora, lugar, tipo de uniforme y otros detalles. Pueden convocar a todos los músicos o seleccionar músicos específicos para cada evento.
*   **Consulta de Eventos (Todos los roles):** Todos los usuarios pueden ver los eventos. Los músicos solo verán aquellos a los que han sido convocados.
*   **Registro de Asistencia (Admin):** Después de un evento, el administrador puede pasar lista, marcando el estado de cada músico (Presente, Tarde, Falta, Justificado).
*   **Generación de Mensaje (Admin):** Permite generar un mensaje de texto formateado con toda la información del evento, listo para ser copiado y enviado por WhatsApp a los grupos de la banda.

### 3.5. Módulo de Finanzas (Acceso Principalmente Administrativo)

Este es uno de los módulos más complejos y cruciales del sistema.

*   **Descuentos (Sanciones):**
    *   **Gestión (Admin):** Los administradores pueden registrar, ver y modificar descuentos individuales a los músicos por conceptos como faltas, atrasos, uniforme, etc.
    *   **Reporte Masivo (Jefe de Sección):** El Jefe de Sección tiene una interfaz dedicada para reportar en un solo envío todos los descuentos (sanciones) de los músicos de su sección para un evento específico. El sistema valida que el total reportado coincida con la suma de los descuentos individuales.

*   **Adelantos:**
    *   **Gestión (Admin):** Permite registrar y llevar un control de los adelantos de sueldo solicitados por los músicos.

*   **Liquidación y Pagos (Admin):**
    *   **Generación de Pagos:** El sistema puede generar los pagos para un evento, calculando el monto a pagar a cada músico basado en un salario base, restando los descuentos y adelantos acumulados.
    *   **Planillas de Liquidación:** Permite agrupar varios eventos en una sola planilla de liquidación para realizar pagos consolidados (ej. quincenales o mensuales).
    *   **Historial de Pagos:** Mantiene un registro de todos los pagos realizados a cada músico.

### 3.6. Módulo de Canastón (Acceso Administrativo)

Gestiona la entrega anual de un "canastón" o bono basado en el rendimiento.

*   **Campañas:** El administrador puede crear una "campaña" anual, definiendo las fechas de inicio y fin para el cálculo del rendimiento.
*   **Cálculo de Elegibilidad:** Con un solo clic, el sistema calcula automáticamente quiénes son elegibles para recibir el canastón. El cálculo se basa en criterios predefinidos, como el porcentaje de asistencia a los eventos durante el período de la campaña.
*   **Resultados:** Muestra un informe detallado con los resultados de la campaña, agrupados por sección, indicando quién es elegible y quién no, junto con su puntaje de rendimiento.
*   **Control de Entrega:** Permite marcar en el sistema cuando un músico ya ha recogido su canastón, llevando un control de las entregas.

### 3.7. Módulo de Configuración (Acceso Administrativo)

Permite a los administradores ajustar parámetros globales del sistema, como:
*   Monto por defecto a pagar por evento.
*   Hora límite para considerar una llegada como "Tardanza".
