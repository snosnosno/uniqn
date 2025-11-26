import { doc, collection, getDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import {
  createStaffFromApplicant,
  batchConvertApplicants,
  validateConversion,
  checkDuplicateStaff,
  prepareRollbackData,
  ApplicantData,
  StaffCreationResult,
} from '../utils/applicantToStaffConverter';
import { logger } from '../utils/logger';
import { extractErrorMessage, toError } from '../utils/errorHandler';

/**
 * 지원자를 스태프로 변환하고 Firebase에 저장하는 서비스
 */
export class ApplicantConversionService {
  private static instance: ApplicantConversionService;

  private constructor() {}

  static getInstance(): ApplicantConversionService {
    if (!ApplicantConversionService.instance) {
      ApplicantConversionService.instance = new ApplicantConversionService();
    }
    return ApplicantConversionService.instance;
  }

  /**
   * 단일 지원자를 스태프로 변환하고 저장
   */
  async convertAndSaveApplicant(
    applicant: ApplicantData,
    eventId: string,
    managerId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 1. 중복 검사
      const staffDoc = await getDoc(doc(db, 'staff', applicant.applicantId));
      if (staffDoc.exists()) {
        logger.warn('이미 존재하는 스태프', {
          component: 'ApplicantConversionService',
          data: { staffId: applicant.applicantId },
        });
        return {
          success: false,
          error: '이미 스태프로 등록된 사용자입니다.',
        };
      }

      // 2. 변환 데이터 생성
      const result = await createStaffFromApplicant(applicant, eventId, managerId);
      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Unknown error',
        };
      }

      // 3. Firebase에 저장
      const batch = writeBatch(db);

      // 스태프 문서 저장
      batch.set(doc(db, 'staff', result.staffId), result.staffData);

      // WorkLog 문서 저장 (있는 경우)
      if (result.workLogId && result.workLogData) {
        batch.set(doc(db, 'workLogs', result.workLogId), result.workLogData);
      }

      await batch.commit();

      logger.info('스태프 변환 및 저장 성공', {
        component: 'ApplicantConversionService',
        data: {
          staffId: result.staffId,
          hasWorkLog: !!result.workLogId,
        },
      });

      return { success: true };
    } catch (error) {
      logger.error('스태프 변환 및 저장 실패', toError(error), {
        component: 'ApplicantConversionService',
        data: { applicant, eventId },
      });

      return {
        success: false,
        error: extractErrorMessage(error),
      };
    }
  }

  /**
   * 다중 지원자를 일괄 변환하고 저장
   */
  async batchConvertAndSaveApplicants(
    applicants: ApplicantData[],
    eventId: string,
    managerId: string,
    onProgress?: (current: number, total: number, status: string) => void
  ): Promise<{
    success: boolean;
    successCount: number;
    failureCount: number;
    errors: string[];
  }> {
    try {
      // 1. 기존 스태프 목록 조회 (중복 검사용)
      const staffSnapshot = await getDocs(collection(db, 'staff'));
      const existingStaffIds = staffSnapshot.docs.map((doc) => doc.id);

      // 2. 중복 제거
      const uniqueApplicants = applicants.filter(
        (applicant) => !checkDuplicateStaff(applicant.applicantId, existingStaffIds)
      );

      if (uniqueApplicants.length === 0) {
        return {
          success: false,
          successCount: 0,
          failureCount: applicants.length,
          errors: ['모든 지원자가 이미 스태프로 등록되어 있습니다.'],
        };
      }

      // 3. 일괄 변환
      const results = await batchConvertApplicants(
        uniqueApplicants,
        eventId,
        managerId,
        (current, total) => {
          if (onProgress) {
            onProgress(current, total, '변환 중...');
          }
        }
      );

      // 4. 검증
      const validation = validateConversion(results);
      if (!validation.valid) {
        logger.warn('변환 검증 실패', {
          component: 'ApplicantConversionService',
          data: { errors: validation.errors },
        });
      }

      // 5. Firebase에 일괄 저장
      const BATCH_SIZE = 500; // Firestore batch 제한
      let batchIndex = 0;
      let currentBatch = writeBatch(db);
      let operationCount = 0;

      for (const result of results) {
        if (!result.success) continue;

        // 스태프 문서 추가
        currentBatch.set(doc(db, 'staff', result.staffId), result.staffData);
        operationCount++;

        // WorkLog 문서 추가 (있는 경우)
        if (result.workLogId && result.workLogData) {
          currentBatch.set(doc(db, 'workLogs', result.workLogId), result.workLogData);
          operationCount++;
        }

        // 배치 크기 제한 처리
        if (operationCount >= BATCH_SIZE - 10) {
          await currentBatch.commit();
          batchIndex++;
          currentBatch = writeBatch(db);
          operationCount = 0;

          if (onProgress) {
            onProgress(batchIndex * BATCH_SIZE, results.length, '저장 중...');
          }
        }
      }

      // 마지막 배치 커밋
      if (operationCount > 0) {
        await currentBatch.commit();
      }

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      logger.info('일괄 변환 및 저장 완료', {
        component: 'ApplicantConversionService',
        data: {
          total: applicants.length,
          converted: uniqueApplicants.length,
          successCount,
          failureCount,
        },
      });

      return {
        success: successCount > 0,
        successCount,
        failureCount,
        errors: validation.errors,
      };
    } catch (error) {
      logger.error('일괄 변환 및 저장 실패', toError(error), {
        component: 'ApplicantConversionService',
      });

      return {
        success: false,
        successCount: 0,
        failureCount: applicants.length,
        errors: [extractErrorMessage(error)],
      };
    }
  }

  /**
   * 변환 롤백 (실패 시 복구)
   */
  async rollbackConversion(
    results: StaffCreationResult[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const rollbackData = prepareRollbackData(results);
      const batch = writeBatch(db);

      // 스태프 문서 삭제
      for (const staffId of rollbackData.staffIds) {
        batch.delete(doc(db, 'staff', staffId));
      }

      // WorkLog 문서 삭제
      for (const workLogId of rollbackData.workLogIds) {
        batch.delete(doc(db, 'workLogs', workLogId));
      }

      await batch.commit();

      logger.info('변환 롤백 완료', {
        component: 'ApplicantConversionService',
        data: {
          staffCount: rollbackData.staffIds.length,
          workLogCount: rollbackData.workLogIds.length,
        },
      });

      return { success: true };
    } catch (error) {
      logger.error('변환 롤백 실패', toError(error), {
        component: 'ApplicantConversionService',
      });

      return {
        success: false,
        error: extractErrorMessage(error),
      };
    }
  }

  /**
   * 특정 이벤트의 지원자를 모두 스태프로 변환
   */
  async convertEventApplicants(
    eventId: string,
    managerId: string,
    onProgress?: (message: string) => void
  ): Promise<{
    success: boolean;
    convertedCount: number;
    error?: string;
  }> {
    try {
      if (onProgress) {
        onProgress('지원자 목록을 조회하는 중...');
      }

      // 1. 해당 이벤트의 모든 확정된 지원자 조회
      const applicationsSnapshot = await getDocs(
        query(
          collection(db, 'applications'),
          where('eventId', '==', eventId),
          where('status', '==', 'confirmed')
        )
      );

      if (applicationsSnapshot.empty) {
        return {
          success: false,
          convertedCount: 0,
          error: '확정된 지원자가 없습니다.',
        };
      }

      // 2. 지원자 데이터 준비
      const applicants: ApplicantData[] = applicationsSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          applicantId: data.applicantId,
          applicantName: data.applicantName,
          email: data.email,
          phone: data.phone,
          role: data.role,
          timeSlot: data.timeSlot,
          date: data.date,
        };
      });

      if (onProgress) {
        onProgress(`${applicants.length}명의 지원자를 변환하는 중...`);
      }

      // 3. 일괄 변환 및 저장
      const result = await this.batchConvertAndSaveApplicants(
        applicants,
        eventId,
        managerId,
        (current, total, status) => {
          if (onProgress) {
            onProgress(`${status} (${current}/${total})`);
          }
        }
      );

      if (onProgress) {
        onProgress(`변환 완료: ${result.successCount}명 성공, ${result.failureCount}명 실패`);
      }

      return {
        success: result.success,
        convertedCount: result.successCount,
        error: result.errors.join(', '),
      };
    } catch (error) {
      logger.error('이벤트 지원자 변환 실패', toError(error), {
        component: 'ApplicantConversionService',
        data: { eventId },
      });

      return {
        success: false,
        convertedCount: 0,
        error: extractErrorMessage(error),
      };
    }
  }
}

// 싱글톤 인스턴스 export
export const applicantConversionService = ApplicantConversionService.getInstance();
