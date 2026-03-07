/**
 * verifyAndSaveProfile Cloud Function
 *
 * @description
 * 회원가입/소셜 프로필 완성 시 서버사이드 전화번호 검증 후 Firestore 프로필 저장
 * - Firebase Auth의 phoneNumber와 클라이언트 전달 verifiedPhone을 대조
 * - 동일 전화번호/닉네임 중복 검사 (병렬 pre-check + Transaction 원자적 쓰기)
 * - 입력값 XSS/길이/형식 서버 검증 (정규화 포함, 클라이언트 검증 우회 방지)
 * - 만 14세 미만 가입 제한
 * - Transaction으로 프로필 + 약관을 원자적 저장
 * - 약관 이력(consents history) 보존
 * - role 하드코딩 (클라이언트 값 무시 → 권한 상승 방지)
 * - Claims 실패 시 onUserRoleChange 트리거가 백업 동기화
 *
 * @version 2.0.0
 */

import { onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";
import { requireAuth } from "../errors/validators";
import { ValidationError, ERROR_CODES } from "../errors/AppError";
import { handleFunctionError } from "../errors/errorHandler";
import { withCallableGuard } from "../middleware/callableGuard";
import { toE164, maskPhone, isValidKoreanPhone } from "../utils/phone";
import { hasXSSPattern, isValidEmail } from "../utils/security";

// ============================================================================
// Constants
// ============================================================================

const TERMS_VERSION = "1.0.0";
const MIN_SIGNUP_AGE = 14;

// ============================================================================
// Types
// ============================================================================

interface VerifyAndSaveProfileData {
  /** 클라이언트가 전달한 인증된 전화번호 */
  verifiedPhone: string;
  /** 사용자 이름 */
  name: string;
  /** 생년월일 (YYYYMMDD) */
  birthDate: string;
  /** 성별 */
  gender: "male" | "female";
  /** 닉네임 */
  nickname: string;
  /** 지역 (선택) */
  region?: string;
  /** 경력 연수 (선택) */
  experienceYears?: number;
  /** 이력 (선택) */
  career?: string;
  /** 기타사항 (선택) */
  note?: string;
  /** 약관 동의 */
  termsAgreed: boolean;
  privacyAgreed: boolean;
  marketingAgreed: boolean;
  /** 이메일 (일반 가입 시) */
  email?: string;
  /** 모드: signup(일반) / social(소셜) */
  mode: "signup" | "social";
}

// ============================================================================
// Server-side Input Validation
// ============================================================================

/**
 * 문자열 입력 검증 (길이 + XSS + 형식)
 *
 * @returns 검증된 trimmed 문자열
 * @throws ValidationError 검증 실패 시
 */
function validateString(
  value: unknown,
  field: string,
  opts: { min?: number; max?: number; pattern?: RegExp },
): string {
  const { min = 1, max = 500, pattern } = opts;

  if (value === undefined || value === null || value === "") {
    throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
      userMessage: `${field}을(를) 입력해주세요.`,
    });
  }

  if (typeof value !== "string") {
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
      userMessage: "사용할 수 없는 문자열이 포함되어 있습니다.",
    });
  }

  if (pattern && !pattern.test(trimmed)) {
    throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
      userMessage: `${field} 형식이 올바르지 않습니다.`,
    });
  }

  return trimmed;
}

/** 선택 문자열 검증 (값이 존재할 때만) */
function validateOptionalString(
  value: unknown,
  field: string,
  opts: { max?: number },
): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return validateString(value, field, { min: 1, ...opts });
}

// ============================================================================
// Cloud Function
// ============================================================================

export const verifyAndSaveProfile = onCall(
  { region: "asia-northeast3" },
  (request) =>
    withCallableGuard(request, {
      operation: "verifyAndSaveProfile",
      rateLimit: {
        maxRequests: 3,
        authenticatedMaxRequests: 5,
        keyPrefix: "ratelimit:verify-profile",
      },
      requireRecaptcha: false,
    }, async (request) => {
    try {
      const uid = requireAuth(request);
      const data = request.data as VerifyAndSaveProfileData;

      // ── 1. 입력 검증 (XSS 정규화 + 길이 + 형식) ──────────────────────────

      const name = validateString(data.name, "이름", {
        min: 2,
        max: 20,
        pattern: /^[가-힣a-zA-Z\s]+$/,
      });
      const nickname = validateString(data.nickname, "닉네임", {
        min: 2,
        max: 15,
      });
      const birthDate = validateString(data.birthDate, "생년월일", {
        min: 8,
        max: 8,
        pattern: /^\d{8}$/,
      });

      // birthDate 논리 검증 (형식은 통과했으나 실제 날짜가 유효한지)
      // SYNC: 클라이언트(uniqn-mobile/src/schemas/auth.schema.ts birthDateSchema)에 동일 로직 존재
      // 변경 시 양쪽 수정 필요 (서버=보안, 클라이언트=UX)
      const bdYear = parseInt(birthDate.substring(0, 4), 10);
      const bdMonth = parseInt(birthDate.substring(4, 6), 10);
      const bdDay = parseInt(birthDate.substring(6, 8), 10);
      const currentYear = new Date().getFullYear();

      if (
        bdYear < 1900 ||
        bdYear > currentYear ||
        bdMonth < 1 ||
        bdMonth > 12 ||
        bdDay < 1 ||
        bdDay > 31
      ) {
        throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
          userMessage: "올바른 생년월일을 입력해주세요.",
        });
      }

      // Date 객체로 실제 유효 날짜인지 검증 (예: 2월 30일 방지)
      const dateObj = new Date(bdYear, bdMonth - 1, bdDay);
      if (
        dateObj.getFullYear() !== bdYear ||
        dateObj.getMonth() !== bdMonth - 1 ||
        dateObj.getDate() !== bdDay
      ) {
        throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
          userMessage: "존재하지 않는 날짜입니다.",
        });
      }

      // 만 14세 미만 가입 제한
      const today = new Date();
      let age = today.getFullYear() - bdYear;
      const monthDiff = today.getMonth() + 1 - bdMonth;
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < bdDay)) {
        age--;
      }
      if (age < MIN_SIGNUP_AGE) {
        throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
          userMessage: `만 ${MIN_SIGNUP_AGE}세 이상만 가입할 수 있습니다.`,
        });
      }

      // 전화번호 형식 검증 후 E.164 변환
      const verifiedPhone = validateString(data.verifiedPhone, "전화번호", {
        min: 1,
        max: 20,
      });

      const cleanedPhone = verifiedPhone.replace(/[-\s]/g, "");
      if (!isValidKoreanPhone(cleanedPhone)) {
        throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
          userMessage: "올바른 전화번호 형식이 아닙니다.",
        });
      }

      // mode 검증
      if (data.mode !== "signup" && data.mode !== "social") {
        throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
          userMessage: "잘못된 요청입니다.",
        });
      }

      // 성별 enum 검증
      if (data.gender !== "male" && data.gender !== "female") {
        throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
          userMessage: "성별을 선택해주세요.",
        });
      }

      // 약관 필수 동의
      if (!data.termsAgreed || !data.privacyAgreed) {
        throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
          userMessage: "필수 약관에 동의해야 합니다.",
        });
      }

      // 선택 필드 검증
      const region = validateOptionalString(data.region, "지역", { max: 50 });
      const career = validateOptionalString(data.career, "이력", { max: 500 });
      const note = validateOptionalString(data.note, "기타사항", { max: 300 });
      const email = validateOptionalString(data.email, "이메일", { max: 100 });

      // 이메일 형식 검증 (값이 있을 때만) — HTML5 표준 기반 regex
      if (email && !isValidEmail(email)) {
        throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
          userMessage: "올바른 이메일 형식이 아닙니다.",
        });
      }

      let experienceYears: number | undefined;
      if (data.experienceYears != null) {
        if (
          typeof data.experienceYears !== "number" ||
          data.experienceYears < 0 ||
          data.experienceYears > 50 ||
          !Number.isInteger(data.experienceYears)
        ) {
          throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
            userMessage: "경력은 0~50년 사이의 정수여야 합니다.",
          });
        }
        experienceYears = data.experienceYears;
      }

      // ── 2. Firebase Auth 전화번호 검증 ──────────────────────────────────

      const userRecord = await admin.auth().getUser(uid);
      const authPhone = userRecord.phoneNumber;

      if (!authPhone) {
        logger.warn("verifyAndSaveProfile: Auth에 전화번호 없음", {
          uid,
          providedPhone: maskPhone(verifiedPhone),
        });
        throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
          userMessage:
            "전화번호 인증이 완료되지 않았습니다. 다시 시도해주세요.",
        });
      }

      // ── 3. E.164 대조 ──────────────────────────────────────────────────

      const clientPhoneE164 = toE164(verifiedPhone);

      if (authPhone !== clientPhoneE164) {
        logger.warn("verifyAndSaveProfile: 전화번호 불일치", {
          uid,
          authPhone: maskPhone(authPhone),
          clientPhone: maskPhone(clientPhoneE164),
        });
        throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
          userMessage: "전화번호 인증 정보가 일치하지 않습니다.",
        });
      }

      // ── 4. role 하드코딩 (클라이언트 값 무시 → 권한 상승 방지) ────────

      const db = admin.firestore();
      const userDocRef = db.collection("users").doc(uid);

      const role = "staff" as const;

      // ── 5. Transaction (중복 검증 + 프로필 + 약관 + 이력 원자적 저장) ────
      //
      // 전화번호/닉네임 중복 검사를 Transaction 내부에서 수행하여
      // TOCTOU(Time-of-Check Time-of-Use) 레이스 컨디션을 방지합니다.
      // Admin SDK Transaction.get(query)는 반환된 문서에 pessimistic lock을 적용합니다.

      const now = admin.firestore.FieldValue.serverTimestamp();

      const profileData: Record<string, unknown> = {
        uid,
        name,
        birthDate,
        gender: data.gender,
        phone: clientPhoneE164,
        nickname,
        role,
        status: 'active' as const,
        phoneVerified: true,
        isActive: true,
        updatedAt: now,
      };

      // 선택 필드
      if (email) profileData.email = email;
      if (region) profileData.region = region;
      if (experienceYears !== undefined)
        profileData.experienceYears = experienceYears;
      if (career) profileData.career = career;
      if (note) profileData.note = note;

      // 약관 동의 (marketing 미동의도 명시적 기록)
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

      const consentRef = userDocRef.collection("consents").doc("current");
      const consentHistoryRef = userDocRef
        .collection("consents")
        .doc();

      await db.runTransaction(async (transaction) => {
        // Transaction 내 읽기 — 모든 읽기를 쓰기 전에 완료 (Firestore 규칙)
        const [freshDoc, phoneSnap, nicknameSnap] = await Promise.all([
          transaction.get(userDocRef),
          transaction.get(
            db
              .collection("users")
              .where("phone", "==", clientPhoneE164)
              .limit(1),
          ),
          transaction.get(
            db
              .collection("users")
              .where("nickname", "==", nickname)
              .limit(1),
          ),
        ]);

        // 전화번호 중복 검사
        if (!phoneSnap.empty) {
          const existingUser = phoneSnap.docs[0];
          if (existingUser.id !== uid) {
            logger.warn("verifyAndSaveProfile: 전화번호 중복", {
              uid,
              existingUid: existingUser.id,
              phone: maskPhone(clientPhoneE164),
            });
            throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
              userMessage: "이미 등록된 전화번호입니다.",
            });
          }
        }

        // 닉네임 중복 검사
        if (!nicknameSnap.empty) {
          const nicknameOwner = nicknameSnap.docs[0];
          if (nicknameOwner.id !== uid) {
            logger.warn("verifyAndSaveProfile: 닉네임 중복", {
              uid,
              existingUid: nicknameOwner.id,
              nickname,
            });
            throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
              userMessage:
                "이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해주세요.",
            });
          }
        }

        // 이미 완전한 프로필이 존재하는 경우 (중복 제출 방지)
        if (
          freshDoc.exists &&
          freshDoc.data()?.phoneVerified === true &&
          freshDoc.data()?.role === "staff"
        ) {
          logger.info("verifyAndSaveProfile: 이미 완료된 프로필 — 업데이트", {
            uid,
          });
        }

        // 신규 사용자에만 createdAt 설정 (기존 사용자의 createdAt 보존)
        if (!freshDoc.exists) {
          profileData.createdAt = now;
        }

        // 프로필 저장
        transaction.set(userDocRef, profileData, { merge: true });

        // 약관 동의 — 최신 상태 (current)
        transaction.set(consentRef, consentData, { merge: true });

        // 약관 이력 보존 (버전별 스냅샷)
        transaction.set(consentHistoryRef, {
          ...consentData,
          createdAt: now,
        });
      });

      // ── 7. Custom Claims (Transaction 외부 — eventual consistency) ──────

      try {
        await admin.auth().setCustomUserClaims(uid, { role });
      } catch (claimsError) {
        // onUserRoleChange 트리거(index.ts)가 users/{uid} 변경 감지 시
        // 자동으로 setCustomUserClaims 호출 → 백업 동기화
        logger.warn(
          "verifyAndSaveProfile: Claims 설정 실패 — onUserRoleChange 트리거로 복구 예정",
          {
            uid,
            error: claimsError,
            severity: "high",
          },
        );
      }

      // ── 8. displayName 설정 (서버사이드) ──────────────────────────────

      try {
        await admin.auth().updateUser(uid, { displayName: nickname });
      } catch (displayErr) {
        logger.warn(
          "verifyAndSaveProfile: displayName 업데이트 실패 (무시)",
          {
            uid,
            error: displayErr,
          },
        );
      }

      logger.info("verifyAndSaveProfile: 프로필 저장 완료", {
        uid,
        mode: data.mode,
        phone: maskPhone(clientPhoneE164),
      });

      return { success: true, uid };
    } catch (error) {
      throw handleFunctionError(error, {
        operation: "verifyAndSaveProfile",
        context: {
          userId: request.auth?.uid,
          mode: (request.data as VerifyAndSaveProfileData)?.mode,
        },
      });
    }
  }),
);
