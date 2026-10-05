export type TransactionAuthRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type TransactionAuthFactor = 'transaction_pin' | 'biometric' | 'additional_verification';

export interface TransactionAuthPolicyInput {
  amountMinor: number;
  transactionType: 'transfer' | 'merchant_payment' | 'invoice_payment' | 'payment_request' | 'bill_payment' | 'school_payment' | 'other';
  isNewRecipient?: boolean;
  isNewDevice?: boolean;
  unusualActivity?: boolean;
  recentTransactionCount?: number;
}

export interface TransactionAuthPolicyDecision {
  riskLevel: TransactionAuthRiskLevel;
  biometricLevel: 0 | 1 | 2 | 3;
  requiredFactors: TransactionAuthFactor[];
  reason: 'standard' | 'amount_step_up' | 'risk_step_up';
}

/**
 * UniquePay Global Transaction Authentication Policy v1.
 *
 * Security is decided server-side. Every money-moving module should use this
 * policy instead of inventing its own authentication rules.
 *
 * Amounts are NGN minor units (kobo):
 *   < ₦50,000      -> Transaction PIN
 *   ₦50,000-199,999 -> PIN + biometric
 *   ₦200,000-499,999 -> PIN + biometric (higher risk tier)
 *   >= ₦500,000     -> PIN + biometric (highest tier)
 *
 * Additional risk signals can only increase the required step-up; they never
 * reduce the baseline protection. The first low-value transaction is therefore
 * not forced into biometric verification merely because it is the customer's
 * first transaction.
 */
export function getTransactionAuthPolicy(input: TransactionAuthPolicyInput): TransactionAuthPolicyDecision {
  const amount = input.amountMinor;
  const biometricLevel: 0 | 1 | 2 | 3 =
    amount >= 50_000_000 ? 3 :
    amount >= 20_000_000 ? 2 :
    amount >= 5_000_000 ? 1 : 0;

  const velocityRisk = (input.recentTransactionCount ?? 0) >= 4;
  const riskSignal = Boolean(input.isNewRecipient || input.isNewDevice || input.unusualActivity || velocityRisk);

  if (riskSignal && biometricLevel === 0) {
    return {
      riskLevel: 'medium',
      biometricLevel: 1,
      requiredFactors: ['transaction_pin', 'biometric'],
      reason: 'risk_step_up',
    };
  }

  if (biometricLevel === 3) {
    return {
      riskLevel: 'critical',
      biometricLevel,
      requiredFactors: ['transaction_pin', 'biometric'],
      reason: 'amount_step_up',
    };
  }

  if (biometricLevel === 2) {
    return {
      riskLevel: 'high',
      biometricLevel,
      requiredFactors: ['transaction_pin', 'biometric'],
      reason: 'amount_step_up',
    };
  }

  if (biometricLevel === 1) {
    return {
      riskLevel: 'medium',
      biometricLevel,
      requiredFactors: ['transaction_pin', 'biometric'],
      reason: 'amount_step_up',
    };
  }

  return {
    riskLevel: 'low',
    biometricLevel: 0,
    requiredFactors: ['transaction_pin'],
    reason: 'standard',
  };
}
