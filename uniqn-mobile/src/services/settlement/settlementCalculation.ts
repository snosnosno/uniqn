/**
 * UNIQN Mobile - 정산 계산 서비스
 *
 * @description 정산 금액 계산 로직
 * @version 1.0.0
 */

import { doc, getDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { BusinessError, PermissionError, ValidationError, ERROR_CODES } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { SettlementCalculator } from '@/domains/settlement';
import {
  getEffectiveSalaryInfoFromRoles,
  getEffectiveAllowances,
  getEffectiveTaxSettings,
} from '@/utils/settlement';
import { parseWorkLogDocument, parseJobPostingDocument } from '@/schemas';
import { IdNormalizer } from '@/shared/id';
import type { WorkLog } from '@/types';
import { COLLECTIONS } from '@/constants';
import type {
  WorkLogWithOverrides,
  CalculateSettlementInput,
  SettlementCalculation,
} from './types';

// ============================================================================
// Calculation Functions
// ============================================================================

/**
 * 정산 금액 계산
 *
 * @description 급여 타입별 정산 금액 계산
 * - 시급: 근무시간 × 시급
 * - 일급: 일급 전액 (출근 시)
 * - 월급: 월급 ÷ 22일 (일할 계산)
 */
export async function calculateSettlement(
  input: CalculateSettlementInput,
  ownerId: string
): Promise<SettlementCalculation> {
  try {
    logger.info('정산 금액 계산', { workLogId: input.workLogId, ownerId });

    // 1. 근무 기록 조회
    const workLogRef = doc(getFirebaseDb(), COLLECTIONS.WORK_LOGS, input.workLogId);
    const workLogDoc = await getDoc(workLogRef);

    if (!workLogDoc.exists()) {
      throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
        userMessage: '근무 기록을 찾을 수 없습니다',
      });
    }

    const parsedWorkLog = parseWorkLogDocument({ id: workLogDoc.id, ...workLogDoc.data() });
    if (!parsedWorkLog) {
      throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
        userMessage: '근무 기록 데이터를 파싱할 수 없습니다',
      });
    }
    const workLog = parsedWorkLog as WorkLog & { customRole?: string };

    // 2. 공고 조회 및 소유권 확인 (IdNormalizer로 ID 정규화)
    const normalizedJobId = IdNormalizer.normalizeJobId(workLog);
    const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, normalizedJobId);
    const jobDoc = await getDoc(jobRef);

    if (!jobDoc.exists()) {
      throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
        userMessage: '공고를 찾을 수 없습니다',
      });
    }

    const jobPosting = parseJobPostingDocument({ id: jobDoc.id, ...jobDoc.data() });
    if (!jobPosting) {
      throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
        userMessage: '공고 데이터를 파싱할 수 없습니다',
      });
    }

    if (jobPosting.ownerId !== ownerId) {
      throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
        userMessage: '본인의 공고에 대한 정산만 계산할 수 있습니다',
      });
    }

    // 3. 급여/수당/세금 정보 조회 (개별 오버라이드 우선)
    const workLogWithOverrides = workLog as WorkLogWithOverrides;
    const salaryInfo = getEffectiveSalaryInfoFromRoles(
      workLogWithOverrides,
      jobPosting.roles,
      jobPosting.defaultSalary
    );
    const allowances = getEffectiveAllowances(workLogWithOverrides, jobPosting.allowances);
    const taxSettings = getEffectiveTaxSettings(workLogWithOverrides, jobPosting.taxSettings);

    // 4. 정산 금액 계산 (Phase 6 - SettlementCalculator 사용)
    const settlementResult = SettlementCalculator.calculate({
      startTime: workLog.checkInTime,
      endTime: workLog.checkOutTime,
      salaryInfo,
      allowances,
      taxSettings,
    });

    const grossPay = settlementResult.totalPay;
    const deductions = input.deductions ?? 0;

    // 음수 공제 검증 (부정 지급 방지)
    if (deductions < 0) {
      throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
        userMessage: '공제 금액은 0 이상이어야 합니다',
      });
    }

    const netPay = Math.max(0, settlementResult.afterTaxPay - deductions);

    // 음수 정산 금액 경고 (로깅만, 0으로 처리)
    if (settlementResult.afterTaxPay - deductions < 0) {
      logger.warn('공제 후 금액이 음수', {
        workLogId: input.workLogId,
        afterTaxPay: settlementResult.afterTaxPay,
        deductions,
        adjustedNetPay: netPay,
      });
    }

    const result: SettlementCalculation = {
      workLogId: input.workLogId,
      salaryType: salaryInfo.type,
      hoursWorked: settlementResult.hoursWorked,
      grossPay,
      deductions,
      netPay,
    };

    logger.info('정산 금액 계산 완료', {
      workLogId: input.workLogId,
      netPay,
      salaryType: salaryInfo.type,
    });

    return result;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '정산 금액 계산',
      component: 'settlementService',
      context: { workLogId: input.workLogId, ownerId },
    });
  }
}
