import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";
import {
  requireString,
} from "../errors/validators";
import {
  ValidationError,
  BusinessError,
  ERROR_CODES,
} from "../errors/AppError";
import { handleFunctionError } from "../errors/errorHandler";

const db = admin.firestore();

interface VerifyIdentityRequest {
  identityVerificationId: string;
}

interface VerifiedCustomer {
  name: string;
  birthDate: string;
  gender: "MALE" | "FEMALE";
  phoneNumber: string;
  ci: string;
  di: string;
}

interface VerifyIdentityResponse {
  success: boolean;
  data?: {
    name: string;
    phone: string;
    birthDate: string;
    gender: "male" | "female";
  };
  error?: string;
}

const PENDING_TTL_MS = 30 * 60 * 1000; // 30분
const PORTONE_API_TIMEOUT_MS = 15_000; // 15초

/**
 * 포트원 V2 본인인증 결과 조회 및 CI/DI 중복 확인
 *
 * 플로우:
 * 1. 클라이언트에서 포트원 SDK로 본인인증 완료
 * 2. identityVerificationId를 이 함수에 전달
 * 3. 포트원 REST API로 인증 결과 조회
 * 4. CI 기반 중복가입 확인
 * 5. CI/DI를 pendingVerifications에 저장 (클라이언트 미반환)
 * 6. 개인정보(이름/전화번호/생년/성별)를 클라이언트에 반환
 */
export const verifyIdentity = onCall(
  { region: "asia-northeast3" },
  async (request): Promise<VerifyIdentityResponse> => {
    try {
      // 1. 입력값 검증
      const identityVerificationId = requireString(
        (request.data as VerifyIdentityRequest).identityVerificationId,
        'identityVerificationId'
      );

      // 2. 포트원 API Secret 확인
      const apiSecret = process.env.PORTONE_API_SECRET;

      if (!apiSecret) {
        logger.error(
          "PORTONE_API_SECRET 환경변수가 설정되지 않았습니다. functions/.env 파일을 확인해주세요."
        );
        throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
          userMessage: "본인인증 서비스 설정이 필요합니다.",
          field: "PORTONE_API_SECRET",
        });
      }

      // 3. 포트원 V2 REST API로 인증 결과 조회 (타임아웃 적용)
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        PORTONE_API_TIMEOUT_MS
      );

      let response: Response;
      try {
        response = await fetch(
          `https://api.portone.io/identity-verifications/${encodeURIComponent(identityVerificationId)}`,
          {
            method: "GET",
            headers: {
              Authorization: `PortOne ${apiSecret}`,
              "Content-Type": "application/json",
            },
            signal: controller.signal,
          }
        );
      } catch (error: unknown) {
        // AbortError (타임아웃) 처리
        if (error instanceof Error && error.name === "AbortError") {
          logger.error("포트원 API 타임아웃", {
            identityVerificationId,
          });
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: "본인인증 서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.",
            metadata: { timeout: PORTONE_API_TIMEOUT_MS },
          });
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        const errorBody = await response.text();
        logger.error("포트원 API 오류", {
          status: response.status,
          body: errorBody,
        });
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: "본인인증 결과 조회에 실패했습니다.",
          metadata: { status: response.status },
        });
      }

      const result = await response.json();

      // 4. 인증 상태 확인
      if ((result as { status: string }).status !== "VERIFIED") {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: "본인인증이 완료되지 않았습니다.",
          metadata: { status: (result as { status: string }).status },
        });
      }

      const customer: VerifiedCustomer = (result as { verifiedCustomer: VerifiedCustomer }).verifiedCustomer;

      if (!customer) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: "인증된 사용자 정보를 가져올 수 없습니다.",
        });
      }

      // 5. CI 기반 중복가입 확인 (ciIndex + users 양쪽 체크)
      if (customer.ci) {
        // ciIndex에서 빠른 확인 (원자적 중복 방지 기준)
        const ciIndexDoc = await db
          .collection("ciIndex")
          .doc(customer.ci)
          .get();

        if (ciIndexDoc.exists) {
          const existingUid = ciIndexDoc.data()?.uid;
          if (existingUid && request.auth?.uid !== existingUid) {
            throw new BusinessError(ERROR_CODES.BUSINESS_ALREADY_REQUESTED, {
              userMessage: "이미 가입된 사용자입니다. 기존 계정으로 로그인해주세요.",
              metadata: { ci: customer.ci },
            });
          }
        }

        // users 컬렉션에서도 확인 (ciIndex 미등록 레거시 사용자 대환)
        const existingUser = await db
          .collection("users")
          .where("ci", "==", customer.ci)
          .limit(1)
          .get();

        if (!existingUser.empty) {
          const existingDoc = existingUser.docs[0];
          if (request.auth?.uid !== existingDoc.id) {
            throw new BusinessError(ERROR_CODES.BUSINESS_ALREADY_REQUESTED, {
              userMessage: "이미 가입된 사용자입니다. 기존 계정으로 로그인해주세요.",
              metadata: { ci: customer.ci },
            });
          }
        }
      }

      // 6. 전화번호 포맷 변환 (01012345678 → 010-1234-5678)
      const rawPhone = customer.phoneNumber || "";
      const formattedPhone = rawPhone.replace(
        /^(\d{3})(\d{4})(\d{4})$/,
        "$1-$2-$3"
      );

      // 7. 성별 변환 (MALE/FEMALE → male/female)
      const gender =
        customer.gender === "MALE" ? ("male" as const) : ("female" as const);

      // 8. 생년월일 포맷 변환 (YYYY-MM-DD → YYYYMMDD)
      const birthDate = (customer.birthDate || "").replace(/-/g, "");

      // 9. CI/DI를 pendingVerifications에 서버 전용 저장
      await db
        .collection("pendingVerifications")
        .doc(identityVerificationId)
        .set({
          name: customer.name,
          phone: formattedPhone,
          birthDate,
          gender,
          ci: customer.ci || null,
          di: customer.di || null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt: new Date(Date.now() + PENDING_TTL_MS),
        });

      logger.info("본인인증 검증 완료", {
        identityVerificationId,
        name: customer.name,
        hasCI: !!customer.ci,
        hasDI: !!customer.di,
      });

      // 10. 클라이언트에는 CI/DI 미반환
      return {
        success: true,
        data: {
          name: customer.name,
          phone: formattedPhone,
          birthDate,
          gender,
        },
      };
    } catch (error: unknown) {
      throw handleFunctionError(error, {
        operation: "verifyIdentity",
        context: {
          identityVerificationId: (request.data as VerifyIdentityRequest)?.identityVerificationId,
        },
      });
    }
  }
);
