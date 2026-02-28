/**
 * UNIQN Functions - 공용 reCAPTCHA v3 검증 유틸리티
 *
 * checkPhoneExists, checkEmailExists, checkNicknameExists 등
 * 인증 없이 호출 가능한 Cloud Functions에서 공통으로 사용.
 *
 * 서킷 브레이커 내장: Google reCAPTCHA API 연속 장애 시 fail-closed 전환.
 *
 * @version 1.0.0
 */

import { logger } from "firebase-functions";

// ============================================================================
// Circuit Breaker State (모듈 레벨, 콜드 스타트 시 리셋)
// ============================================================================

let failureCount = 0;
let lastFailureTime = 0;
const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_WINDOW_MS = 5 * 60 * 1000; // 5분

// ============================================================================
// reCAPTCHA Verification
// ============================================================================

const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;

/**
 * reCAPTCHA v3 토큰 검증
 *
 * @param token - 클라이언트에서 전달한 reCAPTCHA 토큰
 * @returns 유효 여부
 *
 * 동작 규칙:
 * - 에뮬레이터: SECRET_KEY 없어도 통과
 * - 프로덕션 SECRET_KEY 미설정: 차단 (false)
 * - API 호출 실패: 임계값 미만이면 통과 (가용성 우선), 3회 연속 시 차단 (서킷 브레이커)
 */
export async function verifyRecaptchaToken(token: string): Promise<boolean> {
  if (!RECAPTCHA_SECRET_KEY) {
    const isEmulator = process.env.FUNCTIONS_EMULATOR === "true";
    if (!isEmulator) {
      logger.error(
        "RECAPTCHA_SECRET_KEY 미설정 — 프로덕션 환경에서 봇 보호 불가",
        {
          severity: "critical",
          metric: "captcha_secret_missing",
        },
      );
      return false;
    }
    logger.debug("RECAPTCHA_SECRET_KEY 미설정 - 개발 환경 검증 스킵");
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

    // 성공 시 서킷 브레이커 리셋
    failureCount = 0;
    return true;
  } catch (err) {
    // 서킷 브레이커: 5분 내 3회 연속 실패 시 fail-closed
    const now = Date.now();
    if (now - lastFailureTime > CIRCUIT_WINDOW_MS) {
      failureCount = 0;
    }
    failureCount++;
    lastFailureTime = now;

    if (failureCount >= CIRCUIT_THRESHOLD) {
      logger.error("reCAPTCHA 서킷 브레이커 OPEN — 모든 요청 차단", {
        failureCount,
        error: err,
        severity: "critical",
        metric: "captcha_circuit_open",
      });
      return false; // fail-closed
    }

    logger.error("reCAPTCHA API 호출 실패 — 가용성 우선 통과", {
      failureCount,
      threshold: CIRCUIT_THRESHOLD,
      error: err,
      severity: "critical",
      metric: "captcha_api_failure",
    });
    return true; // 임계값 미만: 가용성 우선
  }
}
