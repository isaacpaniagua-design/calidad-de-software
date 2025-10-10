# 🔐 Fix: Errores de Autenticación - Firebase

## 📝 Descripción del Problema

El sistema presentaba errores de autenticación que impedían a docentes y estudiantes acceder a la plataforma. El problema raíz era:

1. **Dependencia total de Custom Claims**: Las reglas de Firestore requerían Custom Claims (`role: 'docente'`) que solo se asignan mediante Cloud Functions
2. **Cloud Functions no desplegadas o no configuradas**: Si las Functions no están activas, los usuarios nunca reciben sus roles
3. **Sin sistema de respaldo**: No había métodos alternativos para verificar roles

### Síntomas que experimentabas:
- ❌ "Permission denied" al intentar acceder a materiales, calificaciones, etc.
- ❌ Docentes no podían acceder al panel docente
- ❌ Estudiantes no podían ver sus calificaciones
- ❌ Errores en la consola del navegador (F12)

## ✅ Solución Implementada

### 1. Reglas de Firestore Mejoradas

Se actualizó `tools/firestore.rules` para incluir **verificación múltiple de roles**:

```javascript
// Ahora verifica roles de 3 formas distintas:
function isTeacher() {
  return isAuthenticated() && (
    getUserRole() == 'docente' ||              // 1. Custom Claim (si existe)
    request.auth.token.email in allowedTeacherEmails() || // 2. Lista blanca
    exists(/databases/$(database)/documents/teachers/$(request.auth.uid)) // 3. Documento Firestore
  );
}
```

**Ventajas:**
- ✅ Funciona **sin Cloud Functions desplegadas**
- ✅ Funciona **con Cloud Functions desplegadas** (backward compatible)
- ✅ Múltiples métodos de autenticación
- ✅ Fácil agregar nuevos docentes sin tocar código

### 2. Validación de Dominio Institucional

```javascript
function hasAuthorizedDomain() {
  return isAuthenticated() && 
         request.auth.token.email.matches('.*@potros[.]itson[.]edu[.]mx$');
}
```

Todos los estudiantes deben tener email con dominio `@potros.itson.edu.mx`.

### 3. Auto-creación de Documentos

El código cliente (`js/role-gate.js`) ya incluía lógica para crear automáticamente documentos de docente al iniciar sesión. Las nuevas reglas lo permiten.

## 📦 Archivos Modificados/Creados

### Código y Reglas
- ✏️ `tools/firestore.rules` - Reglas de seguridad actualizadas (archivo principal)

### Scripts de Despliegue
- ✨ `tools/deploy-firestore-rules.sh` - Script bash para Linux/Mac
- ✨ `tools/deploy-firestore-rules.bat` - Script batch para Windows

### Documentación
- 📖 `CHECKLIST_DESPLIEGUE.md` - Lista de verificación paso a paso con checkboxes
- 📖 `CAMBIOS_AUTENTICACION.md` - Resumen ejecutivo con arquitectura
- 📖 `docs/SOLUCION_AUTENTICACION.md` - Documentación técnica completa
- 📖 `docs/TROUBLESHOOTING.md` - Guía de solución de problemas comunes
- 📖 `guia-despliegue.html` - Guía visual interactiva (abre en navegador)

## 🚀 Cómo Desplegar (3 opciones)

### Opción 1: Script Automatizado ⭐ (Recomendado)

```bash
# Linux/Mac
./tools/deploy-firestore-rules.sh

# Windows
tools\deploy-firestore-rules.bat
```

### Opción 2: Firebase CLI

```bash
# Autenticarse (solo primera vez)
firebase login

# Seleccionar proyecto
firebase use calidad-de-software-v2

# Desplegar
firebase deploy --only firestore:rules
```

### Opción 3: Firebase Console (Manual)

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Proyecto: `calidad-de-software-v2`
3. **Firestore Database** → **Rules**
4. Copia el contenido de `tools/firestore.rules`
5. Pégalo en el editor
6. Clic en **Publish**

## ✅ Verificación Rápida

Después de desplegar, verifica:

### Como docente (isaac.paniagua@potros.itson.edu.mx):
```bash
✓ Puedes iniciar sesión en login.html
✓ Accedes a paneldocente.html sin errores
✓ Puedes ver/editar calificaciones
✓ Puedes gestionar materiales
```

### Como estudiante (@potros.itson.edu.mx):
```bash
✓ Puedes iniciar sesión
✓ Ves materiales
✓ Registras asistencia
✓ Ves tus propias calificaciones
```

## 📚 Documentación Detallada

Para información más detallada, consulta:

1. **Primeros Pasos**: Abre `guia-despliegue.html` en tu navegador
2. **Checklist Completo**: Lee `CHECKLIST_DESPLIEGUE.md`
3. **Problemas Comunes**: Consulta `docs/TROUBLESHOOTING.md`
4. **Arquitectura Técnica**: Lee `CAMBIOS_AUTENTICACION.md`
5. **Documentación Completa**: Lee `docs/SOLUCION_AUTENTICACION.md`

## 🎯 Arquitectura de la Solución

```
Usuario intenta acceder
        ↓
¿Tiene Custom Claim 'docente'?
   ↙️ SÍ        ↘️ NO
Docente    ¿Email en lista blanca?
              ↙️ SÍ        ↘️ NO
           Docente    ¿Existe /teachers/{uid}?
                         ↙️ SÍ        ↘️ NO
                      Docente    Estudiante
```

## 🔑 Agregar Más Docentes

### Método 1: Firestore (Sin código, recomendado)

1. Firebase Console → Firestore Database
2. Ir a documento: `config/teacherAllowlist`
3. Agregar campo `emails` (array):
   ```json
   {
     "emails": [
       "isaac.paniagua@potros.itson.edu.mx",
       "nuevo.docente@potros.itson.edu.mx"
     ]
   }
   ```

### Método 2: Código (Requiere despliegue)

1. Editar `js/firebase-config.js`:
   ```javascript
   export const allowedTeacherEmails = [
     "isaac.paniagua@potros.itson.edu.mx",
     "nuevo.docente@potros.itson.edu.mx"
   ];
   ```

2. Editar `tools/firestore.rules`:
   ```javascript
   function allowedTeacherEmails() {
     return [
       "isaac.paniagua@potros.itson.edu.mx",
       "nuevo.docente@potros.itson.edu.mx"
     ];
   }
   ```

3. Desplegar: `firebase deploy --only firestore:rules`

## 🆘 Problemas Comunes

### "Permission denied" después de desplegar

**Solución:**
1. Cierra sesión completamente
2. Borra caché del navegador (Ctrl+F5)
3. Vuelve a iniciar sesión
4. Si persiste, verifica en Firebase Console que las reglas se actualizaron

### "No puedo acceder como docente"

**Soluciones:**
1. Verifica que tu email esté en `allowedTeacherEmails`
2. O crea documento manualmente en `/teachers/{tu-uid}`
3. O agrega tu email a `config/teacherAllowlist` en Firestore

Ver guía completa en `docs/TROUBLESHOOTING.md`

## 📊 Cobertura de Colecciones

| Colección | Lectura | Escritura | Notas |
|-----------|---------|-----------|-------|
| `teachers` | ✅ Todos | ✅ Propio doc | Auto-creado |
| `attendances` | ✅ Docentes+Estudiantes | ✅ Crear: Estudiantes | Validado |
| `grades` | ✅ Docentes+Propio | ✅ Docentes | Seguro |
| `materials` | ✅ @potros.itson.edu.mx | ✅ Docentes | Protegido |
| `forum_topics` | ✅ @potros.itson.edu.mx | ✅ Todos (crear) | Moderado |
| `grupos` | ✅ @potros.itson.edu.mx | ✅ Docentes | Panel |

## 🎉 Beneficios

- ✅ **No requiere Cloud Functions** (pero las soporta si están)
- ✅ **Backward compatible** con implementaciones existentes
- ✅ **Fácil mantenimiento** - agregar docentes sin desplegar código
- ✅ **Múltiples métodos de autenticación** - más robusto
- ✅ **Documentación completa** - guías para todos los escenarios
- ✅ **Scripts de despliegue** - un comando y listo

## 🔄 Rollback

Si necesitas revertir:

1. Firebase Console → Firestore Database → Rules
2. Clic en "History" (arriba a la derecha)
3. Seleccionar versión anterior
4. Clic en "Restore"

## 🤝 Contribución

Esta solución fue implementada para resolver los problemas de autenticación reportados. Si encuentras algún problema o tienes sugerencias, por favor:

1. Consulta primero `docs/TROUBLESHOOTING.md`
2. Revisa la consola del navegador para errores específicos
3. Abre un issue con detalles del problema

## 📞 Soporte

- **Guía visual**: Abre `guia-despliegue.html`
- **Troubleshooting**: Lee `docs/TROUBLESHOOTING.md`
- **Documentación técnica**: Lee `docs/SOLUCION_AUTENTICACION.md`

---

**Proyecto**: Plataforma de Calidad de Software - ITSON
**Fecha**: Octubre 2025
**Versión**: 2.0 - Fix de Autenticación
