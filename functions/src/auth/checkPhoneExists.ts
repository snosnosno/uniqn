/**
 * 전화번호 중복 확인 Cloud Function
 *
 * @description
 * 회원가입 Step 2에서 SMS 인증 발송 전 전화번호 중복을 확인합니다.
 * 인증 없이 호출 가능 (회원가입 전이므로).
 * Firebase Auth + Firestore 양쪽 모두 확인하여 정합성을 보장합니다.
 * Auth에 phone-only 고아 계정이 있으면 즉시 삭제하여 재가입을 허용합니다.
 *
 * @version 1.2.0
 *
 * // TODO [P1]: Firebase App Check 적용 (네이티브 봇 보호)
 */

import { onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";
import { ValidationError, ERROR_CODES } from "../errors/AppError";
import { handleFunctionError } from "../errors/errorHandler";
import { checkIpRateLimit } from "../middleware/rateLimiter";
import { isValidKoreanPhone, toE164, maskPhone } from "../utils/phone";

const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;

/**
 * reCAPTCHA v3 토큰 검증
 *
 * @returns 유효 여부 (SECRET_KEY 미설정 시 true 반환)
 */
async function verifyRecaptchaToken(token: string): Promise<boolean> {
  if (!RECAPTCHA_SECRET_KEY) {
    logger.debug("RECAPTCHA_SECRET_KEY 미설정 - 검증 스킵");
    return true;
  }

  try {
    const response = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `secret=${encodeURIComponent(RECAPTCHA_SECRET_KEY)}&response=${encodeURIComponent(token)}`,
      },
    );
    const data = (await response.json()) as {
      success: boolean;
      score?: number;
    };

    if (!data.success || (data.score !== undefined && data.score < 0.3)) {
      logger.warn("reCAPTCHA 검증 실패", {
        success: data.success,
        score: data.score,
      });
      return false;
    }
    return true;
  } catch (err) {
    // [M5] reCAPTCHA API 장애 시 경고 로깅 강화 (모니터링 알림 대상)
    logger.error("reCAPTCHA API 호출 실패 — 봇 보호 우회 상태", {
      error: err,
      severity: "critical",
      metric: "captcha_api_failure",
    });
    return true; // API 장애 시 통과 (가용성 우선)
  }
}

/**
 * 전화번호 중복 확인
 *
 * - Firebase Auth에서 해당 전화번호로 등록된 계정 존재 여부 확인
 * - Firestore users 컬렉션에서 phone 필드 조회
 * - 인증 불필요 (회원가입 전 호출)
 * - IP 기반 Rate Limiting + reCAPTCHA v3 (웹) 적용
 */
export const checkPhoneExists = onCall(
  { region: "asia-northeast3", cors: true },
  async (request) => {
    try {
      // 1. [H4] IP 기반 Rate Limiting (인증 사용자는 완화)
      const clientIp = request.rawRequest?.ip || "unknown";
      const isAuthenticated = !!request.auth;
      const rateLimitResult = await checkIpRateLimit(clientIp, {
        windowMs: 60 * 1000, // 1분
        maxRequests: isAuthenticated ? 20 : 5, // 인증: 20회, 비인증: 5회
        keyPrefix: "ratelimit:check-phone",
      });

      if (!rateLimitResult.allowed) {
        throw new ValidationError(ERROR_CODES.AUTH_RATE_LIMITED, {
          userMessage: "너무 많은 요청입니다. 잠시 후 다시 시도해주세요.",
        });
      }

      // 2. reCAPTCHA v3 검증 (웹 요청만, 네이티브는 스킵)
      const platform = request.data?.platform as string | undefined;
      const recaptchaToken = request.data?.recaptchaToken as string | undefined;

      if (platform === "web" || (!platform && recaptchaToken)) {
        if (!recaptchaToken) {
          throw new ValidationError(ERROR_CODES.AUTH_CAPTCHA_FAILED, {
            userMessage:
              "보안 검증에 실패했습니다. 페이지를 새로고침하고 다시 시도해주세요.",
          });
        }
        const isValid = await verifyRecaptchaToken(recaptchaToken);
        if (!isValid) {
          throw new ValidationError(ERROR_CODES.AUTH_CAPTCHA_FAILED, {
            userMessage: "보안 검증에 실패했습니다. 다시 시도해주세요.",
          });
        }
      }

      // 3. 전화번호 파라미터 검증
      const rawPhone = request.data?.phone;
      if (
        !rawPhone ||
        typeof rawPhone !== "string" ||
        rawPhone.trim().length === 0
      ) {
        throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
          userMessage: "전화번호를 입력해주세요.",
          field: "phone",
        });
      }

      // 4. 전화번호 정규화 + 형식 검증
      const cleaned = rawPhone.replace(/[-\s]/g, "");

      if (!isValidKoreanPhone(cleaned)) {
        throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
          userMessage: "올바른 전화번호 형식이 아닙니다.",
          field: "phone",
        });
      }

      const e164Phone = toE164(cleaned);

      // 5. Firebase Auth에서 확인 + 고아 계정 즉시 정리
      let existsInAuth = false;
      try {
        const authUser = await admin.auth().getUserByPhoneNumber(e164Phone);

        // 고아 계정 감지: Auth에 존재하지만 Firestore users 문서가 없는 phone-only 계정
        // (가입 중단/크래시로 생성된 계정 → 즉시 삭제하여 재가입 허용)
        if (!authUser.email) {
          const userDoc = await admin
            .firestore()
            .collection("users")
            .doc(authUser.uid)
            .get();
          if (!userDoc.exists) {
            logger.info("고아 phone-only 계정 감지 → 즉시 삭제", {
              uid: authUser.uid,
              phone: maskPhone(e164Phone),
            });
            try {
              await admin.auth().deleteUser(authUser.uid);
              // orphanAccounts 마킹 문서도 함께 정리
              try {
                await admin
                  .firestore()
                  .collection("orphanAccounts")
                  .doc(authUser.uid)
                  .delete();
              } catch {
                // orphanAccounts 문서 미존재 시 무시
              }
              existsInAuth = false;
            } catch (deleteErr) {
              // [S3] 고아 계정 삭제 실패 시 전체 함수가 실패하지 않도록 안전 처리
              logger.warn("고아 계정 삭제 실패 - 존재하는 것으로 처리", {
                uid: authUser.uid,
                error: deleteErr,
              });
              existsInAuth = true;
            }
          } else {
            existsInAuth = true;
          }
        } else {
          existsInAuth = true;
        }
      } catch (authError: unknown) {
        if (
          authError &&
          typeof authError === "object" &&
          "code" in authError &&
          (authError as { code: string }).code === "auth/user-not-found"
        ) {
          existsInAuth = false;
        } else {
          throw authError;
        }
      }

      // 6. Firestore에서도 확인 (Auth에 없지만 Firestore에만 있는 경우 대비)
      let existsInFirestore = false;
      if (!existsInAuth) {
        const snapshot = await admin
          .firestore()
          .collection("users")
          .where("phone", "==", e164Phone)
          .limit(1)
          .get();

        existsInFirestore = !snapshot.empty;
      }

      const exists = existsInAuth || existsInFirestore;

      logger.info("전화번호 중복 확인 완료", {
        phone: maskPhone(e164Phone),
        exists,
        source: existsInAuth
          ? "auth"
          : existsInFirestore
            ? "firestore"
            : "none",
      });

      return { exists };
    } catch (error) {
      throw handleFunctionError(error, {
        operation: "checkPhoneExists",
        context: {
          phone:
            typeof request.data?.phone === "string"
              ? maskPhone(request.data.phone)
              : undefined,
        },
      });
    }
  },
);
