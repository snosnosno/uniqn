import { Timestamp } from 'firebase/firestore';
import { JobPosting } from '../types/jobPosting';
import { ScheduleEvent } from '../types/schedule';
import { logger } from './logger';

/**
 * JobPosting 데이터로부터 스냅샷 생성
 *
 * @param jobPosting - 공고 데이터
 * @param role - 역할 (역할별 급여 추출용)
 * @param reason - 스냅샷 생성 이유
 * @returns 스냅샷 데이터
 */
export function createSnapshotFromJobPosting(
  jobPosting: JobPosting,
  role?: string,
  reason: 'confirmed' | 'worklog_created' | 'posting_deleted' = 'confirmed'
): ScheduleEvent['snapshotData'] {
  try {
    // 급여 정보 추출
    const salaryType = jobPosting.salaryType === 'negotiable' ? 'other' : (jobPosting.salaryType || 'hourly');
    const salaryAmount = jobPosting.salaryAmount ? parseFloat(jobPosting.salaryAmount) : 10000;

    // 역할별 급여 정보 변환
    const roleSalaries: Record<string, { type: string; amount: number }> = {};
    if (jobPosting.useRoleSalary && jobPosting.roleSalaries) {
      Object.entries(jobPosting.roleSalaries).forEach(([roleKey, roleInfo]) => {
        roleSalaries[roleKey] = {
          type: roleInfo.salaryType === 'negotiable' ? 'other' : roleInfo.salaryType,
          amount: parseFloat(roleInfo.salaryAmount) || 0
        };
      });
    }

    // 수당 정보 추출
    const allowances: { meal?: number; transportation?: number; accommodation?: number } = {};
    if (jobPosting.benefits?.mealAllowance) {
      const mealValue = parseFloat(String(jobPosting.benefits.mealAllowance));
      if (!isNaN(mealValue) && mealValue > 0) {
        allowances.meal = mealValue;
      }
    }
    if (jobPosting.benefits?.transportation) {
      const transportValue = parseFloat(String(jobPosting.benefits.transportation));
      if (!isNaN(transportValue) && transportValue > 0) {
        allowances.transportation = transportValue;
      }
    }
    if (jobPosting.benefits?.accommodation) {
      const accommodationValue = parseFloat(String(jobPosting.benefits.accommodation));
      if (!isNaN(accommodationValue) && accommodationValue > 0) {
        allowances.accommodation = accommodationValue;
      }
    }

    // 스냅샷 데이터 생성
    const snapshot: ScheduleEvent['snapshotData'] = {
      // 공고 제목 (High)
      ...(jobPosting.title && { title: jobPosting.title }),

      // 급여 정보 (Critical)
      salary: {
        type: salaryType as 'hourly' | 'daily' | 'monthly' | 'other',
        amount: salaryAmount,
        ...(jobPosting.useRoleSalary !== undefined && { useRoleSalary: jobPosting.useRoleSalary }),
        ...(Object.keys(roleSalaries).length > 0 && { roleSalaries })
      },

      // 수당 정보 (Critical)
      ...(Object.keys(allowances).length > 0 && { allowances }),

      // 세금 설정 (Critical)
      ...(jobPosting.taxSettings?.enabled && {
        taxSettings: {
          enabled: true,
          ...(jobPosting.taxSettings.taxRate !== undefined && { taxRate: jobPosting.taxSettings.taxRate }),
          ...(jobPosting.taxSettings.taxAmount !== undefined && { taxAmount: jobPosting.taxSettings.taxAmount })
        }
      }),

      // 장소 정보 (High)
      location: jobPosting.location || '',
      ...(jobPosting.detailedAddress && { detailedAddress: jobPosting.detailedAddress }),
      ...(jobPosting.district && { district: jobPosting.district }),
      ...(jobPosting.contactPhone && { contactPhone: jobPosting.contactPhone }),

      // 신고 기능 (High)
      createdBy: jobPosting.createdBy || '',

      // 메타 정보 (Low)
      snapshotAt: Timestamp.now(),
      snapshotReason: reason
    };

    logger.info('스냅샷 생성 완료', {
      component: 'scheduleSnapshot',
      data: {
        jobPostingId: jobPosting.id,
        role,
        reason,
        hasSalary: !!snapshot.salary,
        hasAllowances: !!snapshot.allowances,
        hasTaxSettings: !!snapshot.taxSettings
      }
    });

    return snapshot;
  } catch (error) {
    logger.error('스냅샷 생성 실패:', error instanceof Error ? error : new Error(String(error)), {
      component: 'scheduleSnapshot',
      data: { jobPostingId: jobPosting.id, role, reason }
    });

    // 기본 스냅샷 반환 (최소한의 정보)
    return {
      salary: {
        type: 'hourly',
        amount: 10000
      },
      location: jobPosting.location || '',
      createdBy: jobPosting.createdBy || '',
      snapshotAt: Timestamp.now(),
      snapshotReason: reason
    };
  }
}

/**
 * 기존 스냅샷 데이터 업데이트 여부 확인
 *
 * @param existingSnapshot - 기존 스냅샷
 * @param newJobPosting - 새로운 공고 데이터
 * @returns 업데이트 필요 여부
 */
export function shouldUpdateSnapshot(
  existingSnapshot: ScheduleEvent['snapshotData'] | undefined,
  newJobPosting: JobPosting
): boolean {
  if (!existingSnapshot) return true;

  // 급여 정보 변경 확인
  const newSalaryAmount = newJobPosting.salaryAmount ? parseFloat(newJobPosting.salaryAmount) : 10000;
  if (existingSnapshot.salary.amount !== newSalaryAmount) {
    return true;
  }

  // 수당 정보 변경 확인
  const newMeal = newJobPosting.benefits?.mealAllowance ? parseFloat(String(newJobPosting.benefits.mealAllowance)) : 0;
  const existingMeal = existingSnapshot.allowances?.meal || 0;
  if (newMeal !== existingMeal) {
    return true;
  }

  // 장소 정보 변경 확인
  if (existingSnapshot.location !== (newJobPosting.location || '')) {
    return true;
  }

  return false;
}

/**
 * 스냅샷 우선순위 폴백 헬퍼
 *
 * @param schedule - 스케줄 이벤트
 * @param jobPosting - 공고 데이터 (선택)
 * @returns 우선순위에 따른 값 추출 헬퍼 객체
 */
export function getSnapshotOrFallback(
  schedule: ScheduleEvent,
  jobPosting?: JobPosting | null
) {
  return {
    /** 장소 정보 (우선순위: 스냅샷 > 공고 > 스케줄 > 기본값) */
    location: () =>
      schedule.snapshotData?.location ||
      jobPosting?.location ||
      schedule.location ||
      '미정',

    /** 상세주소 (우선순위: 스냅샷 > 공고 > 스케줄) */
    detailedAddress: () =>
      schedule.snapshotData?.detailedAddress ||
      jobPosting?.detailedAddress ||
      schedule.detailedAddress,

    /** 연락처 (우선순위: 스냅샷 > 공고) */
    contactPhone: () =>
      schedule.snapshotData?.contactPhone ||
      jobPosting?.contactPhone,

    /** 급여 타입 (우선순위: 스냅샷 > 공고 > 기본값) */
    salaryType: () =>
      schedule.snapshotData?.salary.type ||
      (jobPosting?.salaryType === 'negotiable' ? 'other' : jobPosting?.salaryType) ||
      'hourly',

    /** 급여 금액 (우선순위: 스냅샷 > 공고 > 기본값) */
    salaryAmount: () =>
      schedule.snapshotData?.salary.amount ||
      (jobPosting?.salaryAmount ? parseFloat(jobPosting.salaryAmount) : 10000),

    /** 역할별 급여 사용 여부 (우선순위: 스냅샷 > 공고) */
    useRoleSalary: () =>
      schedule.snapshotData?.salary.useRoleSalary ??
      jobPosting?.useRoleSalary ??
      false,

    /** 역할별 급여 정보 (우선순위: 스냅샷 > 공고) */
    roleSalaries: () =>
      schedule.snapshotData?.salary.roleSalaries ||
      jobPosting?.roleSalaries,

    /** 수당 정보 (우선순위: 스냅샷 > 공고) */
    allowances: () =>
      schedule.snapshotData?.allowances || {
        meal: jobPosting?.benefits?.mealAllowance ? parseFloat(String(jobPosting.benefits.mealAllowance)) : 0,
        transportation: jobPosting?.benefits?.transportation ? parseFloat(String(jobPosting.benefits.transportation)) : 0,
        accommodation: jobPosting?.benefits?.accommodation ? parseFloat(String(jobPosting.benefits.accommodation)) : 0
      },

    /** 세금 설정 (우선순위: 스냅샷 > 공고) */
    taxSettings: () =>
      schedule.snapshotData?.taxSettings ||
      jobPosting?.taxSettings,

    /** 신고 대상 ID (우선순위: 스냅샷 > 공고) */
    createdBy: () =>
      schedule.snapshotData?.createdBy ||
      jobPosting?.createdBy
  };
}
