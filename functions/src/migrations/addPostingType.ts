/**
 * @file addPostingType.ts
 * @description 레거시 공고에 postingType 필드 추가 배치 마이그레이션 스크립트
 *
 * 실행 방법:
 * - Firebase Admin SDK 권한 필요
 * - 개발 환경에서만 실행 권장
 * - Production 실행은 선택적
 *
 * 마이그레이션 규칙:
 * 1. type='application' → postingType='regular'
 * 2. type='fixed' → postingType='fixed'
 * 3. recruitmentType='application' → postingType='regular'
 * 4. recruitmentType='fixed' → postingType='fixed'
 * 5. 필드 없음 → postingType='regular' (기본값)
 */

import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';

// PostingType 정의
type PostingType = 'regular' | 'fixed' | 'tournament' | 'urgent';
type LegacyType = 'application' | 'fixed';

/**
 * 레거시 타입을 새 postingType으로 변환
 */
function convertLegacyType(
  type?: LegacyType,
  recruitmentType?: LegacyType
): PostingType {
  const legacyType = type || recruitmentType;

  if (legacyType === 'application') {
    return 'regular';
  }

  if (legacyType === 'fixed') {
    return 'fixed';
  }

  // 기본값
  return 'regular';
}

/**
 * 배치 마이그레이션 메인 함수
 *
 * @param dryRun - true면 실제 업데이트 없이 로그만 출력
 * @param batchSize - 한 번에 처리할 문서 수 (default: 500)
 */
export async function migratePostingTypes(
  dryRun: boolean = true,
  batchSize: number = 500
): Promise<{
  success: boolean;
  totalProcessed: number;
  totalUpdated: number;
  errors: Array<{ id: string; error: string }>;
}> {
  logger.info('=== postingType 마이그레이션 시작 ===', {
    dryRun,
    batchSize,
    timestamp: new Date().toISOString()
  });

  const db = admin.firestore();
  const jobPostingsRef = db.collection('jobPostings');

  let totalProcessed = 0;
  let totalUpdated = 0;
  const errors: Array<{ id: string; error: string }> = [];

  try {
    // postingType 필드가 없는 문서만 조회
    const snapshot = await jobPostingsRef
      .where('postingType', '==', null)
      .limit(batchSize)
      .get();

    if (snapshot.empty) {
      logger.info('마이그레이션할 문서가 없습니다');
      return {
        success: true,
        totalProcessed: 0,
        totalUpdated: 0,
        errors: []
      };
    }

    logger.info(`${snapshot.size}개 문서 발견`);

    // 배치 쓰기 준비
    const batch = db.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
      totalProcessed++;
      const data = doc.data();

      try {
        // postingType 변환
        const postingType = convertLegacyType(
          data.type as LegacyType | undefined,
          data.recruitmentType as LegacyType | undefined
        );

        logger.info(`문서 ${doc.id} 변환`, {
          id: doc.id,
          oldType: data.type,
          oldRecruitmentType: data.recruitmentType,
          newPostingType: postingType
        });

        if (!dryRun) {
          // 실제 업데이트
          batch.update(doc.ref, {
            postingType,
            migratedAt: admin.firestore.FieldValue.serverTimestamp(),
            migratedBy: 'addPostingType-migration'
          });
          batchCount++;
          totalUpdated++;

          // 배치 크기 도달 시 커밋
          if (batchCount >= 500) {
            await batch.commit();
            logger.info(`배치 커밋 완료: ${batchCount}개 문서`);
            batchCount = 0;
          }
        } else {
          logger.info('[DRY RUN] 업데이트 예정', {
            id: doc.id,
            postingType
          });
          totalUpdated++;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`문서 ${doc.id} 처리 실패`, error);
        errors.push({
          id: doc.id,
          error: errorMessage
        });
      }
    }

    // 남은 배치 커밋
    if (!dryRun && batchCount > 0) {
      await batch.commit();
      logger.info(`최종 배치 커밋 완료: ${batchCount}개 문서`);
    }

    logger.info('=== 마이그레이션 완료 ===', {
      totalProcessed,
      totalUpdated,
      errors: errors.length,
      dryRun
    });

    return {
      success: true,
      totalProcessed,
      totalUpdated,
      errors
    };
  } catch (error) {
    logger.error('마이그레이션 실패', error);
    return {
      success: false,
      totalProcessed,
      totalUpdated,
      errors: [{
        id: 'migration-error',
        error: error instanceof Error ? error.message : String(error)
      }]
    };
  }
}

/**
 * HTTP Callable Function (admin 전용)
 *
 * 사용 예시:
 * ```typescript
 * const result = await httpsCallable(functions, 'migratePostingTypes')({
 *   dryRun: true,
 *   batchSize: 100
 * });
 * ```
 */
export const migratePostingTypesCallable = async (
  data: {
    dryRun?: boolean;
    batchSize?: number;
  },
  context: admin.auth.DecodedIdToken
): Promise<{
  success: boolean;
  totalProcessed: number;
  totalUpdated: number;
  errors: Array<{ id: string; error: string }>;
  message: string;
}> => {
  // Admin 권한 체크
  if (!context.uid) {
    throw new Error('인증되지 않은 요청입니다');
  }

  // admin 권한 확인 (custom claim)
  const userDoc = await admin.firestore()
    .collection('users')
    .doc(context.uid)
    .get();

  const userData = userDoc.data();
  if (!userData || userData.role !== 'admin') {
    throw new Error('관리자 권한이 필요합니다');
  }

  logger.info('마이그레이션 요청', {
    userId: context.uid,
    dryRun: data.dryRun ?? true,
    batchSize: data.batchSize ?? 500
  });

  const result = await migratePostingTypes(
    data.dryRun ?? true,
    data.batchSize ?? 500
  );

  return {
    ...result,
    message: result.success
      ? `마이그레이션 완료: ${result.totalUpdated}개 업데이트`
      : '마이그레이션 실패'
  };
};

/**
 * 단일 문서 마이그레이션 함수
 *
 * @param jobPostingId - 공고 ID
 * @returns 업데이트 성공 여부
 */
export async function migrateSinglePosting(
  jobPostingId: string
): Promise<boolean> {
  try {
    const db = admin.firestore();
    const docRef = db.collection('jobPostings').doc(jobPostingId);
    const doc = await docRef.get();

    if (!doc.exists) {
      logger.warn(`문서 ${jobPostingId} 존재하지 않음`);
      return false;
    }

    const data = doc.data()!;

    // 이미 postingType이 있으면 스킵
    if (data.postingType) {
      logger.info(`문서 ${jobPostingId} 이미 마이그레이션됨`);
      return true;
    }

    // postingType 변환
    const postingType = convertLegacyType(
      data.type as LegacyType | undefined,
      data.recruitmentType as LegacyType | undefined
    );

    // 업데이트
    await docRef.update({
      postingType,
      migratedAt: admin.firestore.FieldValue.serverTimestamp(),
      migratedBy: 'single-migration'
    });

    logger.info(`문서 ${jobPostingId} 마이그레이션 완료`, {
      postingType
    });

    return true;
  } catch (error) {
    logger.error(`문서 ${jobPostingId} 마이그레이션 실패`, error);
    return false;
  }
}
