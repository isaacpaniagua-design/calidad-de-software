#!/bin/bash
# Script para desplegar las reglas de seguridad de Firestore
# Uso: ./deploy-firestore-rules.sh

echo "======================================"
echo "Desplegando reglas de Firestore..."
echo "======================================"
echo ""

# Verificar que Firebase CLI esté instalado
if ! command -v firebase &> /dev/null; then
    echo "❌ Error: Firebase CLI no está instalado."
    echo ""
    echo "Para instalar Firebase CLI:"
    echo "  npm install -g firebase-tools"
    echo ""
    exit 1
fi

# Verificar que el archivo de reglas exista
if [ ! -f "tools/firestore.rules" ]; then
    echo "❌ Error: No se encontró el archivo tools/firestore.rules"
    exit 1
fi

# Mostrar resumen de las reglas
echo "📋 Resumen de las reglas actualizadas:"
echo "  - Verificación múltiple de roles (Custom Claims + Lista blanca + Firestore)"
echo "  - Validación de dominio @potros.itson.edu.mx"
echo "  - Permisos mejorados para materiales, asistencias, calificaciones y foro"
echo ""

# Preguntar confirmación
read -p "¿Deseas continuar con el despliegue? (s/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[SsYy]$ ]]; then
    echo "❌ Despliegue cancelado."
    exit 0
fi

# Desplegar reglas
echo ""
echo "🚀 Desplegando reglas de Firestore..."
firebase deploy --only firestore:rules

# Verificar resultado
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ ¡Reglas de Firestore desplegadas exitosamente!"
    echo ""
    echo "📝 Próximos pasos:"
    echo "  1. Verifica que el docente pueda iniciar sesión"
    echo "  2. Crea documentos en /teachers/{uid} si es necesario"
    echo "  3. (Opcional) Actualiza config/teacherAllowlist en Firestore"
    echo ""
    echo "📖 Para más información, consulta: docs/SOLUCION_AUTENTICACION.md"
else
    echo ""
    echo "❌ Error al desplegar las reglas."
    echo "Verifica que estés autenticado: firebase login"
    exit 1
fi
