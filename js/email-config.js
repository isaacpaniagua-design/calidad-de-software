// Configuración para EmailJS. Rellena con tus credenciales de EmailJS.
// Crea una cuenta en https://www.emailjs.com/, configura un servicio (serviceId)
// y una plantilla (templateId). Obtén tu publicKey en el panel de EmailJS.
// Nota: No subas credenciales sensibles a repos públicos.

export const emailServiceId = "REEMPLAZA_SERVICE_ID";
export const emailTemplateId = "REEMPLAZA_TEMPLATE_ID";
export const emailPublicKey = "REEMPLAZA_PUBLIC_KEY";

export function isEmailConfigured() {
  return (
    emailServiceId && !emailServiceId.startsWith("REEMPLAZA_") &&
    emailTemplateId && !emailTemplateId.startsWith("REEMPLAZA_") &&
    emailPublicKey && !emailPublicKey.startsWith("REEMPLAZA_")
  );
}

