@echo off
REM Script para desplegar las reglas de seguridad de Firestore
REM Uso: deploy-firestore-rules.bat

echo ======================================
echo Desplegando reglas de Firestore...
echo ======================================
echo.

REM Verificar que Firebase CLI esté instalado
where firebase >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Firebase CLI no está instalado.
    echo.
    echo Para instalar Firebase CLI:
    echo   npm install -g firebase-tools
    echo.
    pause
    exit /b 1
)

REM Verificar que el archivo de reglas exista
if not exist "tools\firestore.rules" (
    echo Error: No se encontró el archivo tools\firestore.rules
    pause
    exit /b 1
)

REM Mostrar resumen de las reglas
echo Resumen de las reglas actualizadas:
echo   - Verificación múltiple de roles (Custom Claims + Lista blanca + Firestore)
echo   - Validación de dominio @potros.itson.edu.mx
echo   - Permisos mejorados para materiales, asistencias, calificaciones y foro
echo.

REM Preguntar confirmación
set /p confirm="¿Deseas continuar con el despliegue? (s/n): "
if /i not "%confirm%"=="s" (
    echo Despliegue cancelado.
    pause
    exit /b 0
)

REM Desplegar reglas
echo.
echo Desplegando reglas de Firestore...
firebase deploy --only firestore:rules

REM Verificar resultado
if %errorlevel% equ 0 (
    echo.
    echo ¡Reglas de Firestore desplegadas exitosamente!
    echo.
    echo Próximos pasos:
    echo   1. Verifica que el docente pueda iniciar sesión
    echo   2. Crea documentos en /teachers/{uid} si es necesario
    echo   3. (Opcional) Actualiza config/teacherAllowlist en Firestore
    echo.
    echo Para más información, consulta: docs\SOLUCION_AUTENTICACION.md
) else (
    echo.
    echo Error al desplegar las reglas.
    echo Verifica que estés autenticado: firebase login
)

echo.
pause
