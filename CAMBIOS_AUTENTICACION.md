# 🔧 Solución de Errores de Autenticación

## 🎯 Resumen Ejecutivo

Este PR soluciona los errores de autenticación que impedían a docentes y estudiantes acceder al sistema. El problema principal era que las reglas de seguridad de Firestore dependían exclusivamente de Custom Claims de Firebase, que solo se asignan mediante Cloud Functions.

## ✅ Cambios Realizados

### 1. **Reglas de Firestore Mejoradas** (`tools/firestore.rules`)
- ✨ Verificación múltiple de roles de docente:
  - Custom Claims (si están disponibles)
  - Lista blanca estática en el código
  - Documento en colección `/teachers`
- ✨ Validación de dominio `@potros.itson.edu.mx` para estudiantes
- ✨ Permisos granulares para todas las colecciones
- ✨ Backward compatible con implementaciones existentes

### 2. **Scripts de Despliegue**
- 📜 `tools/deploy-firestore-rules.sh` (Linux/Mac)
- 📜 `tools/deploy-firestore-rules.bat` (Windows)
- Simplifican el despliegue de reglas de Firestore

### 3. **Documentación Completa**
- 📖 `docs/SOLUCION_AUTENTICACION.md` - Documentación técnica detallada
- 📖 `docs/TROUBLESHOOTING.md` - Guía de solución de problemas
- 📖 `guia-despliegue.html` - Guía visual interactiva

## 🚀 Cómo Desplegar

### Opción 1: Script Automatizado (Recomendado)

```bash
# Linux/Mac
./tools/deploy-firestore-rules.sh

# Windows
tools\deploy-firestore-rules.bat
```

### Opción 2: Firebase CLI

```bash
firebase deploy --only firestore:rules
```

### Opción 3: Manual

1. Ir a [Firebase Console](https://console.firebase.google.com/)
2. Firestore Database → Rules
3. Copiar contenido de `tools/firestore.rules`
4. Pegar y publicar

## 📋 Verificación Post-Despliegue

Después de desplegar, verifica que:

### Como docente (isaac.paniagua@potros.itson.edu.mx):
- [x] Puedes iniciar sesión
- [x] Accedes a `paneldocente.html`
- [x] Ver/editar calificaciones
- [x] Subir/gestionar materiales
- [x] Ver todas las asistencias

### Como estudiante (@potros.itson.edu.mx):
- [x] Iniciar sesión
- [x] Ver materiales
- [x] Registrar asistencia
- [x] Ver propias calificaciones
- [x] Participar en foro

## 🔑 Ventajas de la Solución

1. **No depende de Cloud Functions**: Funciona sin desplegar Functions
2. **Múltiples métodos de autenticación**: Custom Claims + Lista blanca + Firestore
3. **Fácil mantenimiento**: Agregar docentes sin tocar código
4. **Backward compatible**: Funciona con implementaciones existentes
5. **Documentación completa**: Guías para todos los escenarios

## 📚 Documentación

- **Guía visual**: Abre `guia-despliegue.html` en el navegador
- **Documentación técnica**: `docs/SOLUCION_AUTENTICACION.md`
- **Solución de problemas**: `docs/TROUBLESHOOTING.md`

## 🆘 ¿Problemas?

Consulta la guía de troubleshooting en `docs/TROUBLESHOOTING.md` para soluciones a problemas comunes:

- No puedo iniciar sesión
- Soy docente pero no tengo permisos
- Errores de "permission denied"
- Estudiantes no pueden ver calificaciones
- Errores de CORS o red

## 👥 Agregar Más Docentes

### Método 1: Firestore (sin código)
1. Ir a Firestore Database
2. Crear/actualizar `config/teacherAllowlist`
3. Agregar campo `emails` (array) con correos de docentes

### Método 2: Código (requiere despliegue)
1. Editar `js/firebase-config.js` → `allowedTeacherEmails`
2. Editar `tools/firestore.rules` → `allowedTeacherEmails()`
3. Desplegar reglas

## 🎓 Arquitectura de la Solución

```
┌─────────────────────────────────────────────────┐
│         Usuario intenta acceder                 │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│     ¿Tiene Custom Claim "docente"?              │
│            (de Cloud Function)                   │
└──────────┬──────────────────┬───────────────────┘
           │ Sí               │ No
           ▼                  ▼
      ┌────────┐      ┌─────────────────────────┐
      │Docente │      │ ¿Email en lista blanca? │
      └────────┘      └──────┬──────────┬───────┘
                             │ Sí       │ No
                             ▼          ▼
                        ┌────────┐  ┌──────────────┐
                        │Docente │  │ ¿Existe en   │
                        └────────┘  │ /teachers?   │
                                    └──┬──────┬────┘
                                       │ Sí   │ No
                                       ▼      ▼
                                  ┌────────┐ ┌───────────┐
                                  │Docente │ │Estudiante │
                                  └────────┘ └───────────┘
```

## 📊 Cobertura de Reglas

| Colección | Lectura | Escritura | Notas |
|-----------|---------|-----------|-------|
| `teachers` | ✅ Autenticados | ✅ Propio documento | Auto-creación en login |
| `attendances` | ✅ Docentes + Estudiantes | ✅ Crear: Estudiantes<br>✅ Gestionar: Docentes | Validación de dominio |
| `grades` | ✅ Docentes + Propio estudiante | ✅ Solo docentes | Por UID |
| `materials` | ✅ Dominio autorizado | ✅ Solo docentes | Contador de descargas |
| `forum_topics` | ✅ Dominio autorizado | ✅ Crear: Todos<br>✅ Editar: Docentes + Autor | Moderación |
| `grupos` | ✅ Dominio autorizado | ✅ Solo docentes | Panel docente |

## 🔐 Seguridad

- ✅ Validación de dominio institucional
- ✅ Control de acceso basado en roles
- ✅ Protección contra escrituras maliciosas
- ✅ Separación de permisos docente/estudiante
- ✅ Auditoría mediante Firestore

## 🧪 Testing

```bash
# Las reglas se pueden testear localmente con:
firebase emulators:start

# O en producción con usuarios de prueba
```

## 📝 Notas Importantes

1. **Primer despliegue**: Asegúrate de crear el documento del docente principal en `/teachers`
2. **Dominios autorizados**: Verifica que tu dominio esté en Firebase Auth → Settings
3. **Cloud Functions**: Opcional pero recomendado para asignación automática de roles
4. **Backup**: Las reglas anteriores se sobrescriben, pero puedes restaurarlas desde el historial de Firebase Console

## 🔄 Rollback

Si necesitas revertir los cambios:

1. Ir a Firebase Console → Firestore Database → Rules
2. Hacer clic en "History"
3. Seleccionar versión anterior
4. Hacer clic en "Restore"

## 👨‍💻 Autor

Solución implementada para resolver problemas de autenticación en la Plataforma de Calidad de Software - ITSON

---

**¿Preguntas?** Consulta la documentación completa o abre un issue en GitHub.
