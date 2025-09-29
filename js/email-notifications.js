import {
  emailServiceId,
  emailTemplateId,
  emailPublicKey,
  isEmailConfigured,
} from "./email-config.js";
import { listTeacherNotificationEmails } from "./firebase.js";

const EMAILJS_MODULE_URL =
  "https://cdn.jsdelivr.net/npm/@emailjs/browser@3/es/index.js";

let emailJsPromise = null;
let emailJsInitialized = false;
let missingConfigWarned = false;
let missingRecipientsWarned = false;
let missingGenericRecipientsWarned = false;

function safeTrim(value, fallback = "") {
  if (value == null) return fallback;
  if (typeof value === "string") {
    return value.trim();
  }
  try {
    return String(value).trim();
  } catch (_) {
    return fallback;
  }
}

function formatDateTime(date = new Date()) {
  try {
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch (_) {
    return date instanceof Date ? date.toISOString() : new Date().toISOString();
  }
}

function getCurrentUrl() {
  if (typeof window === "undefined" || !window.location) return "";
  return window.location.href;
}

function buildForumUrl(topicId) {
  if (typeof window === "undefined" || !window.location) return "";
  const { origin, pathname } = window.location;
  const base = `${origin}${pathname}`;
  if (!topicId) return base;
  return `${base}#tema-${topicId}`;
}

function truncateText(text, maxLength = 180) {
  const value = safeTrim(text, "");
  if (!value) return "";
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

async function loadEmailJs() {
  if (!emailJsPromise) {
    emailJsPromise = import(EMAILJS_MODULE_URL)
      .then((module) => {
        const emailjs = module?.default || module?.emailjs || module;
        if (emailjs && typeof emailjs.init === "function" && !emailJsInitialized) {
          emailjs.init(emailPublicKey);
          emailJsInitialized = true;
        }
        return emailjs;
      })
      .catch((error) => {
        console.warn("[email-notifications] No se pudo cargar EmailJS", error);
        return null;
      });
  }
  return emailJsPromise;
}

function normalizeRecipientList(recipients = []) {
  const unique = new Map();
  recipients
    .map((recipient) => {
      if (!recipient || typeof recipient !== "object") return null;
      const email = safeTrim(recipient.email);
      if (!email) return null;
      const name = safeTrim(
        recipient.name || recipient.displayName || recipient.to_name
      );
      return { email, name };
    })
    .filter(Boolean)
    .forEach(({ email, name }) => {
      const key = email.toLowerCase();
      if (!unique.has(key)) {
        unique.set(key, {
          email,
          name: name || email,
        });
      }
    });
  return Array.from(unique.values());
}

async function dispatchNotificationToRecipients({
  recipients = [],
  templateParams = {},
  debugContext = "general",
  fallbackName = "Comunidad educativa",
} = {}) {
  if (!isEmailConfigured()) {
    if (!missingConfigWarned) {
      console.info(
        "[email-notifications] EmailJS no está configurado. Omite el envío de notificaciones."
      );
      missingConfigWarned = true;
    }
    return false;
  }

  const emailjs = await loadEmailJs();
  if (!emailjs || typeof emailjs.send !== "function") {
    console.warn("[email-notifications] EmailJS no disponible para enviar notificaciones");
    return false;
  }

  const normalizedRecipients = normalizeRecipientList(recipients);
  if (!normalizedRecipients.length) {
    if (!missingGenericRecipientsWarned) {
      console.info(
        "[email-notifications] No se enviará notificación: no hay destinatarios válidos."
      );
      missingGenericRecipientsWarned = true;
    }
    return false;
  }

  const toEmails = normalizedRecipients.map((item) => item.email).join(",");
  const toName =
    templateParams.to_name ||
    normalizedRecipients[0]?.name ||
    fallbackName ||
    "Equipo";

  const params = {
    to_email: toEmails,
    to_name: toName,
    timestamp: formatDateTime(),
    ...templateParams,
  };

  try {
    await emailjs.send(emailServiceId, emailTemplateId, params);
    return true;
  } catch (error) {
    console.warn(`[email-notifications] Error al enviar (${debugContext})`, error);
    return false;
  }
}

async function dispatchTeacherNotification({
  templateParams = {},
  debugContext = "general",
} = {}) {
  const teacherRecipients = await listTeacherNotificationEmails({ domainOnly: true });
  if (!teacherRecipients.length) {
    if (!missingRecipientsWarned) {
      console.info(
        "[email-notifications] No se encontraron correos de docentes autorizados con dominio válido."
      );
      missingRecipientsWarned = true;
    }
    return false;
  }

  return dispatchNotificationToRecipients({
    recipients: teacherRecipients.map((email) => ({ email })),
    templateParams: {
      ...templateParams,
      to_name: templateParams.to_name || "Equipo docente",
    },
    debugContext,
    fallbackName: "Equipo docente",
  });
}

const KIND_LABELS = {
  activity: "actividad",
  homework: "tarea",
  evidence: "evidencia",
};

export async function notifyTeacherAboutStudentUpload({
  submissionId,
  submission,
} = {}) {
  try {
    if (!submission || !submission.student || !submission.student.uid) {
      return false;
    }

    const extra = submission.extra || {};
    const uploadedBy = extra.uploadedBy || submission.uploadedBy || null;
    const uploadedByUid = uploadedBy && typeof uploadedBy === "object" ? uploadedBy.uid : null;
    const studentUid = submission.student.uid;

    if (uploadedByUid && uploadedByUid !== studentUid) {
      // Evidencia registrada por el docente; omitimos notificación redundante.
      return false;
    }

    if (typeof extra.source === "string" && extra.source.includes("teacher")) {
      return false;
    }

    const kindKey = safeTrim(submission.kind, "").toLowerCase();
    const actionLabel = KIND_LABELS[kindKey] || "entrega";

    const studentName =
      safeTrim(submission.student.displayName) ||
      safeTrim(submission.student.name) ||
      safeTrim(submission.student.email) ||
      "Alumno";
    const studentEmail = safeTrim(submission.student.email);

    const title = safeTrim(submission.title) || "Entrega sin título";
    const description = safeTrim(submission.description);
    const unitLabel = safeTrim(extra.unitLabel);
    const activityId = safeTrim(extra.activityId);
    const fileName = safeTrim(submission.fileName);
    const fileUrl = safeTrim(submission.fileUrl);

    const messageParts = [
      `El alumno ${studentName}${studentEmail ? ` (${studentEmail})` : ""} registró una ${actionLabel}.`,
      title ? `Título: ${title}.` : "",
      unitLabel ? `Unidad: ${unitLabel}.` : "",
      description ? `Descripción: ${description}` : "",
    ].filter(Boolean);

    const actionUrl = getCurrentUrl();

    return dispatchTeacherNotification({
      debugContext: "student-upload",
      templateParams: {
        subject: `Nueva ${actionLabel} de ${studentName}`,
        message: messageParts.join(" "),
        action_type: "student_upload",
        action_label: actionLabel,
        action_kind: kindKey || "entrega",
        student_name: studentName,
        student_email: studentEmail,
        submission_id: submissionId || "",
        submission_title: title,
        submission_description: description,
        submission_kind: kindKey,
        file_name: fileName,
        file_url: fileUrl,
        unit_label: unitLabel,
        activity_id: activityId,
        action_url: actionUrl,
      },
    });
  } catch (error) {
    console.warn("[email-notifications] notifyTeacherAboutStudentUpload", error);
    return false;
  }
}

export async function notifyTeacherAboutForumReply({
  topicId,
  topicTitle,
  replyText,
  replyId = null,
  student = {},
  isTeacherAuthor = false,
} = {}) {
  try {
    if (isTeacherAuthor) {
      return false;
    }
    const text = safeTrim(replyText);
    if (!text) {
      return false;
    }
    const studentEmail = safeTrim(student.email);
    const studentName =
      safeTrim(student.displayName) ||
      safeTrim(student.name) ||
      studentEmail ||
      "Alumno";

    const excerpt = truncateText(text, 220);
    const actionUrl = buildForumUrl(topicId);

    const subjectBase = topicTitle ? `en "${topicTitle}"` : "en el foro";

    return dispatchTeacherNotification({
      debugContext: "forum-reply",
      templateParams: {
        subject: `Nuevo comentario ${subjectBase} por ${studentName}`,
        message: `${studentName}${studentEmail ? ` (${studentEmail})` : ""} escribió: ${excerpt}`,
        action_type: "forum_reply",
        action_label: "comentario",
        forum_topic_id: topicId || "",
        forum_topic_title: safeTrim(topicTitle),
        forum_reply_excerpt: excerpt,
        forum_reply_id: replyId || "",
        student_name: studentName,
        student_email: studentEmail,
        action_url: actionUrl,
      },
    });
  } catch (error) {
    console.warn("[email-notifications] notifyTeacherAboutForumReply", error);
    return false;
  }
}

export async function notifyForumParticipantsAboutReply({
  topicId,
  topicTitle,
  replyText,
  replyId = null,
  replyAuthor = {},
  recipients = [],
} = {}) {
  try {
    const text = safeTrim(replyText);
    if (!text) {
      return false;
    }

    const authorEmail = safeTrim(replyAuthor.email);
    const authorName =
      safeTrim(replyAuthor.displayName) ||
      safeTrim(replyAuthor.name) ||
      authorEmail ||
      "Participante";

    const normalizedRecipients = normalizeRecipientList(recipients).filter(
      (item) => item.email.toLowerCase() !== authorEmail.toLowerCase()
    );

    if (!normalizedRecipients.length) {
      return false;
    }

    const excerpt = truncateText(text, 220);
    const actionUrl = buildForumUrl(topicId);
    const subjectBase = topicTitle ? `en "${topicTitle}"` : "en el foro";

    return dispatchNotificationToRecipients({
      recipients: normalizedRecipients,
      templateParams: {
        subject: `Nueva respuesta ${subjectBase} de ${authorName}`,
        message: `${authorName}${authorEmail ? ` (${authorEmail})` : ""} escribió: ${excerpt}`,
        action_type: "forum_reply_participant",
        action_label: "respuesta",
        forum_topic_id: topicId || "",
        forum_topic_title: safeTrim(topicTitle),
        forum_reply_excerpt: excerpt,
        forum_reply_id: replyId || "",
        participant_name: authorName,
        participant_email: authorEmail,
        action_url: actionUrl,
      },
      debugContext: "forum-reply-participants",
      fallbackName: "Participantes del foro",
    });
  } catch (error) {
    console.warn("[email-notifications] notifyForumParticipantsAboutReply", error);
    return false;
  }
}
