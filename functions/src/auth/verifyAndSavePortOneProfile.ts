import { createHmac } from 'node:crypto';
import { PortOneClient } from '@portone/server-sdk';
import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import { ValidationError, ERROR_CODES } from '../errors/AppError';
import { handleFunctionError } from '../errors/errorHandler';
import { requireAuth, requireMaxLength, requireString } from '../errors/validators';
import { withCallableGuard } from '../middleware/callableGuard';
import { isValidKoreanPhone, maskPhone, toE164 } from '../utils/phone';
import { hasXSSPattern, isValidEmail } from '../utils/security';

const TERMS_VERSION = '1.0.0';
const MIN_SIGNUP_AGE = 14;

interface VerifyAndSavePortOneProfileData {
  identityVerificationId: string;
  nickname?: string;
  region?: string;
  experienceYears?: number;
  career?: string;
  note?: string;
  termsAgreed: boolean;
  privacyAgreed: boolean;
  marketingAgreed: boolean;
  email?: string;
  mode: 'signup' | 'social';
}

function validateString(
  value: unknown,
  field: string,
  opts: { min?: number; max?: number; pattern?: RegExp }
): string {
  const { min = 1, max = 500, pattern } = opts;

  if (value === undefined || value === null || value === '') {
    throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
      userMessage: `${field}을(를) 입력해주세요.`,
    });
  }

  if (typeof value !== 'string') {
    throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
      userMessage: `${field} 형식이 올바르지 않습니다.`,
    });
  }

  const trimmed = value.trim();

  if (trimmed.length < min) {
    throw new ValidationError(ERROR_CODES.VALIDATION_MIN_LENGTH, {
      userMessage: `${field}은(는) 최소 ${min}자 이상이어야 합니다.`,
    });
  }

  if (trimmed.length > max) {
    throw new ValidationError(ERROR_CODES.VALIDATION_MAX_LENGTH, {
      userMessage: `${field}은(는) ${max}자를 초과할 수 없습니다.`,
    });
  }

  if (hasXSSPattern(trimmed)) {
    throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
      userMessage: '사용할 수 없는 문자가 포함되어 있습니다.',
    });
  }

  if (pattern && !pattern.test(trimmed)) {
    throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
      userMessage: `${field} 형식이 올바르지 않습니다.`,
    });
  }

  return trimmed;
}

function validateOptionalString(
  value: unknown,
  field: string,
  opts: { max?: number }
): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return validateString(value, field, { min: 1, ...opts });
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
    logger.error('verifyAndSavePortOneProfile: PORTONE_API_SECRET missing');
    throw new Error('PORTONE_API_SECRET is not configured');
  }

  return secret;
}

function validateAge(birthDate: string): void {
  const year = parseInt(birthDate.substring(0, 4), 10);
  const month = parseInt(birthDate.substring(4, 6), 10);
  const day = parseInt(birthDate.substring(6, 8), 10);
  const today = new Date();
  let age = today.getFullYear() - year;
  const monthDiff = today.getMonth() + 1 - month;

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < day)) {
    age--;
  }

  if (age < MIN_SIGNUP_AGE) {
    throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
      userMessage: `만 ${MIN_SIGNUP_AGE}세 이상만 가입할 수 있습니다.`,
    });
  }
}

export const verifyAndSavePortOneProfile = onCall(
  { region: 'asia-northeast3' },
  (request) =>
    withCallableGuard(
      request,
      {
        operation: 'verifyAndSavePortOneProfile',
        rateLimit: {
          maxRequests: 3,
          authenticatedMaxRequests: 5,
          keyPrefix: 'ratelimit:verify-portone-profile',
        },
        requireRecaptcha: false,
      },
      async (request) => {
        let authPhoneSet = false;

        try {
          const uid = requireAuth(request);
          const data = request.data as VerifyAndSavePortOneProfileData;
          const identityVerificationId = requireString(
            data.identityVerificationId,
            '본인인증 ID'
          );
          requireMaxLength(identityVerificationId, 200, '본인인증 ID');

          if (data.mode !== 'signup' && data.mode !== 'social') {
            throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
              userMessage: '잘못된 요청입니다.',
            });
          }

          if (!data.termsAgreed || !data.privacyAgreed) {
            throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
              userMessage: '필수 약관에 동의해야 합니다.',
            });
          }

          const nickname = data.nickname
            ? validateString(data.nickname, '닉네임', { min: 2, max: 15 })
            : undefined;
          const region = validateOptionalString(data.region, '지역', { max: 50 });
          const career = validateOptionalString(data.career, '경력', { max: 500 });
          const note = validateOptionalString(data.note, '기타사항', { max: 300 });
          const email = validateOptionalString(data.email, '이메일', { max: 100 });
          const hasNickname = Boolean(nickname);

          if (email && !isValidEmail(email)) {
            throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
              userMessage: '올바른 이메일 형식이 아닙니다.',
            });
          }

          let experienceYears: number | undefined;
          if (data.experienceYears != null) {
            if (
              typeof data.experienceYears !== 'number' ||
              data.experienceYears < 0 ||
              data.experienceYears > 50 ||
              !Number.isInteger(data.experienceYears)
            ) {
              throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
                userMessage: '경력은 0~50 사이의 정수여야 합니다.',
              });
            }

            experienceYears = data.experienceYears;
          }

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
          const name = validateString(verifiedCustomer.name, '이름', {
            min: 2,
            max: 20,
            pattern: /^[가-힣a-zA-Z\s]+$/,
          });
          const birthDate = normalizeBirthDate(verifiedCustomer.birthDate);
          if (!birthDate) {
            throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
              userMessage: '본인인증 생년월일 정보를 확인할 수 없습니다.',
            });
          }
          validateAge(birthDate);

          const gender = normalizeGender(verifiedCustomer.gender);
          if (!gender) {
            throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
              userMessage: '본인인증 성별 정보를 확인할 수 없습니다.',
            });
          }

          const normalizedPhoneNumber =
            typeof verifiedCustomer.phoneNumber === 'string' &&
            isValidKoreanPhone(verifiedCustomer.phoneNumber)
              ? toE164(verifiedCustomer.phoneNumber)
              : undefined;

          if (!normalizedPhoneNumber) {
            throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
              userMessage:
                '본인인증 결과에 휴대폰 번호가 없습니다. 이니시스 연동 옵션을 확인해주세요.',
            });
          }

          const ciHash =
            typeof verifiedCustomer.ci === 'string' && verifiedCustomer.ci.length > 0
              ? createDeterministicHash(verifiedCustomer.ci, portOneSecret)
              : undefined;

          try {
            await admin.auth().updateUser(uid, {
              phoneNumber: normalizedPhoneNumber,
            });
            authPhoneSet = true;
          } catch (updateError) {
            const errorCode = (updateError as { code?: string })?.code;
            if (errorCode === 'auth/phone-number-already-exists') {
              throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
                userMessage: '이미 다른 계정에 등록된 휴대폰 번호입니다.',
              });
            }
            throw updateError;
          }

          const db = admin.firestore();
          const userDocRef = db.collection('users').doc(uid);
          const consentRef = userDocRef.collection('consents').doc('current');
          const consentHistoryRef = userDocRef.collection('consents').doc();
          const now = admin.firestore.FieldValue.serverTimestamp();
          const role = 'staff' as const;

          const identityData: Record<string, unknown> = {
            provider: 'portone',
            channel: 'inicis_unified',
            identityVerificationId,
            verifiedAt: identityVerification.verifiedAt,
            name,
            birthDate,
            gender,
            phoneNumber: normalizedPhoneNumber,
            isForeigner: verifiedCustomer.isForeigner ?? false,
          };

          if (ciHash) {
            identityData.ciHash = ciHash;
          }

          const profileData: Record<string, unknown> = {
            uid,
            name,
            birthDate,
            gender,
            phone: normalizedPhoneNumber,
            role,
            status: 'active' as const,
            phoneVerified: true,
            identityVerified: true,
            identityProvider: 'portone_inicis',
            identity: identityData,
            isActive: true,
            profileCompleted: hasNickname,
            updatedAt: now,
          };

          if (nickname) profileData.nickname = nickname;
          if (email) profileData.email = email;
          if (region) profileData.region = region;
          if (experienceYears !== undefined) profileData.experienceYears = experienceYears;
          if (career) profileData.career = career;
          if (note) profileData.note = note;

          const consentData: Record<string, unknown> = {
            version: TERMS_VERSION,
            userId: uid,
            termsOfService: {
              agreed: true,
              version: TERMS_VERSION,
              agreedAt: now,
            },
            privacyPolicy: {
              agreed: true,
              version: TERMS_VERSION,
              agreedAt: now,
            },
            marketing: data.marketingAgreed
              ? { agreed: true, agreedAt: now }
              : { agreed: false, declinedAt: now },
            updatedAt: now,
          };

          try {
            await db.runTransaction(async (transaction) => {
              const readPromises: [
                Promise<FirebaseFirestore.DocumentSnapshot>,
                Promise<FirebaseFirestore.QuerySnapshot>,
                ...Promise<FirebaseFirestore.QuerySnapshot>[],
              ] = [
                transaction.get(userDocRef),
                transaction.get(
                  db.collection('users').where('phone', '==', normalizedPhoneNumber).limit(1)
                ),
              ];

              if (hasNickname && nickname) {
                readPromises.push(
                  transaction.get(db.collection('users').where('nickname', '==', nickname).limit(1))
                );
              }

              if (ciHash) {
                readPromises.push(
                  transaction.get(db.collection('users').where('identity.ciHash', '==', ciHash).limit(1))
                );
              }

              const [freshDoc, phoneSnap, ...rest] = await Promise.all(readPromises);
              const nicknameSnap = hasNickname ? rest.shift() ?? null : null;
              const ciSnap = ciHash ? rest.shift() ?? null : null;

              if (!phoneSnap.empty) {
                const existingUser = phoneSnap.docs[0];
                if (existingUser.id !== uid) {
                  throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
                    userMessage: '이미 등록된 휴대폰 번호입니다.',
                  });
                }
              }

              if (nicknameSnap && !nicknameSnap.empty) {
                const nicknameOwner = nicknameSnap.docs[0];
                if (nicknameOwner.id !== uid) {
                  throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
                    userMessage: '이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해주세요.',
                  });
                }
              }

              if (ciSnap && !ciSnap.empty) {
                const identityOwner = ciSnap.docs[0];
                if (identityOwner.id !== uid) {
                  throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
                    userMessage: '이미 가입된 본인인증 정보입니다.',
                  });
                }
              }

              if (!freshDoc.exists) {
                profileData.createdAt = now;
              }

              transaction.set(userDocRef, profileData, { merge: true });
              transaction.set(consentRef, consentData, { merge: true });
              transaction.set(consentHistoryRef, {
                ...consentData,
                createdAt: now,
              });
            });
          } catch (transactionError) {
            if (authPhoneSet) {
              try {
                await admin.auth().updateUser(uid, { phoneNumber: null });
              } catch (rollbackError) {
                logger.error(
                  'verifyAndSavePortOneProfile: failed to rollback auth phone after transaction error',
                  {
                    uid,
                    phone: maskPhone(normalizedPhoneNumber),
                    error: rollbackError,
                  }
                );
              }
            }

            throw transactionError;
          }

          try {
            await admin.auth().updateUser(uid, { displayName: name });
          } catch (displayNameError) {
            logger.warn('verifyAndSavePortOneProfile: displayName update failed', {
              uid,
              error: displayNameError,
            });
          }

          try {
            await admin.auth().setCustomUserClaims(uid, { role });
          } catch (claimsError) {
            logger.warn('verifyAndSavePortOneProfile: claims update failed', {
              uid,
              error: claimsError,
            });
          }

          logger.info('verifyAndSavePortOneProfile: success', {
            uid,
            identityVerificationId,
            phone: maskPhone(normalizedPhoneNumber),
            hasCiHash: Boolean(ciHash),
          });

          return {
            success: true,
            uid,
          };
        } catch (error) {
          throw handleFunctionError(error, {
            operation: 'verifyAndSavePortOneProfile',
            context: {
              userId: request.auth?.uid,
              identityVerificationId: (
                request.data as VerifyAndSavePortOneProfileData | undefined
              )?.identityVerificationId,
            },
          });
        }
      }
    ),
);
