/**
 * UNIQN Functions - 서버사이드 OTP 검증
 *
 * @description Firebase Auth REST API를 사용한 서버사이드 전화번호 OTP 검증.
 *              클라이언트의 linkWithCredential 의존성을 제거하고,
 *              서버에서 직접 OTP 검증 후 admin.auth().updateUser로 phoneNumber를 설정.
 *
 * 우체국 등기 배달과 비슷합니다 — 수취인(서버)이 직접 본인확인 코드를 검증하여
 * 중간에 누가 바꿔치기할 수 없도록 합니다.
 *
 * @version 1.0.0
 */

import { logger } from "firebase-functions";
import { ValidationError, ERROR_CODES } from "../errors/AppError";

// ============================================================================
// Types
// ============================================================================

export interface VerifyOTPResult {
  /** 검증된 전화번호 (E.164 형식) */
  phoneNumber: string;
}

interface FirebaseAuthErrorResponse {
  error: {
    code: number;
    message: string;
  };
}

// ============================================================================
// Constants
// ============================================================================

const FIREBASE_AUTH_BASE_URL = "https://identitytoolkit.googleapis.com/v1";

/** Firebase Auth REST API 에러 코드 → 사용자 메시지 매핑 */
const OTP_ERROR_MESSAGES: Record<string, string> = {
  INVALID_CODE: "인증번호가 올바르지 않습니다. 다시 확인해주세요.",
  SESSION_EXPIRED: "인증 세션이 만료되었습니다. 인증번호를 다시 요청해주세요.",
  INVALID_SESSION_INFO:
    "인증 세션이 유효하지 않습니다. 인증번호를 다시 요청해주세요.",
  CODE_EXPIRED: "인증번호가 만료되었습니다. 인증번호를 다시 요청해주세요.",
  TOO_MANY_ATTEMPTS_TRY_LATER:
    "너무 많은 시도입니다. 잠시 후 다시 시도해주세요.",
};

// ============================================================================
// Main Function
// ============================================================================

/**
 * Firebase Auth REST API를 통한 서버사이드 OTP 검증
 *
 * @param verificationId - 클라이언트의 verifyPhoneNumber이 반환한 sessionInfo
 * @param otpCode - 사용자가 입력한 6자리 인증번호
 * @param apiKey - Firebase 프로젝트 Web API Key
 * @returns 검증된 전화번호 (E.164 형식)
 * @throws ValidationError 검증 실패 시
 */
export async function verifyOTPServerSide(
  verificationId: string,
  otpCode: string,
  apiKey: string,
): Promise<VerifyOTPResult> {
  const url = `${FIREBASE_AUTH_BASE_URL}/accounts:signInWithPhoneNumber?key=${apiKey}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionInfo: verificationId,
        code: otpCode,
      }),
    });
  } catch (networkError) {
    logger.error("서버사이드 OTP 검증: 네트워크 에러", {
      component: "phoneVerification",
      error:
        networkError instanceof Error
          ? networkError.message
          : String(networkError),
    });
    throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
      userMessage:
        "전화번호 인증 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.",
      isRetryable: true,
    });
  }

  if (!response.ok) {
    const errorBody = (await response
      .json()
      .catch(() => null)) as FirebaseAuthErrorResponse | null;
    const errorMessage = errorBody?.error?.message ?? "UNKNOWN";

    logger.warn("서버사이드 OTP 검증 실패", {
      component: "phoneVerification",
      errorCode: errorMessage,
      httpStatus: response.status,
    });

    const userMessage =
      OTP_ERROR_MESSAGES[errorMessage] ??
      "전화번호 인증에 실패했습니다. 다시 시도해주세요.";

    throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
      userMessage,
    });
  }

  const result = (await response.json()) as { phoneNumber?: string };

  if (!result.phoneNumber) {
    logger.error("서버사이드 OTP 검증: 응답에 phoneNumber 없음", {
      component: "phoneVerification",
    });
    throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
      userMessage:
        "전화번호 인증 정보를 확인할 수 없습니다. 다시 시도해주세요.",
    });
  }

  logger.info("서버사이드 OTP 검증 성공", {
    component: "phoneVerification",
    phone: `${result.phoneNumber.slice(0, 4)}****`,
  });

  return { phoneNumber: result.phoneNumber };
}
