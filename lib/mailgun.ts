import FormData from 'form-data';
import Mailgun from 'mailgun.js';

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY || 'API_KEY';
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || 'sandboxaa425eec7f4b4fa89e18b5e5d31e5a35.mailgun.org';

const mailgun = new Mailgun(FormData);
export const mg = mailgun.client({
  username: 'api',
  key: MAILGUN_API_KEY,
});

export async function sendEmail({
  to,
  subject,
  text,
  html,
}: {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
}) {
  try {
    const data = await mg.messages.create(MAILGUN_DOMAIN, {
      from: `Mailgun Sandbox <postmaster@${MAILGUN_DOMAIN}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      text,
      html,
    });
    return { success: true, data };
  } catch (error) {
    console.error('Mailgun Error:', error);
    return { success: false, error };
  }
}
