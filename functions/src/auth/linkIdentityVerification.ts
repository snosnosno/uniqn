import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

const db = admin.firestore();

interface LinkIdentityRequest {
  identityVerificationId: string;
}

interface LinkIdentityResponse {
  success: boolean;
  error?: string;
}

/**
 * 본인인증 결과를 사용자 문서에 연결 (CI/DI 서버 전용 처리)
 *
 * 플로우:
 * 1. 회원가입 완료 시 클라이언트에서 호출 (로그인 필수)
 * 2. pendingVerifications/{id}에서 CI/DI 읽기
 * 3. CI 기반 중복가입 재확인 (race condition 방지)
 * 4. users/{uid}에 ci/di 저장
 * 5. pendingVerifications/{id} 삭제
 */
export const linkIdentityVerification = functions
  .region("asia-northeast3")
  .https.onCall(
    async (
      data: LinkIdentityRequest,
      context
    ): Promise<LinkIdentityResponse> => {
      // 1. 인증 확인 (로그인 필수)
      if (!context.auth) {
        throw new functions.https.HttpsError(
          "unauthenticated",
          "로그인이 필요합니다."
        );
      }

      const uid = context.auth.uid;
      const { identityVerificationId } = data;

      if (!identityVerificationId) {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "identityVerificationId가 필요합니다."
        );
      }

      try {
        // 2. pendingVerifications 문서 읽기 (트랜잭션 밖)
        const pendingRef = db
          .collection("pendingVerifications")
          .doc(identityVerificationId);
        const pendingDoc = await pendingRef.get();

        if (!pendingDoc.exists) {
          throw new functions.https.HttpsError(
            "not-found",
            "본인인증 정보가 만료되었거나 존재하지 않습니다. 다시 인증해주세요."
          );
        }

        const pendingData = pendingDoc.data()!;

        // 3. TTL 만료 확인
        const expiresAt = pendingData.expiresAt?.toDate?.()
          ?? new Date(pendingData.expiresAt);
        if (expiresAt.getTime() < Date.now()) {
          // 만료된 문서 삭제
          await pendingRef.delete();
          throw new functions.https.HttpsError(
            "not-found",
            "본인인증 정보가 만료되었습니다. 다시 인증해주세요."
          );
        }

        const ci = pendingData.ci || null;
        const di = pendingData.di || null;

        // 4. 트랜잭션으로 CI 중복 확인 + 사용자 업데이트 처리
        // ciIndex/{ci} 문서를 사용하여 동시 가입 방지
        const userRef = db.collection("users").doc(uid);

        await db.runTransaction(async (transaction) => {
          // 4-1. CI 기반 중복가입 사용자 확인
          if (ci) {
            const ciIndexRef = db.collection("ciIndex").doc(ci);
            const ciIndexDoc = await transaction.get(ciIndexRef);

            if (ciIndexDoc.exists) {
              const existingUid = ciIndexDoc.data()?.uid;
              if (existingUid && existingUid !== uid) {
                throw new functions.https.HttpsError(
                  "already-exists",
                  "이미 가입된 사용자입니다. 기존 계정으로 로그인해주세요."
                );
              }
            }

            // CI 인덱스에 등록 (트랜잭션 내 원자적)
            transaction.set(ciIndexRef, {
              uid,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }

          // 4-2. users/{uid}에 ci/di 저장
          transaction.update(userRef, {
            ci,
            di,
            identityVerified: true,
            identityVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // 4-3. pendingVerifications 삭제
          transaction.delete(pendingRef);
        });

        functions.logger.info("본인인증 연결 완료", {
          uid,
          identityVerificationId,
          hasCI: !!ci,
          hasDI: !!di,
        });

        return { success: true };
      } catch (error: unknown) {
        if (error instanceof functions.https.HttpsError) {
          throw error;
        }

        functions.logger.error("본인인증 연결 실패", {
          uid,
          identityVerificationId,
          error,
        });
        throw new functions.https.HttpsError(
          "internal",
          "본인인증 연결 중 오류가 발생했습니다."
        );
      }
    }
  );
