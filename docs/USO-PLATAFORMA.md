# Guía rápida de uso — Plataforma de Gestión de Actividades y Calificaciones

## Para Docentes

- Inicia sesión con tu cuenta institucional.
- Accede a la vista de calificaciones: verás la tabla de promedios generales y podrás seleccionar cualquier estudiante para ver y editar el desglose de actividades.
- Crea nuevas actividades (individuales o grupales) y asigna calificaciones desde la sección de actividades.
- Edita o elimina calificaciones y actividades directamente en el desglose.
- Todas las evidencias y calificaciones se gestionan en la subcolección `grades/{studentId}/activities`.
- Solo los docentes pueden modificar datos; los estudiantes solo pueden visualizar los suyos.

## Para Estudiantes

- Inicia sesión con tu cuenta institucional.
- Accede a la vista de calificaciones: solo verás tus propias actividades y calificaciones.
- Consulta el desglose de tus actividades, calificaciones y promedios.
- Sube evidencias si el flujo está habilitado.
- No puedes modificar ni eliminar actividades o calificaciones.

## Seguridad y reglas

- Las reglas de Firestore garantizan que solo los docentes pueden editar cualquier dato.
- Los estudiantes solo pueden leer sus propios datos.
- Todas las operaciones de consulta y edición están centralizadas y protegidas.

---

## Validación visual/final

- La interfaz muestra correctamente los controles y vistas según el rol detectado.
- El docente tiene acceso total a la gestión y edición; el estudiante solo a la visualización.
- No hay duplicidad de lógica ni acceso inseguro.

---

¿Dudas o mejoras? Contacta al responsable del repositorio o revisa la documentación técnica en `/docs`.
