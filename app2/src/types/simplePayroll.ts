// 단순 정산 관련 타입 정의

export interface SimplePayrollData {
  staffId: string;
  staffName: string;
  date: string; // YYYY-MM-DD
  workHours: number;
  hourlyRate: number;
  dailyPay: number;
  eventId?: string;
  eventName?: string;
}

export interface SimplePayrollSummary {
  period: {
    start: string;
    end: string;
  };
  totalStaff: number;
  totalHours: number;
  totalPay: number;
  averageHours: number;
  averagePay: number;
  dailyPayrolls: SimplePayrollData[];
}

export interface HourlyRates {
  [jobRole: string]: number;
}

// 기본 시급 설정 (단순화)
export const DEFAULT_HOURLY_RATES: HourlyRates = {
  Dealer: 15000, // 시급 15,000원
  Floor: 18000, // 시급 18,000원
  'Tournament Director': 25000, // 시급 25,000원
  'Chip Master': 20000, // 시급 20,000원
  Registration: 16000, // 시급 16,000원
  Security: 17000, // 시급 17,000원
  Cashier: 19000, // 시급 19,000원
  Server: 14000, // 시급 14,000원
  default: 15000, // 기본 시급
};
