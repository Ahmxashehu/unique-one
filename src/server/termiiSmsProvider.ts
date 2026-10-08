import type { UniqueOtpProvider, UniqueOtpPurpose, UniqueOtpChannel } from './uniqueOtp';

const DEFAULT_TERMII_BASE_URL = 'https://api.ng.termii.com';

function purposeLabel(purpose: UniqueOtpPurpose): string {
  switch (purpose) {
    case 'registration': return 'registration';
    case 'password_reset': return 'password reset';
    case 'phone_change': return 'phone number change';
    case 'transaction_step_up': return 'transaction verification';
    case 'email_verification': return 'email verification';\n    case 'store_delivery_confirmation': return 'delivery confirmation';
  }
}

function normalizeNigeriaPhone(destination: string): string {
  const value = destination.trim().replace(/[\s()-]/g, '');
  if (/^\+234\d{10}$/.test(value)) return value.slice(1);
  if (/^234\d{10}$/.test(value)) return value;
  throw new Error('INVALID_OTP_DESTINATION');
}

export class TermiiSmsProvider implements UniqueOtpProvider {
  private readonly apiKey: string;
  private readonly senderId: string;
  private readonly whatsappDeviceId: string;
  private readonly whatsappTemplateId: string;
  private readonly baseUrl: string;

  constructor(options?: {
    apiKey?: string;
    senderId?: string;
    whatsappDeviceId?: string;
    whatsappTemplateId?: string;
    baseUrl?: string;
  }) {
    this.apiKey = options?.apiKey ?? process.env.TERMII_API_KEY ?? '';
    this.senderId = options?.senderId ?? process.env.TERMII_SENDER_ID ?? 'UniqueOTP';
    this.whatsappDeviceId = options?.whatsappDeviceId ?? process.env.TERMII_WHATSAPP_DEVICE_ID ?? '';
    this.whatsappTemplateId = options?.whatsappTemplateId ?? process.env.TERMII_WHATSAPP_TEMPLATE_ID ?? '';
    this.baseUrl = (options?.baseUrl ?? process.env.TERMII_BASE_URL ?? DEFAULT_TERMII_BASE_URL).replace(/\/$/, '');

    if (!this.apiKey) throw new Error('TERMII_API_KEY_REQUIRED');
    if (!/^[A-Za-z0-9 ._-]{3,11}$/.test(this.senderId)) {
      throw new Error('INVALID_TERMII_SENDER_ID');
    }
    if (this.whatsappDeviceId && !this.whatsappTemplateId) {
      throw new Error('TERMII_WHATSAPP_TEMPLATE_ID_REQUIRED');
    }
  }

  async send(input: {
    destination: string;
    code: string;
    purpose: UniqueOtpPurpose;
    channel: UniqueOtpChannel;
    expiresInSeconds: number;
  }): Promise<void> {
    if (input.channel !== 'sms' && input.channel !== 'whatsapp') throw new Error('UNSUPPORTED_OTP_CHANNEL');

    const phoneNumber = normalizeNigeriaPhone(input.destination);
    const expiryMinutes = Math.max(1, Math.ceil(input.expiresInSeconds / 60));
    const purpose = purposeLabel(input.purpose);
    const isWhatsApp = input.channel === 'whatsapp';

    if (isWhatsApp && !this.whatsappDeviceId) throw new Error('TERMII_WHATSAPP_NOT_CONFIGURED');

    const endpoint = isWhatsApp ? `${this.baseUrl}/api/send/template` : `${this.baseUrl}/api/sms/send`;
    const payload = isWhatsApp
      ? {
          phone_number: phoneNumber,
          device_id: this.whatsappDeviceId,
          template_id: this.whatsappTemplateId,
          api_key: this.apiKey,
          data: { product_name: 'Unique One', otp: input.code, expiry_time: `${expiryMinutes} minutes` },
        }
      : {
          api_key: this.apiKey,
          to: phoneNumber,
          from: this.senderId,
          sms: `Unique One: Your ${purpose} code is ${input.code}. It expires in ${expiryMinutes} minutes. Do not share this code.`,
          type: 'plain',
          channel: 'dnd',
        };
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`TERMII_${isWhatsApp ? 'WHATSAPP' : 'SMS'}_SEND_FAILED_${response.status}${body ? `:${body.slice(0, 200)}` : ''}`);
    }
  }
}
