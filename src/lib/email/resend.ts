import { Resend } from 'resend';
import { dbStore } from '../../db';

export async function getResendClient() {
  const customApiKey = await dbStore.getSettings('resend_api_key').catch(() => null);
  const apiKey = (customApiKey && customApiKey.value && customApiKey.value[0]) || process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error('Resend API Key is not configured. Please define RESEND_API_KEY in environment secrets or enter it in App Settings below.');
  }

  return new Resend(apiKey);
}

export interface SendMailOptions {
  from?: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendMail(options: SendMailOptions) {
  const resendClient = await getResendClient();
  
  const customFrom = await dbStore.getSettings('email_from').catch(() => null);
  const from = options.from || (customFrom && customFrom.value && customFrom.value[0]) || process.env.EMAIL_FROM || 'Productivity App <onboarding@resend.dev>';

  const response = await resendClient.emails.send({
    from,
    to: [options.to],
    subject: options.subject,
    html: options.html,
    text: options.text,
  });

  if (response.error) {
    throw new Error(response.error.message);
  }

  return response.data;
}
