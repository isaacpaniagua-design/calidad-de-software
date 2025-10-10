# Solución a Problemas de Autenticación

## Problema identificado

El sistema presentaba errores de autenticación porque:

1. **Las reglas de Firestore dependían exclusivamente de Custom Claims** (`getUserRole() == 'docente'`) que solo se asignan mediante Cloud Functions
2. **Si las Cloud Functions no están desplegadas** o los usuarios fueron creados antes del despliegue, no tendrán los Custom Claims necesarios
3. **Faltaba un sistema de respaldo (fallback)** para verificar roles usando métodos alternativos

## Solución implementada

Se actualizaron las reglas de seguridad de Firestore (`tools/firestore.rules`) para incluir:

### 1. Verificación múltiple de roles de docente

La nueva función `isTeacher()` verifica el rol de tres formas:
- **Custom Claims**: `getUserRole() == 'docente'` (si están disponibles)
- **Lista blanca estática**: Verifica si el email está en `allowedTeacherEmails()`
- **Documento en Firestore**: Verifica si existe `/teachers/{uid}`

### 2. Validación de dominio institucional

La función `hasAuthorizedDomain()` verifica que el email termine con `@potros.itson.edu.mx`

### 3. Reglas actualizadas

Todas las colecciones ahora usan estas funciones combinadas:
- **Materiales**: Lectura para usuarios con dominio autorizado, escritura solo para docentes
- **Asistencias**: Los estudiantes pueden crear, los docentes pueden gestionar
- **Calificaciones**: Los docentes pueden ver todas, los estudiantes solo las suyas
- **Foro**: Acceso completo para usuarios con dominio autorizado
- **Grupos**: Lectura para todos, escritura solo para docentes

## Pasos para desplegar la solución

### Paso 1: Actualizar las reglas de Firestore

```bash
# Si tienes Firebase CLI instalado
firebase deploy --only firestore:rules

# O manualmente en Firebase Console:
# 1. Ve a Firebase Console → Firestore Database → Rules
# 2. Copia el contenido de tools/firestore.rules
# 3. Pega y publica las reglas
```

### Paso 2: (Opcional) Desplegar Cloud Functions

Si quieres que los Custom Claims se asignen automáticamente:

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

### Paso 3: Crear documento de docente en Firestore

Para que el docente `isaac.paniagua@potros.itson.edu.mx` pueda acceder inmediatamente:

1. Ve a Firebase Console → Firestore Database
2. Crea una colección llamada `teachers`
3. Agrega un documento con ID igual al UID del usuario docente
4. El documento debe contener:
   ```json
   {
     "email": "isaac.paniagua@potros.itson.edu.mx",
     "name": "Isaac Paniagua",
     "createdAt": [timestamp actual]
   }
   ```

**Nota**: Puedes obtener el UID yendo a Firebase Console → Authentication → Users

### Paso 4: (Opcional) Agregar más docentes

Para agregar más docentes sin tener que desplegar código:

**Método 1: Actualizar lista estática en el código**
1. Edita `js/firebase-config.js` → `allowedTeacherEmails`
2. Edita `tools/firestore.rules` → función `allowedTeacherEmails()`
3. Despliega las reglas de Firestore

**Método 2: Usar lista dinámica en Firestore**
1. Ve a Firestore Database
2. Crea/actualiza el documento `config/teacherAllowlist`
3. Agrega un campo `emails` (tipo array) con los correos de los docentes:
   ```json
   {
     "emails": [
       "isaac.paniagua@potros.itson.edu.mx",
       "otro.docente@potros.itson.edu.mx"
     ]
   }
   ```

## Verificación

Después de desplegar:

1. **Inicia sesión** con una cuenta `@potros.itson.edu.mx`
2. **Verifica que puedes acceder** a:
   - Panel principal (index.html)
   - Materiales (materiales.html)
   - Asistencias (asistencia.html)
   - Foro (Foro.html)
3. **Como docente**, verifica acceso a:
   - Panel docente (paneldocente.html)
   - Gestión de calificaciones (calificaciones.html)

## Ventajas de esta solución

✅ **Funciona sin Cloud Functions**: No depende de que las Functions estén desplegadas
✅ **Múltiples métodos de verificación**: Usa Custom Claims, lista blanca estática y Firestore
✅ **Fácil de mantener**: Puedes agregar docentes sin tocar código
✅ **Backward compatible**: Sigue funcionando con Custom Claims si están disponibles
✅ **Seguro**: Valida dominio institucional para estudiantes

## Mantenimiento futuro

### Para agregar un nuevo docente:
1. Agrega su email a `config/teacherAllowlist` en Firestore, O
2. Crea un documento en la colección `teachers` con su UID

### Para modificar permisos:
- Edita `tools/firestore.rules`
- Despliega: `firebase deploy --only firestore:rules`

## Soporte

Si encuentras problemas:
1. Verifica que las reglas de Firestore estén actualizadas
2. Revisa que el usuario tenga una cuenta `@potros.itson.edu.mx`
3. Verifica en Firebase Console → Firestore que las colecciones existen
4. Revisa la consola del navegador (F12) para errores específicos
