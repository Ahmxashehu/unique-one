import type { UniqueOtpProvider, UniqueOtpPurpose, UniqueOtpChannel } from './uniqueOtp';

const DEFAULT_FROM = 'Unique One <no-reply@unique.one>';

function purposeLabel(purpose: UniqueOtpPurpose): string {
  switch (purpose) {
    case 'registration': return 'create your Unique One account';
    case 'password_reset': return 'reset your Unique One password';
    case 'phone_change': return 'confirm your phone number change';
    case 'transaction_step_up': return 'confirm your transaction';
    case 'email_verification': return 'verify your email address';
    case 'store_delivery_confirmation': return 'confirm Store delivery';
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class ResendEmailOtpProvider implements UniqueOtpProvider {
  private readonly apiKey: string;
  private readonly from: string;
  private readonly baseUrl: string;

  constructor(options?: {
    apiKey?: string;
    from?: string;
    baseUrl?: string;
  }) {
    this.apiKey = options?.apiKey ?? process.env.RESEND_API_KEY ?? '';
    this.from = options?.from ?? process.env.UNIQUE_OTP_EMAIL_FROM ?? DEFAULT_FROM;
    this.baseUrl = (options?.baseUrl ?? process.env.RESEND_BASE_URL ?? 'https://api.resend.com').replace(/\/$/, '');

    if (!this.apiKey) throw new Error('RESEND_API_KEY_REQUIRED');
    if (!this.from || this.from.length > 320) throw new Error('INVALID_OTP_EMAIL_FROM');
  }

  async send(input: {
    destination: string;
    code: string;
    purpose: UniqueOtpPurpose;
    channel: UniqueOtpChannel;
    expiresInSeconds: number;
  }): Promise<void> {
    if (input.channel !== 'email') throw new Error('UNSUPPORTED_OTP_CHANNEL');
    const destination = input.destination.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)) {
      throw new Error('INVALID_OTP_DESTINATION');
    }

    const minutes = Math.max(1, Math.ceil(input.expiresInSeconds / 60));
    const purpose = purposeLabel(input.purpose);
    const subject = `Unique One verification code — ${input.code}`;
    const safeCode = escapeHtml(input.code);

    const response = await fetch(`${this.baseUrl}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: [destination],
        subject,
        text: `Your Unique One verification code is ${input.code}. Use it to ${purpose}. It expires in ${minutes} minutes. Do not share this code with anyone.`,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.5"><h2>Unique One</h2><p>Your verification code is:</p><p style="font-size:30px;font-weight:700;letter-spacing:6px">${safeCode}</p><p>Use this code to ${escapeHtml(purpose)}. It expires in ${minutes} minutes.</p><p>If you did not request this code, you can ignore this email.</p><p>Never share your verification code with anyone.</p></div>`,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`RESEND_SEND_FAILED_${response.status}${body ? `:${body.slice(0, 200)}` : ''}`);
    }
  }
}
