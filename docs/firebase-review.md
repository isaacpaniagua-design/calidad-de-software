# Revisión de seguridad y datos de Firebase

## Resumen ejecutivo
- El proyecto usa reglas de Firestore que filtran por dominio `@potros.itson.edu.mx` y derivan el rol de docente a través de la colección `teachers` y de una lista blanca estática/dinámica. 【F:tools/firestore.rules†L1-L58】
- Las integraciones clave del frontend respetan las validaciones de las reglas (asistencias, entregas, materiales), lo que reduce el riesgo de escrituras malformadas.
- Se detectaron superficies de exposición para datos sensibles de calificaciones y una política sin reglas explícitas para la lista blanca dinámica de docentes.

## Cobertura de reglas vs. funcionalidades

| Área | Reglas relevantes | Implementación en frontend | Observaciones |
| --- | --- | --- | --- |
| Asistencias | `match /attendances/{attendanceId}` exige que el alumno registre solo su propia asistencia o que el docente marque registros manuales. 【F:tools/firestore.rules†L61-L86】 | `saveTodayAttendance` completa `uid`, `email`, `createdByUid`, `createdByEmail` con el usuario autenticado antes de hacer `setDoc`. 【F:js/firebase.js†L323-L392】 | El flujo cumple los campos y tipos requeridos; evita duplicados diarios.

| Entregas de estudiantes | `match /studentUploads/{uploadId}` permite que el estudiante cree su propia entrega o que un docente registre la evidencia a nombre del alumno (cuando `extra.uploadedBy.uid` coincide con el usuario autenticado); las actualizaciones/borrados siguen siendo exclusivos del docente. 【F:tools/firestore.rules†L154-L185】 | `createStudentUpload` valida `student.uid` y define `status`, `submittedAt`, `updatedAt` con valores válidos. 【F:js/student-uploads.js†L300-L327】 | Las consultas usan `where("student.uid" == uid)` + `orderBy("submittedAt")`, cubiertas por el índice compuesto configurado.

| Materiales | Actualizaciones solo docentes o incremento controlado de `downloads`. 【F:tools/firestore.rules†L50-L59】 | Los helpers docentes usan `addDoc`, `updateDoc` y `deleteDoc`; el contador de descargas usa `FieldValue.increment(1)`. 【F:js/materials-manager.js†L12-L47】 | El incremento respeta la restricción de `downloads == downloads + 1`.
| Lista blanca de docentes | El frontend combina correos estáticos con un doc `config/teacherAllowlist`. 【F:js/firebase.js†L78-L117】【F:js/firebase-config.js†L19-L36】 | `match /config/{docId}` permite leer `teacherAllowlist` a cualquier usuario autenticado, y solo docentes autorizados pueden actualizarlo. 【F:tools/firestore.rules†L256-L260】 | La UI ignora lecturas fallidas y la regla mantiene el control de escritura exclusivo para docentes.

## Hallazgos y recomendaciones

1. **Privacidad de calificaciones**. Las reglas permiten que cualquier usuario `@potros` lea la colección `grades` y las calificaciones anidadas de cualquier grupo (`/grupos/{grupo}/calificaciones`). 【F:tools/firestore.rules†L88-L121】 Si los documentos contienen calificaciones individuales, cualquier alumno autenticado podría consultar las notas de sus compañeros mediante una consulta manual. _Recomendación_: restringir la lectura a docentes o al propio alumno (p.ej. comprobando `request.auth.uid == resource.id` o un campo `student.uid`).
2. **Reglas duplicadas para `/users/{uid}`**. Las reglas incluyen dos bloques `match /users/{...}` con la misma política. 【F:tools/firestore.rules†L15-L19】【F:tools/firestore.rules†L123-L126】 Aunque funcional, mantener una sola definición reduce el riesgo de divergencias futuras.
3. **Visibilidad del allowlist dinámico**. `config/teacherAllowlist` ahora es legible por cualquier usuario autenticado gracias a la regla dedicada. 【F:tools/firestore.rules†L256-L260】 Asegúrate de que el documento no exponga datos sensibles y documenta el flujo de actualización para los docentes responsables.
4. **Sincronización de listas blancas**. El repositorio mantiene la lista estática de docentes en código (`allowedTeacherEmails`) y en reglas (`allowedTeacherEmails()`). 【F:js/firebase-config.js†L19-L28】【F:tools/firestore.rules†L6-L12】 Cualquier cambio debe aplicarse en ambos lugares; automatizar la sincronización (por ejemplo con despliegue CI que regenere las reglas a partir del código fuente) evitaría desalineaciones.
5. **Revisión de índices**. Las consultas usadas (`attendances` por fecha, `studentUploads` por uid/fecha, `forum_topics` por fecha) están cubiertas por los índices habilitados que compartiste. Mantenerlos en `firestore.indexes.json` dentro del repositorio permitiría reproducirlos fácilmente en otros entornos.

## Próximos pasos sugeridos

1. Ajustar las reglas de calificaciones para limitar la visibilidad a docentes y/o al estudiante dueño del registro.
2. Añadir reglas para `config/teacherAllowlist` y documentar el procedimiento para actualizar la lista dinámica.
3. Consolidar la definición de `/users/{uid}` en las reglas para simplificar el mantenimiento.
4. Publicar y versionar los archivos de configuración de índices (`firestore.indexes.json`) junto con las reglas para facilitar despliegues.
5. Revisar periódicamente que los helpers del frontend mantengan los campos requeridos por las reglas al agregar nuevas funcionalidades (especialmente si se agregan campos en colecciones existentes).

