/**
 * verifyAndSaveProfile Cloud Function
 *
 * @description
 * 회원가입/소셜 프로필 완성 시 서버사이드 전화번호 검증 후 Firestore 프로필 저장
 * - Firebase Auth의 phoneNumber와 클라이언트 전달 verifiedPhone을 대조
 * - 동일 전화번호로 등록된 다른 사용자 중복 검사
 * - 입력값 XSS/길이/형식 서버 검증 (클라이언트 검증 우회 방지)
 * - Batch Write로 프로필 + 약관을 원자적 저장
 * - role 하드코딩 (클라이언트 값 무시 → 권한 상승 방지)
 *
 * @version 1.1.0
 */

import { onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";
import { requireAuth } from "../errors/validators";
import { ValidationError, ERROR_CODES } from "../errors/AppError";
import { handleFunctionError } from "../errors/errorHandler";
import { toE164, maskPhone, isValidKoreanPhone } from "../utils/phone";

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

/** XSS 위험 패턴 검사 */
function hasXSSPattern(text: string): boolean {
  const patterns = [
    /<script\b/i,
    /javascript\s*:/i,
    /on\w+\s*=/i,
    /<\s*iframe/i,
    /<\s*object/i,
    /<\s*embed/i,
    /<\s*link\b/i,
    /data\s*:\s*(text|image|application|multipart)\//i,
    /expression\s*\(/i,
  ];
  return patterns.some((p) => p.test(text));
}

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
  async (request) => {
    try {
      const uid = requireAuth(request);
      const data = request.data as VerifyAndSaveProfileData;

      // ── 1. 입력 검증 (XSS + 길이 + 형식) ──────────────────────────────

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

      // 이메일 형식 검증 (값이 있을 때만)
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
          userMessage: "올바른 이메일 형식이 아닙니다.",
        });
      }

      let experienceYears: number | undefined;
      if (data.experienceYears !== undefined) {
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

      // ── 4. 전화번호 중복 검사 ──────────────────────────────────────────

      const db = admin.firestore();
      const existingSnap = await db
        .collection("users")
        .where("phone", "==", clientPhoneE164)
        .limit(1)
        .get();

      if (!existingSnap.empty) {
        const existingUser = existingSnap.docs[0];
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

      // ── 4-b. 닉네임 중복 검사 ────────────────────────────────────────

      const nicknameSnap = await db
        .collection("users")
        .where("nickname", "==", nickname)
        .limit(1)
        .get();

      if (!nicknameSnap.empty) {
        const nicknameOwner = nicknameSnap.docs[0];
        if (nicknameOwner.id !== uid) {
          logger.warn("verifyAndSaveProfile: 닉네임 중복", {
            uid,
            existingUid: nicknameOwner.id,
            nickname,
          });
          throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
            userMessage: "이미 사용 중인 닉네임입니다. 다른 닉네임을 입력해주세요.",
          });
        }
      }

      // ── 5. 기존 사용자 문서 확인 (social 모드에서 createdAt 보존) ──────

      const userDocRef = db.collection("users").doc(uid);
      const existingUserDoc = await userDocRef.get();
      const isExistingUser = existingUserDoc.exists;

      // ── 6. [C4] role 하드코딩 (클라이언트 값 무시 → 권한 상승 방지) ────

      const role = "staff" as const;

      // ── 7. Batch Write (프로필 + 약관 원자적 저장) ─────────────────────

      const now = admin.firestore.FieldValue.serverTimestamp();
      const batch = db.batch();

      const profileData: Record<string, unknown> = {
        uid,
        name,
        birthDate,
        gender: data.gender,
        phone: clientPhoneE164,
        nickname,
        role,
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

      // 신규 사용자에만 createdAt 설정 (기존 사용자의 createdAt 보존)
      if (!isExistingUser) {
        profileData.createdAt = now;
      }

      batch.set(userDocRef, profileData, { merge: true });

      // 약관 동의
      const consentRef = userDocRef.collection("consents").doc("current");
      const consentData: Record<string, unknown> = {
        version: "1.0.0",
        userId: uid,
        termsOfService: {
          agreed: true,
          version: "1.0.0",
          agreedAt: now,
        },
        privacyPolicy: {
          agreed: true,
          version: "1.0.0",
          agreedAt: now,
        },
        createdAt: now,
        updatedAt: now,
      };

      if (data.marketingAgreed) {
        consentData.marketing = {
          agreed: true,
          agreedAt: now,
        };
      }

      // 약관 동의는 최신 상태를 완전 교체 (merge 없음 — 의도적)
      // 이전 버전 동의 이력은 consents 서브컬렉션의 버전별 문서로 관리
      batch.set(consentRef, consentData);

      await batch.commit();

      // ── 8. Custom Claims (Auth API — batch 외부) ──────────────────────

      await admin.auth().setCustomUserClaims(uid, { role });

      // ── 9. displayName 설정 (서버사이드) ──────────────────────────────

      try {
        await admin.auth().updateUser(uid, { displayName: nickname });
      } catch (displayErr) {
        logger.warn("verifyAndSaveProfile: displayName 업데이트 실패 (무시)", {
          uid,
          error: displayErr,
        });
      }

      logger.info("verifyAndSaveProfile: 프로필 저장 완료", {
        uid,
        mode: data.mode,
        phone: maskPhone(clientPhoneE164),
        isExistingUser,
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
  },
);
