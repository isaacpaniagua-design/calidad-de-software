# Guía Rápida de Solución de Problemas de Autenticación

## Problema: "No puedo iniciar sesión"

### Síntomas
- El botón de "Iniciar sesión con Google" no funciona
- Aparece un error después de seleccionar la cuenta de Google
- La página se queda cargando indefinidamente

### Soluciones

#### 1. Verificar dominio en Firebase Authentication

**Pasos:**
1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto "calidad-de-software-v2"
3. Ve a **Authentication** → **Settings** → **Authorized domains**
4. Asegúrate de que estos dominios estén en la lista:
   - `localhost`
   - `calidad-de-software-v2.web.app` (si usas Firebase Hosting)
   - `calidad-de-software-v2.firebaseapp.com`
   - Cualquier otro dominio donde esté desplegada la aplicación

**Cómo agregar un dominio:**
- Haz clic en "Add domain"
- Ingresa el dominio (ej: `localhost` o `mi-dominio.com`)
- Haz clic en "Add"

#### 2. Verificar que las reglas de Firestore estén actualizadas

**Verificación rápida:**
1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Ve a **Firestore Database** → **Rules**
3. Verifica que las reglas incluyan las funciones:
   - `isTeacher()`
   - `hasAuthorizedDomain()`
   - `allowedTeacherEmails()`

**Si no están actualizadas:**
```bash
# Opción 1: Usando el script de despliegue
./tools/deploy-firestore-rules.sh

# Opción 2: Manual con Firebase CLI
firebase deploy --only firestore:rules

# Opción 3: Desde Firebase Console
# Copia el contenido de tools/firestore.rules
# Pégalo en la consola y presiona "Publish"
```

---

## Problema: "Puedo iniciar sesión pero no veo nada"

### Síntomas
- Inicio sesión exitoso
- La página principal se carga pero no muestra materiales, asistencias, etc.
- Aparecen errores en la consola (F12) sobre "permission denied"

### Solución: Verificar reglas de Firestore

**Esta es la causa más común.** Las reglas antiguas dependen de Custom Claims que podrían no estar configurados.

**Pasos:**
1. **Actualiza las reglas de Firestore** (ver sección anterior)
2. Cierra sesión y vuelve a iniciar sesión
3. Verifica en la consola del navegador (F12) si hay errores

---

## Problema: "Soy docente pero no puedo acceder al panel docente"

### Síntomas
- Puedo iniciar sesión
- Puedo ver materiales como estudiante
- No puedo acceder a `paneldocente.html`
- No puedo editar calificaciones

### Soluciones

#### Opción 1: Verificar que tu email esté en la lista blanca (más rápido)

**Pasos:**
1. Abre el archivo `js/firebase-config.js`
2. Busca la sección `allowedTeacherEmails`
3. Verifica que tu email esté en la lista:
   ```javascript
   export const allowedTeacherEmails = [
     "isaac.paniagua@potros.itson.edu.mx",
     "tu-email@potros.itson.edu.mx"  // Agrega tu email aquí
   ];
   ```
4. Guarda el archivo
5. **IMPORTANTE**: También actualiza `tools/firestore.rules`:
   ```javascript
   function allowedTeacherEmails() {
     return [
       "isaac.paniagua@potros.itson.edu.mx",
       "tu-email@potros.itson.edu.mx"  // Agrega tu email aquí
     ];
   }
   ```
6. Despliega las reglas: `firebase deploy --only firestore:rules`
7. Cierra sesión y vuelve a iniciar sesión

#### Opción 2: Crear documento en Firestore (recomendado para producción)

**Pasos:**
1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Ve a **Firestore Database**
3. Si no existe, crea la colección `teachers`
4. Haz clic en "Add document"
5. En "Document ID", usa el **UID del usuario**
   - Para obtener el UID: Ve a **Authentication** → **Users** → Busca tu email → Copia el UID
6. Agrega los campos:
   ```
   email: "tu-email@potros.itson.edu.mx" (tipo: string)
   name: "Tu Nombre" (tipo: string)
   createdAt: [timestamp actual] (tipo: timestamp)
   ```
7. Haz clic en "Save"
8. Cierra sesión y vuelve a iniciar sesión

#### Opción 3: Usar lista dinámica en Firestore

**Pasos:**
1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Ve a **Firestore Database**
3. Crea/actualiza el documento en la ruta: `config/teacherAllowlist`
4. Agrega un campo llamado `emails` (tipo: array)
5. Dentro del array, agrega tu email (en minúsculas):
   ```
   emails: [
     "isaac.paniagua@potros.itson.edu.mx",
     "tu-email@potros.itson.edu.mx"
   ]
   ```
6. Haz clic en "Save"
7. Cierra sesión y vuelve a iniciar sesión

---

## Problema: "Los estudiantes no pueden ver sus calificaciones"

### Solución
Las nuevas reglas requieren que los estudiantes tengan un email con dominio `@potros.itson.edu.mx`.

**Verifica:**
1. Que el estudiante use una cuenta de Google con dominio `@potros.itson.edu.mx`
2. Que las reglas de Firestore estén actualizadas
3. Que el documento de calificación use el UID del estudiante como ID

---

## Problema: "Errores de CORS o 'Network request failed'"

### Síntomas
- Errores en consola sobre CORS
- "Network request failed"
- "identitytoolkit.googleapis.com bloqueado"

### Soluciones
1. **Verifica tu conexión a internet**
2. **Desactiva extensiones del navegador** (especialmente bloqueadores de anuncios)
3. **Prueba en modo incógnito** del navegador
4. **Verifica que no haya firewall corporativo** bloqueando:
   - `googleapis.com`
   - `firebaseapp.com`
   - `identitytoolkit.googleapis.com`

---

## Problema: "El foro no carga o da error de permisos"

### Solución
Las reglas del foro fueron actualizadas para requerir dominio autorizado.

**Pasos:**
1. Verifica que hayas actualizado las reglas de Firestore
2. Asegúrate de que tu email tenga el dominio `@potros.itson.edu.mx`
3. Cierra sesión y vuelve a iniciar sesión

---

## Cómo obtener información de depuración

### En el navegador
1. Abre las Herramientas de Desarrollador (F12)
2. Ve a la pestaña **Console**
3. Busca mensajes de error en rojo
4. Toma una captura de pantalla del error completo

### Errores comunes y su significado

| Error | Significado | Solución |
|-------|-------------|----------|
| `auth/unauthorized-domain` | El dominio no está autorizado en Firebase | Agregar dominio en Firebase Console |
| `permission-denied` | Las reglas de Firestore bloquean el acceso | Actualizar reglas de Firestore |
| `auth/network-request-failed` | Problema de conexión | Verificar internet/firewall |
| `Missing or insufficient permissions` | Sin permisos en Firestore | Actualizar reglas o verificar rol |
| `auth/popup-closed-by-user` | Usuario cerró el popup | Volver a intentar |

---

## Verificación post-despliegue

Después de actualizar las reglas, verifica que:

✅ **Como docente:**
- [ ] Puedes iniciar sesión
- [ ] Puedes ver el panel principal
- [ ] Puedes acceder a `paneldocente.html`
- [ ] Puedes ver y editar calificaciones
- [ ] Puedes subir/editar materiales
- [ ] Puedes ver todas las asistencias

✅ **Como estudiante:**
- [ ] Puedes iniciar sesión con cuenta `@potros.itson.edu.mx`
- [ ] Puedes ver materiales
- [ ] Puedes registrar asistencia
- [ ] Puedes ver tus propias calificaciones
- [ ] Puedes participar en el foro

---

## Contacto y soporte

Si después de seguir todos estos pasos sigues teniendo problemas:

1. **Revisa el archivo** `docs/SOLUCION_AUTENTICACION.md` para información técnica detallada
2. **Verifica los logs de Firebase Console:**
   - Firebase Console → Functions → Logs
   - Firebase Console → Firestore → Usage
3. **Comparte los errores de la consola** del navegador (F12 → Console)

---

## Comandos útiles de Firebase CLI

```bash
# Iniciar sesión en Firebase
firebase login

# Ver proyectos disponibles
firebase projects:list

# Usar un proyecto específico
firebase use calidad-de-software-v2

# Desplegar solo las reglas de Firestore
firebase deploy --only firestore:rules

# Desplegar solo las Cloud Functions
firebase deploy --only functions

# Desplegar todo
firebase deploy

# Ver logs de las Functions
firebase functions:log
```
