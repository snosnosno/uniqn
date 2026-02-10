import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

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
export const verifyIdentity = functions
  .region("asia-northeast3")
  .https.onCall(
    async (
      data: VerifyIdentityRequest,
      context
    ): Promise<VerifyIdentityResponse> => {
      const { identityVerificationId } = data;

      if (!identityVerificationId) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "identityVerificationId가 필요합니다."
        );
      }

      // 포트원 API Secret (.env 파일에서 로드)
      const apiSecret = process.env.PORTONE_API_SECRET;

      if (!apiSecret) {
        functions.logger.error(
          "PORTONE_API_SECRET 환경변수가 설정되지 않았습니다. functions/.env 파일을 확인해주세요."
        );
        throw new functions.https.HttpsError(
          "internal",
          "본인인증 서비스 설정이 필요합니다."
        );
      }

      try {
        // 1. 포트원 V2 REST API로 인증 결과 조회 (타임아웃 적용)
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
        } finally {
          clearTimeout(timeout);
        }

        if (!response.ok) {
          const errorBody = await response.text();
          functions.logger.error("포트원 API 오류", {
            status: response.status,
            body: errorBody,
          });
          throw new functions.https.HttpsError(
            "internal",
            "본인인증 결과 조회에 실패했습니다."
          );
        }

        const result = await response.json();

        // 2. 인증 상태 확인
        if ((result as { status: string }).status !== "VERIFIED") {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "본인인증이 완료되지 않았습니다."
          );
        }

        const customer: VerifiedCustomer = (result as { verifiedCustomer: VerifiedCustomer }).verifiedCustomer;

        if (!customer) {
          throw new functions.https.HttpsError(
            "internal",
            "인증된 사용자 정보를 가져올 수 없습니다."
          );
        }

        // 3. CI 기반 중복가입 확인 (ciIndex + users 양쪽 체크)
        if (customer.ci) {
          // ciIndex에서 빠른 확인 (원자적 중복 방지 기준)
          const ciIndexDoc = await db
            .collection("ciIndex")
            .doc(customer.ci)
            .get();

          if (ciIndexDoc.exists) {
            const existingUid = ciIndexDoc.data()?.uid;
            if (existingUid && context.auth?.uid !== existingUid) {
              throw new functions.https.HttpsError(
                "already-exists",
                "이미 가입된 사용자입니다. 기존 계정으로 로그인해주세요."
              );
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
            if (context.auth?.uid !== existingDoc.id) {
              throw new functions.https.HttpsError(
                "already-exists",
                "이미 가입된 사용자입니다. 기존 계정으로 로그인해주세요."
              );
            }
          }
        }

        // 4. 전화번호 포맷 변환 (01012345678 → 010-1234-5678)
        const rawPhone = customer.phoneNumber || "";
        const formattedPhone = rawPhone.replace(
          /^(\d{3})(\d{4})(\d{4})$/,
          "$1-$2-$3"
        );

        // 5. 성별 변환 (MALE/FEMALE → male/female)
        const gender =
          customer.gender === "MALE" ? ("male" as const) : ("female" as const);

        // 6. 생년월일 포맷 변환 (YYYY-MM-DD → YYYYMMDD)
        const birthDate = (customer.birthDate || "").replace(/-/g, "");

        // 7. CI/DI를 pendingVerifications에 서버 전용 저장
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

        functions.logger.info("본인인증 검증 완료", {
          identityVerificationId,
          name: customer.name,
          hasCI: !!customer.ci,
          hasDI: !!customer.di,
        });

        // 8. 클라이언트에는 CI/DI 미반환
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
        // HttpsError는 그대로 전달
        if (error instanceof functions.https.HttpsError) {
          throw error;
        }

        // AbortError (타임아웃)
        if (error instanceof Error && error.name === "AbortError") {
          functions.logger.error("포트원 API 타임아웃", {
            identityVerificationId,
          });
          throw new functions.https.HttpsError(
            "deadline-exceeded",
            "본인인증 서버 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요."
          );
        }

        functions.logger.error("본인인증 검증 실패", error);
        throw new functions.https.HttpsError(
          "internal",
          "본인인증 처리 중 오류가 발생했습니다."
        );
      }
    }
  );
