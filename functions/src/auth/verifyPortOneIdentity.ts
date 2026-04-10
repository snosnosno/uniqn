import { createHmac } from 'node:crypto';
import { PortOneClient } from '@portone/server-sdk';
import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import { ValidationError, ERROR_CODES } from '../errors/AppError';
import { handleFunctionError } from '../errors/errorHandler';
import { requireMaxLength, requireString } from '../errors/validators';
import { withCallableGuard } from '../middleware/callableGuard';
import { isValidKoreanPhone, maskPhone, toE164 } from '../utils/phone';

interface VerifyPortOneIdentityData {
  identityVerificationId: string;
}

interface VerifyPortOneIdentityResult {
  success: true;
  identityVerified: true;
  phoneVerified: boolean;
  hasDuplicatePhone: boolean;
  hasDuplicateIdentity: boolean;
  identity: {
    provider: 'portone';
    channel: 'inicis_unified';
    identityVerificationId: string;
    verifiedAt: string;
    name: string;
    birthDate: string;
    gender?: 'male' | 'female';
    phoneNumber?: string;
    ciHash?: string;
    isForeigner?: boolean;
  };
}

function normalizeBirthDate(value?: string): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.replace(/-/g, '');
  return /^\d{8}$/.test(normalized) ? normalized : null;
}

function normalizeGender(value?: string): 'male' | 'female' | undefined {
  switch (value) {
    case 'MALE':
      return 'male';
    case 'FEMALE':
      return 'female';
    default:
      return undefined;
  }
}

function createDeterministicHash(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

function getPortOneSecret(): string {
  const secret = process.env.PORTONE_API_SECRET?.trim();

  if (!secret) {
    logger.error('verifyPortOneIdentity: PORTONE_API_SECRET missing');
    throw new Error('PORTONE_API_SECRET is not configured');
  }

  return secret;
}

export const verifyPortOneIdentity = onCall(
  { region: 'asia-northeast3' },
  (request) =>
    withCallableGuard(
      request,
      {
        operation: 'verifyPortOneIdentity',
        rateLimit: {
          maxRequests: 3,
          authenticatedMaxRequests: 10,
          keyPrefix: 'ratelimit:verify-portone-identity',
        },
        requireRecaptcha: false,
      },
      async (request) => {
        try {
          const uid = request.auth?.uid ?? null;
          const data = request.data as VerifyPortOneIdentityData;
          const identityVerificationId = requireString(
            data.identityVerificationId,
            '본인인증 ID'
          );
          requireMaxLength(identityVerificationId, 200, '본인인증 ID');

          const portOneSecret = getPortOneSecret();
          const client = PortOneClient({ secret: portOneSecret });
          const identityVerification =
            await client.identityVerification.getIdentityVerification({
              identityVerificationId,
            });

          if (identityVerification.status !== 'VERIFIED') {
            throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
              userMessage: '포트원 본인인증이 아직 완료되지 않았습니다.',
            });
          }

          const verifiedCustomer = identityVerification.verifiedCustomer;
          const normalizedBirthDate = normalizeBirthDate(verifiedCustomer.birthDate);
          if (!normalizedBirthDate) {
            throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
              userMessage: '본인인증 생년월일 정보를 확인할 수 없습니다.',
            });
          }

          const normalizedPhoneNumber =
            typeof verifiedCustomer.phoneNumber === 'string' &&
            isValidKoreanPhone(verifiedCustomer.phoneNumber)
              ? toE164(verifiedCustomer.phoneNumber)
              : undefined;
          const ciHash =
            typeof verifiedCustomer.ci === 'string' && verifiedCustomer.ci.length > 0
              ? createDeterministicHash(verifiedCustomer.ci, portOneSecret)
              : undefined;

          const db = admin.firestore();
          const [phoneConflictSnapshot, identityConflictSnapshot] = await Promise.all([
            normalizedPhoneNumber
              ? db.collection('users').where('phone', '==', normalizedPhoneNumber).limit(2).get()
              : Promise.resolve(null),
            ciHash
              ? db.collection('users').where('identity.ciHash', '==', ciHash).limit(2).get()
              : Promise.resolve(null),
          ]);

          const hasDuplicatePhone = Boolean(
            phoneConflictSnapshot?.docs.some((doc) => (uid ? doc.id !== uid : true))
          );
          const hasDuplicateIdentity = Boolean(
            identityConflictSnapshot?.docs.some((doc) => (uid ? doc.id !== uid : true))
          );

          logger.info('verifyPortOneIdentity: verified', {
            uid,
            identityVerificationId,
            phoneVerified: Boolean(normalizedPhoneNumber),
            hasDuplicatePhone,
            hasDuplicateIdentity,
            phone: normalizedPhoneNumber ? maskPhone(normalizedPhoneNumber) : undefined,
          });

          const response: VerifyPortOneIdentityResult = {
            success: true,
            identityVerified: true,
            phoneVerified: Boolean(normalizedPhoneNumber),
            hasDuplicatePhone,
            hasDuplicateIdentity,
            identity: {
              provider: 'portone',
              channel: 'inicis_unified',
              identityVerificationId,
              verifiedAt: identityVerification.verifiedAt,
              name: verifiedCustomer.name,
              birthDate: normalizedBirthDate,
              gender: normalizeGender(verifiedCustomer.gender),
              phoneNumber: normalizedPhoneNumber,
              ciHash,
              isForeigner: verifiedCustomer.isForeigner,
            },
          };

          return response;
        } catch (error) {
          throw handleFunctionError(error, {
            operation: 'verifyPortOneIdentity',
            context: {
              userId: request.auth?.uid,
              identityVerificationId: (request.data as VerifyPortOneIdentityData | undefined)
                ?.identityVerificationId,
            },
          });
        }
      }
    ),
);
