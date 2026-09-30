import { getFirestore } from 'firebase-admin/firestore';
import { FirestoreUniqueOtpStore } from './firestoreUniqueOtpStore';
import { ResendEmailOtpProvider } from './resendEmailOtpProvider';
import { TermiiSmsProvider } from './termiiSmsProvider';
import { UniqueOtpService, type UniqueOtpChannel } from './uniqueOtp';

export function getUniqueOtpService(channel: UniqueOtpChannel): UniqueOtpService {
  const provider = channel === 'sms'
    ? new TermiiSmsProvider()
    : new ResendEmailOtpProvider();

  return new UniqueOtpService({
    store: new FirestoreUniqueOtpStore(getFirestore().collection('uniqueOtp')),
    provider,
    ttlSeconds: 5 * 60,
    maxAttempts: 5,
  });
}
