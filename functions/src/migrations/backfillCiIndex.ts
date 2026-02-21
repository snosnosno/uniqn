/**
 * @file backfillCiIndex.ts
 * @description 기존 사용자의 CI를 ciIndex 컬렉션에 백필하는 일회성 마이그레이션
 *
 * 배경:
 * - linkIdentityVerification 트랜잭션에서 ciIndex/{ci} 문서를 지금부터 새로 사용
 * - 기존에 가입한 사용자는 ciIndex에 등록되지 않았으므로 백필 필요
 * - 백필 후 verifyIdentity에서 ciIndex 기반 중복가입 확인이 정상 동작
 *
 * 실행 방법:
 * 1. admin 계정으로 로그인
 * 2. dryRun: true로 먼저 실행하여 결과 확인
 * 3. dryRun: false로 실제 백필 실행
 *
 * ```typescript
 * const result = await httpsCallable(functions, 'backfillCiIndex')({
 *   dryRun: true,  // true: 로그만 / false: 실제 실행
 * });
 * ```
 */

import { onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";
import { requireAuth, requireRole } from "../errors";

const db = admin.firestore();

const BATCH_SIZE = 100;
const MAX_BATCH_OPS = 450; // Firestore 500 limit에 여유분

interface BackfillResult {
  success: boolean;
  totalScanned: number;
  totalBackfilled: number;
  totalSkipped: number;
  totalAlreadyExists: number;
  errors: Array<{ uid: string; error: string }>;
  message: string;
}

/**
 * ciIndex 백필 마이그레이션 (admin 전용 onCall)
 *
 * users 컬렉션에서 ci 필드가 있는 문서를 스캔하고
 * ciIndex/{ci} 문서가 없으면 생성
 */
export const backfillCiIndex = onCall(
  { region: "asia-northeast3", timeoutSeconds: 540 }, // 9분(최대)
  async (request): Promise<BackfillResult> => {
    const data = request.data as { dryRun?: boolean };

    // 1. admin 권한 확인
    requireAuth(request);
    requireRole(request, 'admin');

    const dryRun = data?.dryRun ?? true;

    logger.info("=== ciIndex 백필 마이그레이션 시작 ===", {
      dryRun,
      callerUid: request.auth!.uid,
    });

      let totalScanned = 0;
      let totalBackfilled = 0;
      let totalSkipped = 0;
      let totalAlreadyExists = 0;
      const errors: Array<{ uid: string; error: string }> = [];

      try {
        let lastDoc: admin.firestore.QueryDocumentSnapshot | undefined;

        while (true) {
          // CI가 있는 사용자만 조회 (페이지네이션)
          let queryRef: admin.firestore.Query = db
            .collection("users")
            .where("ci", "!=", null)
            .limit(BATCH_SIZE);

          if (lastDoc) {
            queryRef = queryRef.startAfter(lastDoc);
          }

          const snapshot = await queryRef.get();

          if (snapshot.empty) {
            break;
          }

          let batch = db.batch();
          let batchOps = 0;

          for (const userDoc of snapshot.docs) {
            totalScanned++;

            try {
              const userData = userDoc.data();
              const ci = userData.ci;

              if (!ci || typeof ci !== "string" || ci.trim() === "") {
                totalSkipped++;
                continue;
              }

              const ciIndexRef = db.collection("ciIndex").doc(ci);
              const ciIndexDoc = await ciIndexRef.get();

              if (ciIndexDoc.exists) {
                // 이미 존재 (혹시 다른 uid)
                const existingUid = ciIndexDoc.data()?.uid;
                if (existingUid !== userDoc.id) {
                  logger.warn("CI 충돌 감지", {
                    ci: ci.substring(0, 8) + "...",
                    existingUid,
                    currentUid: userDoc.id,
                  });
                  errors.push({
                    uid: userDoc.id,
                    error: `CI 충돌: 기존 uid=${existingUid}`,
                  });
                } else {
                  totalAlreadyExists++;
                }
                continue;
              }

              if (!dryRun) {
                batch.set(ciIndexRef, {
                  uid: userDoc.id,
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  migratedBy: "backfillCiIndex",
                });
                batchOps++;
                totalBackfilled++;

                // batch 크기 제한
                if (batchOps >= MAX_BATCH_OPS) {
                  await batch.commit();
                  logger.info(`배치 커밋: ${batchOps}건`);
                  batch = db.batch();
                  batchOps = 0;
                }
              } else {
                logger.info("[DRY RUN] 백필 대상", {
                  uid: userDoc.id,
                  ci: ci.substring(0, 8) + "...",
                });
                totalBackfilled++;
              }
            } catch (userError) {
              const errorMsg =
                userError instanceof Error
                  ? userError.message
                  : String(userError);
              logger.error("사용자 처리 실패", {
                uid: userDoc.id,
                error: errorMsg,
              });
              errors.push({ uid: userDoc.id, error: errorMsg });
            }
          }

          // 남은 배치 커밋
          if (!dryRun && batchOps > 0) {
            await batch.commit();
            logger.info(`최종 배치 커밋: ${batchOps}건`);
          }

          lastDoc = snapshot.docs[snapshot.docs.length - 1];

          if (snapshot.size < BATCH_SIZE) {
            break;
          }
        }

        const resultMsg = dryRun
          ? `[DRY RUN] 스캔: ${totalScanned}건, 백필 대상: ${totalBackfilled}건, 이미 존재: ${totalAlreadyExists}건, 스킵: ${totalSkipped}건`
          : `백필 완료: ${totalBackfilled}건 생성, 이미 존재: ${totalAlreadyExists}건, 스킵: ${totalSkipped}건, 에러: ${errors.length}건`;

        logger.info("=== ciIndex 백필 마이그레이션 완료 ===", {
          dryRun,
          totalScanned,
          totalBackfilled,
          totalSkipped,
          totalAlreadyExists,
          errors: errors.length,
        });

        return {
          success: true,
          totalScanned,
          totalBackfilled,
          totalSkipped,
          totalAlreadyExists,
          errors,
          message: resultMsg,
        };
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : String(error);
        logger.error("ciIndex 백필 마이그레이션 실패", { error });

        return {
          success: false,
          totalScanned,
          totalBackfilled,
          totalSkipped,
          totalAlreadyExists,
          errors: [{ uid: "migration-error", error: errorMsg }],
          message: `마이그레이션 실패: ${errorMsg}`,
        };
      }
    }
  );
