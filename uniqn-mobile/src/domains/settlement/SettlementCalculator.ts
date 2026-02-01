/**
 * 정산 계산기
 *
 * @description Phase 6 - 정산 계산기 통합
 * 모든 정산 계산 로직의 단일 소스
 */

import type { JobPostingCard } from '@/types/jobPosting';
import type { SalaryInfo, Allowances, TaxSettings } from '@/utils/settlement';
import { TimeNormalizer, type TimeInput } from '@/shared/time';
import { TaxCalculator } from './TaxCalculator';
import { SettlementCache, type CachedSettlement } from './SettlementCache';

// ============================================================================
// Types
// ============================================================================

/**
 * 정산 계산 입력
 */
export interface CalculationInput {
  startTime: TimeInput;
  endTime: TimeInput;
  salaryInfo: SalaryInfo;
  allowances?: Allowances;
  taxSettings?: TaxSettings;
}

/**
 * 정산 계산 결과
 */
export interface SettlementResult {
  hoursWorked: number;
  basePay: number;
  allowancePay: number;
  totalPay: number;
  taxAmount: number;
  afterTaxPay: number;
}

/**
 * 정산 세부 내역 (확장)
 */
export interface SettlementBreakdown extends SettlementResult {
  salaryInfo: SalaryInfo;
  allowances?: Allowances;
  taxSettings?: TaxSettings;
  isEstimate: boolean;
  calculatedAt: string;
}

// ============================================================================
// Constants
// ============================================================================

/** "제공" 상태를 나타내는 특별 값 */
const PROVIDED_FLAG = -1;

/** 기본 급여 정보 */
const DEFAULT_SALARY_INFO: SalaryInfo = {
  type: 'hourly',
  amount: 15000,
};

/** 기본 세금 설정 */
const DEFAULT_TAX_SETTINGS: TaxSettings = {
  type: 'none',
  value: 0,
};

// ============================================================================
// SettlementCalculator
// ============================================================================

/**
 * 정산 계산기
 *
 * @description
 * - 근무 시간, 급여, 수당, 세금 계산
 * - 캐시를 통한 중복 계산 방지
 * - 역할별 급여 조회
 */
export class SettlementCalculator {
  // ==========================================================================
  // 시간 계산
  // ==========================================================================

  /**
   * 근무 시간 계산 (시간 단위)
   *
   * @param startTime - 출근 시간 (Date, Timestamp, string)
   * @param endTime - 퇴근 시간 (Date, Timestamp, string)
   * @returns 근무 시간 (소수점 2자리)
   */
  static calculateHours(startTime: TimeInput, endTime: TimeInput): number {
    const start = TimeNormalizer.parseTime(startTime);
    const end = TimeNormalizer.parseTime(endTime);

    if (!start || !end) return 0;

    const totalMinutes = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60));
    return totalMinutes / 60;
  }

  // ==========================================================================
  // 급여 계산
  // ==========================================================================

  /**
   * 기본 급여 계산
   *
   * @param salaryInfo - 급여 정보 (타입, 금액)
   * @param hoursWorked - 근무 시간
   * @returns 기본 급여
   *
   * @description P1 보안: 음수 금액 검증 추가
   */
  static calculateBasePay(salaryInfo: SalaryInfo, hoursWorked: number): number {
    if (hoursWorked === 0) return 0;

    // P1 보안: 음수 금액 방어
    if (salaryInfo.amount < 0) {
      return 0;
    }

    switch (salaryInfo.type) {
      case 'hourly':
        return Math.round(hoursWorked * salaryInfo.amount);
      case 'daily':
      case 'monthly':
        // 출근하면 전액
        return salaryInfo.amount;
      default:
        return 0;
    }
  }

  /**
   * 수당 금액 계산
   *
   * @param allowances - 수당 정보
   * @returns 수당 합계
   */
  static calculateAllowances(allowances?: Allowances): number {
    if (!allowances) return 0;

    let amount = 0;

    // 식비 (PROVIDED_FLAG 제외)
    if (allowances.meal && allowances.meal !== PROVIDED_FLAG && allowances.meal > 0) {
      amount += allowances.meal;
    }

    // 교통비 (PROVIDED_FLAG 제외)
    if (
      allowances.transportation &&
      allowances.transportation !== PROVIDED_FLAG &&
      allowances.transportation > 0
    ) {
      amount += allowances.transportation;
    }

    // 숙박비 (PROVIDED_FLAG 제외)
    if (
      allowances.accommodation &&
      allowances.accommodation !== PROVIDED_FLAG &&
      allowances.accommodation > 0
    ) {
      amount += allowances.accommodation;
    }

    // 추가 수당
    if (allowances.additional && allowances.additional > 0) {
      amount += allowances.additional;
    }

    return amount;
  }

  // ==========================================================================
  // 메인 계산 함수
  // ==========================================================================

  /**
   * 정산 금액 계산
   *
   * @param input - 계산 입력 (시간, 급여, 수당, 세금)
   * @returns 정산 결과
   */
  static calculate(input: CalculationInput): SettlementResult {
    const hoursWorked = this.calculateHours(input.startTime, input.endTime);

    if (hoursWorked === 0) {
      return {
        hoursWorked: 0,
        basePay: 0,
        allowancePay: 0,
        totalPay: 0,
        taxAmount: 0,
        afterTaxPay: 0,
      };
    }

    const basePay = this.calculateBasePay(input.salaryInfo, hoursWorked);
    const allowancePay = this.calculateAllowances(input.allowances);
    const totalPay = basePay + allowancePay;

    // 세금 계산
    const taxSettings = input.taxSettings || DEFAULT_TAX_SETTINGS;
    const taxResult = TaxCalculator.calculateByItems(
      totalPay,
      {
        basePay,
        meal: input.allowances?.meal,
        transportation: input.allowances?.transportation,
        accommodation: input.allowances?.accommodation,
        additional: input.allowances?.additional,
      },
      taxSettings
    );

    const afterTaxPay = totalPay - taxResult.taxAmount;

    return {
      hoursWorked: Math.round(hoursWorked * 100) / 100,
      basePay,
      allowancePay,
      totalPay,
      taxAmount: taxResult.taxAmount,
      afterTaxPay,
    };
  }

  /**
   * 여러 근무 기록의 총 금액 계산
   *
   * @param inputs - 계산 입력 배열
   * @param returnAfterTax - true면 세후 금액 합산 (기본: false)
   * @returns 총 금액
   */
  static calculateTotal(inputs: CalculationInput[], returnAfterTax = false): number {
    return inputs.reduce((total, input) => {
      const result = this.calculate(input);
      return total + (returnAfterTax ? result.afterTaxPay : result.totalPay);
    }, 0);
  }

  /**
   * 캐시를 활용한 정산 계산
   *
   * @param workLogId - WorkLog ID
   * @param input - 계산 입력
   * @returns 정산 결과
   */
  static calculateWithCache(workLogId: string, input: CalculationInput): SettlementResult {
    const inputHash = SettlementCache.createInputHash(input);

    // 캐시 확인
    if (!SettlementCache.isStale(workLogId, inputHash)) {
      const cached = SettlementCache.get(workLogId);
      if (cached) return cached;
    }

    // 계산
    const result = this.calculate(input);

    // 캐시 저장
    SettlementCache.set(workLogId, result as CachedSettlement, inputHash);

    return result;
  }

  /**
   * 배치 계산
   *
   * @param inputs - (workLogId, input) 배열
   * @returns 정산 결과 배열
   */
  static calculateBatch(
    inputs: { workLogId: string; input: CalculationInput }[]
  ): SettlementResult[] {
    return inputs.map(({ workLogId, input }) => this.calculateWithCache(workLogId, input));
  }

  // ==========================================================================
  // 역할별 급여 조회
  // ==========================================================================

  /**
   * 역할별 급여 정보 조회
   *
   * @param role - 역할 코드
   * @param customRole - 커스텀 역할명 (role='other'일 때)
   * @param jobPostingCard - 공고 카드 정보
   * @param override - 오버라이드 급여 정보
   * @returns 급여 정보
   */
  static getSalaryForRole(
    role: string | undefined,
    customRole: string | undefined,
    jobPostingCard: JobPostingCard | undefined,
    override?: SalaryInfo
  ): SalaryInfo {
    // 오버라이드가 있으면 우선 사용
    if (override) return override;

    if (!jobPostingCard || !role) {
      return DEFAULT_SALARY_INFO;
    }

    // useSameSalary가 true면 defaultSalary 사용
    if (jobPostingCard.useSameSalary && jobPostingCard.defaultSalary) {
      return jobPostingCard.defaultSalary;
    }

    // dateRequirements > timeSlots > roles 구조에서 역할별 급여 조회 (flatMap으로 평탄화)
    const allRoles = (jobPostingCard.dateRequirements ?? [])
      .flatMap((dateReq) => dateReq.timeSlots ?? [])
      .flatMap((timeSlot) => timeSlot.roles ?? []);

    const matchedRole = allRoles.find((r) => {
      const isMatch =
        (role === 'other' && customRole && r.customRole === customRole) || r.role === role;
      return isMatch && r.salary;
    });

    if (matchedRole?.salary) {
      return matchedRole.salary;
    }

    // 역할별 급여 못 찾으면 defaultSalary 폴백
    if (jobPostingCard.defaultSalary) {
      return jobPostingCard.defaultSalary;
    }

    return DEFAULT_SALARY_INFO;
  }

  // ==========================================================================
  // WorkLog 기반 계산
  // ==========================================================================

  /**
   * WorkLog 객체로 정산 세부 내역 계산
   *
   * @param workLogData - 근무 기록 데이터
   * @param jobPostingCard - 공고 카드 정보
   * @returns 정산 세부 내역 또는 null
   */
  static calculateBreakdown(
    workLogData: {
      checkInTime?: TimeInput;
      checkOutTime?: TimeInput;
      scheduledStartTime?: TimeInput;
      scheduledEndTime?: TimeInput;
      role?: string;
      customRole?: string;
      customSalaryInfo?: SalaryInfo;
      customAllowances?: Allowances;
      customTaxSettings?: TaxSettings;
    },
    jobPostingCard?: JobPostingCard
  ): SettlementBreakdown | null {
    // 시간 결정 (checkIn/checkOut 우선, 없으면 scheduled)
    const startTime = workLogData.checkInTime || workLogData.scheduledStartTime;
    const endTime = workLogData.checkOutTime || workLogData.scheduledEndTime;
    const isEstimate = !workLogData.checkInTime || !workLogData.checkOutTime;

    // 시간 정보가 없으면 계산 불가
    if (!startTime || !endTime) {
      return null;
    }

    // 급여 정보 결정 (오버라이드 우선)
    const salaryInfo: SalaryInfo =
      workLogData.customSalaryInfo ||
      this.getSalaryForRole(workLogData.role, workLogData.customRole, jobPostingCard);

    // 수당 정보 결정 (오버라이드 우선)
    const allowances: Allowances | undefined =
      workLogData.customAllowances || jobPostingCard?.allowances;

    // 세금 설정 결정 (오버라이드 우선)
    const taxSettings: TaxSettings =
      workLogData.customTaxSettings || jobPostingCard?.taxSettings || DEFAULT_TAX_SETTINGS;

    // 정산 계산
    const result = this.calculate({
      startTime,
      endTime,
      salaryInfo,
      allowances,
      taxSettings,
    });

    return {
      ...result,
      salaryInfo,
      allowances,
      taxSettings: taxSettings.type !== 'none' ? taxSettings : undefined,
      isEstimate,
      calculatedAt: new Date().toISOString(),
    };
  }
}
