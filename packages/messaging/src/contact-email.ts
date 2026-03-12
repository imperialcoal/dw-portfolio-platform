import {
  isMessagingConfigured,
  messagingEnv,
} from "@dw/validators/messaging-env";

import { getResendClient } from "./resend-client";

export interface ContactFormData {
  name: string;
  email: string;
  message: string;
}

export async function sendContactEmail(data: ContactFormData): Promise<void> {
  if (!isMessagingConfigured()) {
    // Local/offline dev — log instead of throwing so the app doesn't crash
    console.info("[Resend not configured] Contact form submission:", data);
    return;
  }

  const env = messagingEnv();
  const resend = getResendClient();

  const { error } = await resend.emails.send({
    from: String(env.RESEND_FROM_EMAIL),
    to: String(env.RESEND_TO_EMAIL),
    replyTo: data.email,
    subject: `New message from ${data.name}`,
    html: `
      <h2>New Contact Form Submission</h2>
      <p><strong>From:</strong> ${data.name}</p>
      <p><strong>Email:</strong> ${data.email}</p>
      <p><strong>Message:</strong></p>
      <p>${data.message.replace(/\n/g, "<br>")}</p>
    `,
    text: `
New Contact Form Submission

From: ${data.name}
Email: ${data.email}

Message:
${data.message}
    `.trim(),
  });

  if (error) {
    throw new Error(`Failed to send contact email: ${error.message}`);
  }
}
