# ✅ Checklist de Despliegue - Solución de Autenticación

Use este checklist para asegurar un despliegue exitoso de las correcciones de autenticación.

## 📋 Pre-Despliegue

- [ ] **Backup de reglas actuales**
  - Ve a Firebase Console → Firestore Database → Rules
  - Copia las reglas actuales a un archivo de backup
  - O simplemente confía en el historial de Firebase (pueden restaurarse)

- [ ] **Verifica acceso a Firebase Console**
  - Puedes iniciar sesión en https://console.firebase.google.com/
  - Tienes permisos de Editor o Propietario en el proyecto
  - Proyecto: `calidad-de-software-v2`

- [ ] **Firebase CLI instalado** (si usarás línea de comandos)
  ```bash
  # Verifica si está instalado
  firebase --version
  
  # Si no está instalado
  npm install -g firebase-tools
  ```

- [ ] **Autenticación en Firebase CLI**
  ```bash
  firebase login
  firebase use calidad-de-software-v2
  ```

## 🚀 Despliegue

### Opción A: Script Automatizado (Recomendado)

- [ ] **Ejecutar script de despliegue**
  ```bash
  # Linux/Mac
  ./tools/deploy-firestore-rules.sh
  
  # Windows
  tools\deploy-firestore-rules.bat
  ```

- [ ] **Confirmar despliegue cuando se solicite**

### Opción B: Firebase CLI Manual

- [ ] **Desplegar reglas**
  ```bash
  firebase deploy --only firestore:rules
  ```

- [ ] **Verificar mensaje de éxito**
  - Debe aparecer: "✓ Deploy complete!"

### Opción C: Firebase Console Manual

- [ ] **Ir a Firebase Console**
  - https://console.firebase.google.com/

- [ ] **Navegar a Firestore Rules**
  - Firestore Database → Rules

- [ ] **Copiar reglas actualizadas**
  - Abrir archivo `tools/firestore.rules`
  - Copiar todo el contenido

- [ ] **Pegar en el editor**
  - Reemplazar todo el contenido existente

- [ ] **Publicar reglas**
  - Hacer clic en "Publish"
  - Confirmar la publicación

## 👤 Configuración de Docente

### Método 1: Login automático (Más fácil)

- [ ] **El docente inicia sesión**
  - Ir a la aplicación: login.html
  - Iniciar sesión con `isaac.paniagua@potros.itson.edu.mx`
  - El sistema creará automáticamente el documento

- [ ] **Verificar creación del documento**
  - Firebase Console → Firestore Database
  - Buscar colección `teachers`
  - Debe existir un documento con el UID del docente

### Método 2: Creación manual (Si el método 1 falla)

- [ ] **Obtener UID del docente**
  - Firebase Console → Authentication → Users
  - Buscar email del docente
  - Copiar el UID (campo "User UID")

- [ ] **Crear documento en Firestore**
  - Firebase Console → Firestore Database
  - Ir a colección `teachers` (crear si no existe)
  - Agregar documento:
    - **Document ID**: [UID del docente copiado]
    - **Campos**:
      ```
      email: "isaac.paniagua@potros.itson.edu.mx"
      name: "Isaac Paniagua"
      createdAt: [timestamp actual]
      ```

## 🔐 Verificación de Dominio

- [ ] **Verificar dominios autorizados**
  - Firebase Console → Authentication → Settings → Authorized domains

- [ ] **Asegurar estos dominios están en la lista**
  - [ ] `localhost`
  - [ ] `calidad-de-software-v2.web.app`
  - [ ] `calidad-de-software-v2.firebaseapp.com`
  - [ ] Cualquier dominio personalizado que uses

- [ ] **Agregar dominios faltantes**
  - Hacer clic en "Add domain"
  - Ingresar el dominio
  - Guardar

## ✅ Post-Despliegue: Verificación

### Como Docente

- [ ] **Iniciar sesión**
  - Ir a login.html
  - Iniciar sesión con cuenta @potros.itson.edu.mx
  - Debe redirigir a index.html sin errores

- [ ] **Verificar permisos de docente**
  - [ ] Acceder a `paneldocente.html` sin errores
  - [ ] Abrir F12 → Console, no debe haber errores "permission denied"

- [ ] **Verificar funcionalidades de docente**
  - [ ] Ver lista de estudiantes en panel docente
  - [ ] Acceder a `calificaciones.html`
  - [ ] Ver todas las calificaciones
  - [ ] Editar una calificación (prueba)
  - [ ] Guardar sin errores

- [ ] **Verificar materiales**
  - [ ] Acceder a `materiales.html`
  - [ ] Ver la vista de docente (con botones de editar/eliminar)
  - [ ] Probar subir un material (opcional)

- [ ] **Verificar asistencias**
  - [ ] Acceder a `asistencia.html`
  - [ ] Ver lista completa de asistencias
  - [ ] Poder registrar asistencia manual (si aplica)

- [ ] **Verificar foro**
  - [ ] Acceder a `Foro.html`
  - [ ] Ver temas existentes
  - [ ] Crear un tema de prueba
  - [ ] Eliminar el tema de prueba

### Como Estudiante

- [ ] **Conseguir cuenta de estudiante de prueba**
  - Debe tener email @potros.itson.edu.mx
  - Si no tienes, salta esta sección

- [ ] **Iniciar sesión como estudiante**
  - Login con cuenta de estudiante
  - Debe redirigir a index.html

- [ ] **Verificar permisos de estudiante**
  - [ ] NO puede acceder a `paneldocente.html`
  - [ ] Puede ver `materiales.html`
  - [ ] Puede registrar asistencia en `asistencia.html`
  - [ ] Puede ver sus propias calificaciones

- [ ] **Verificar restricciones**
  - [ ] No puede editar calificaciones
  - [ ] No puede eliminar materiales
  - [ ] No puede ver asistencias de otros estudiantes

## 🐛 Resolución de Problemas

### Si aparece "permission denied"

- [ ] **Verificar que las reglas se desplegaron**
  - Firebase Console → Firestore Database → Rules
  - Buscar función `isTeacher()`
  - Buscar función `hasAuthorizedDomain()`
  - Si no están, volver a desplegar

- [ ] **Verificar email del docente**
  - Firebase Console → Authentication → Users
  - Confirmar email exacto del docente
  - Verificar que coincida con `js/firebase-config.js`

- [ ] **Limpiar caché del navegador**
  - Ctrl+F5 o Cmd+Shift+R
  - O abrir en modo incógnito

- [ ] **Verificar documento de docente**
  - Firebase Console → Firestore Database → teachers
  - Debe existir documento con UID del docente

### Si el docente no puede acceder

- [ ] **Verificar que el email esté en la lista blanca**
  - Archivo `js/firebase-config.js` → `allowedTeacherEmails`
  - Archivo `tools/firestore.rules` → función `allowedTeacherEmails()`
  - Deben coincidir

- [ ] **Crear documento manualmente**
  - Ver sección "Configuración de Docente → Método 2" arriba

- [ ] **Verificar Custom Claims** (opcional)
  - Firebase Console → Authentication → Users
  - Seleccionar usuario
  - Ver "Custom claims" (si Cloud Functions está desplegado)

### Si los estudiantes no pueden acceder

- [ ] **Verificar dominio del email**
  - Debe terminar en @potros.itson.edu.mx
  - Exactamente ese dominio, no otros

- [ ] **Verificar función en reglas**
  - Firebase Console → Firestore Database → Rules
  - Buscar: `hasAuthorizedDomain()`
  - Debe tener: `@potros[.]itson[.]edu[.]mx`

## 📊 Métricas de Éxito

Después del despliegue, deberías tener:

- ✅ **0 errores** de "permission denied" en consola del navegador
- ✅ **0 problemas** de inicio de sesión
- ✅ **Docentes** pueden acceder a todas las funcionalidades
- ✅ **Estudiantes** pueden acceder a materiales y ver sus calificaciones
- ✅ **Foro** funciona para todos los usuarios con dominio autorizado

## 📝 Post-Despliegue: Documentación

- [ ] **Notificar a usuarios**
  - Informar que se actualizó el sistema de autenticación
  - Solicitar que cierren sesión y vuelvan a iniciar sesión
  - Compartir link a guía de troubleshooting si es necesario

- [ ] **Actualizar documentación del proyecto**
  - Agregar nota en README sobre autenticación
  - Mencionar que se requiere dominio @potros.itson.edu.mx

- [ ] **Monitorear logs** (primeros días)
  - Firebase Console → Firestore → Usage
  - Verificar que no hay picos de errores

## 🎉 ¡Despliegue Completado!

Si todos los checks anteriores están ✅, el despliegue fue exitoso.

## 📚 Referencias

- **Documentación técnica**: `docs/SOLUCION_AUTENTICACION.md`
- **Troubleshooting**: `docs/TROUBLESHOOTING.md`
- **Guía visual**: `guia-despliegue.html`
- **Resumen**: `CAMBIOS_AUTENTICACION.md`

## 🆘 Soporte

Si después de completar este checklist sigues teniendo problemas:

1. Revisa la consola del navegador (F12) para mensajes de error específicos
2. Consulta `docs/TROUBLESHOOTING.md`
3. Verifica los logs de Firebase Console
4. Contacta al equipo de desarrollo con los detalles del error

---

**Fecha de despliegue**: _________________

**Desplegado por**: _________________

**Notas adicionales**:

_________________________________________________________________

_________________________________________________________________

_________________________________________________________________
