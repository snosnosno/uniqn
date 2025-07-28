// 급여 계산 관련 타입 정의

export interface PayrollCalculationData {
  // 기본 정보
  staffId: string;
  staffName: string;
  eventId: string;
  eventName?: string;
  period: {
    type: 'daily' | 'weekly' | 'monthly';
    start: string; // YYYY-MM-DD
    end: string; // YYYY-MM-DD
  };

  // 근무시간 정보
  workTime: {
    regularHours: number; // 정규 근무시간
    overtimeHours: number; // 초과 근무시간
    totalHours: number; // 총 근무시간
    breakHours: number; // 휴식시간
  };

  // 예외 상황 정보
  exceptions: {
    late: {
      count: number;
      totalMinutes: number;
      deductionHours: number;
    };
    earlyLeave: {
      count: number;
      totalMinutes: number;
      deductionHours: number;
    };
    absence: {
      count: number;
      deductionHours: number;
    };
    overtime: {
      count: number;
      totalMinutes: number;
      bonusHours: number;
    };
  };

  // 급여 계산 정보
  payment: {
    baseRate: number; // 기본 시급
    overtimeRate: number; // 초과근무 시급
    bonusRate: number; // 보너스 시급
    regularPay: number; // 정규 급여
    overtimePay: number; // 초과근무 급여
    bonusPay: number; // 보너스 급여
    deduction: number; // 차감액
    totalPay: number; // 총 급여
  };

  // 세부 기록
  dailyRecords: DailyWorkRecord[];
  
  // 메타 정보
  calculatedAt: string; // 계산 시간
  status: 'draft' | 'confirmed' | 'paid';
}

export interface DailyWorkRecord {
  date: string; // YYYY-MM-DD
  scheduledStartTime: string;
  scheduledEndTime: string;
  actualStartTime?: string;
  actualEndTime?: string;
  workMinutes: number;
  breakMinutes: number;
  tableAssignments: string[];
  exceptions: any[]; // 예외 기능 제거 - 빈 배열로 처리
  status: 'scheduled' | 'completed' | 'absent';
}

export interface PayrollSummary {
  period: {
    type: 'weekly' | 'monthly';
    start: string;
    end: string;
  };
  totalStaff: number;
  totalHours: number; // 총 근무시간
  regularHours: number; // 정규 근무시간
  overtimeHours: number; // 초과 근무시간
  totalPay: number; // 총 급여
  basePay: number; // 기본급
  overtimePay: number; // 초과근무 급여
  totalDeductions: number; // 총 공제액
  totalExceptions: number; // 총 예외 사항 수
  averageWorkHours: number;
  averagePay: number;
  exceptionSummary: {
    totalLate: number;
    totalEarlyLeave: number;
    totalAbsence: number;
    totalOvertime: number;
  };
  staffSummaries: PayrollCalculationData[];
}

export interface PayrollSettings {
  baseRates: {
    [jobRole: string]: number; // 직무별 기본 시급
  };
  overtimeMultiplier: number; // 초과근무 배율 (예: 1.5)
  deductionRates: {
    latePerMinute: number; // 지각 시 분당 차감율
    earlyLeavePerMinute: number; // 조퇴 시 분당 차감율
    absencePerDay: number; // 결근 시 일당 차감율
  };
  bonusRates: {
    overtimePerMinute: number; // 초과근무 시 분당 보너스율
  };
}

export const DEFAULT_PAYROLL_SETTINGS: PayrollSettings = {
  baseRates: {
    'Dealer': 15000, // 시급 15,000원
    'Floor': 18000, // 시급 18,000원
    'Tournament Director': 25000, // 시급 25,000원
    'Chip Master': 20000, // 시급 20,000원
    'Registration': 16000, // 시급 16,000원
    'Security': 17000, // 시급 17,000원
    'Cashier': 19000, // 시급 19,000원
    'Server': 14000, // 시급 14,000원
  },
  overtimeMultiplier: 1.5,
  deductionRates: {
    latePerMinute: 200, // 분당 200원 차감
    earlyLeavePerMinute: 300, // 분당 300원 차감
    absencePerDay: 50000, // 결근 시 5만원 차감
  },
  bonusRates: {
    overtimePerMinute: 100, // 초과근무 시 분당 100원 보너스
  },
};