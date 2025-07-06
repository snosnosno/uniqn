// Job Posting 관련 타입 정의

// 지원자 타입 정의
export interface Applicant {
  id: string;
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  timeSlot: string;
  date?: string;
  createdAt: any; // Firebase Timestamp
  status: 'pending' | 'confirmed' | 'rejected';
  jobPostingId: string;
  additionalInfo?: string;
}


// 기존 타입들 (기존 호환성 유지)
export interface RoleRequirement {
  name: string;
  count: number;
}

// 확장된 TimeSlot 인터페이스 - 일자별 인원 요구사항 지원
export interface TimeSlot {
  time: string;
  roles: RoleRequirement[];
  date?: string; // 선택적 필드: yyyy-MM-dd 형식, 특정 날짜에만 적용될 때 사용
}

// 일자별 인원 요구사항을 위한 헬퍼 인터페이스
export interface DateSpecificRequirement {
  date: string; // yyyy-MM-dd 형식
  timeSlots: TimeSlot[];
}

// 확장된 JobPosting 인터페이스
export interface JobPosting {
  id: string;
  title: string;
  description: string;
  location: string;
  type: string;
  status: 'open' | 'closed';
  startDate: any; // Firebase Timestamp
  endDate: any;   // Firebase Timestamp
  createdAt: any; // Firebase Timestamp
  managerId?: string;
  timeSlots?: TimeSlot[]; // 기존 전체 기간 공통 타임슬롯
  dateSpecificRequirements?: DateSpecificRequirement[]; // 일자별 특화 요구사항
  confirmedStaff?: ConfirmedStaff[];
  searchIndex?: string[];
  requirements?: any[];
  manager?: string;
  requiredRoles?: string[]; // 필터링용
  [key: string]: any;
}

// 확정된 스태프 정보
export interface ConfirmedStaff {
  userId: string;
  role: string;
  timeSlot: string;
  date?: string; // 일자별 요구사항에 대응하는 날짜
}

// Job Posting 필터 인터페이스
export interface JobPostingFilters {
  location: string;
  type: string;
  startDate: string;
  role: string;
  month?: string; // Optional month filter (01-12)
  day?: string;   // Optional day filter (01-31)
  searchTerms?: string[]; // Optional search terms
}

// 데이터 변환 유틸리티 함수들
export class JobPostingUtils {
  
  /**
   * 기존 TimeSlot 배열을 일자별 요구사항으로 변환
   * @param timeSlots 기존 timeSlots
   * @param dates 적용할 날짜 배열
   * @returns DateSpecificRequirement 배열
   */
  static convertToDateSpecific(
    timeSlots: TimeSlot[], 
    dates: string[]
  ): DateSpecificRequirement[] {
    return dates.map(date => ({
      date,
      timeSlots: timeSlots.map(ts => ({
        ...ts,
        date // 각 timeSlot에 date 추가
      }))
    }));
  }

  /**
   * 일자별 요구사항을 기존 형식으로 변환 (호환성)
   * @param dateSpecificRequirements 일자별 요구사항
   * @returns 첫 번째 날짜의 timeSlots 또는 빈 배열
   */
  static convertToLegacyTimeSlots(
    dateSpecificRequirements?: DateSpecificRequirement[]
  ): TimeSlot[] {
    if (!dateSpecificRequirements || dateSpecificRequirements.length === 0) {
      return [];
    }
    
    // 첫 번째 날짜의 timeSlots를 반환 (date 필드 제거)
    return dateSpecificRequirements[0].timeSlots.map(ts => ({
      time: ts.time,
      roles: ts.roles
    }));
  }

  /**
   * JobPosting이 일자별 요구사항을 사용하는지 확인
   * @param jobPosting 
   * @returns boolean
   */
  static hasDateSpecificRequirements(jobPosting: JobPosting): boolean {
    return !!(jobPosting.dateSpecificRequirements && 
              jobPosting.dateSpecificRequirements.length > 0);
  }

  /**
   * 특정 날짜의 TimeSlot들을 가져오기
   * @param jobPosting 
   * @param date yyyy-MM-dd 형식
   * @returns TimeSlot 배열
   */
  static getTimeSlotsForDate(
    jobPosting: JobPosting, 
    date: string
  ): TimeSlot[] {
    if (this.hasDateSpecificRequirements(jobPosting)) {
      const dateReq = jobPosting.dateSpecificRequirements?.find(dr => dr.date === date);
      return dateReq?.timeSlots || [];
    }
    
    // 기존 방식: 전체 기간 공통 timeSlots 사용
    return jobPosting.timeSlots || [];
  }

  /**
   * JobPosting의 모든 필요 역할들 추출 (필터링용)
   * @param jobPosting 
   * @returns 역할 이름 배열
   */
  static extractRequiredRoles(jobPosting: JobPosting): string[] {
    const roles = new Set<string>();
    
    // 기존 timeSlots에서 역할 추출
    if (jobPosting.timeSlots) {
      jobPosting.timeSlots.forEach(ts => {
        ts.roles.forEach(role => roles.add(role.name));
      });
    }
    
    // 일자별 요구사항에서 역할 추출
    if (jobPosting.dateSpecificRequirements) {
      jobPosting.dateSpecificRequirements.forEach(dateReq => {
        dateReq.timeSlots.forEach(ts => {
          ts.roles.forEach(role => roles.add(role.name));
        });
      });
    }
    
    return Array.from(roles);
  }

  /**
   * 특정 날짜와 시간대, 역할에 대한 확정된 스태프 수 계산
   * @param jobPosting 
   * @param date 
   * @param timeSlot 
   * @param role 
   * @returns 확정된 스태프 수
   */
  static getConfirmedStaffCount(
    jobPosting: JobPosting,
    date: string,
    timeSlot: string,
    role: string
  ): number {
    if (!jobPosting.confirmedStaff) return 0;
    
    return jobPosting.confirmedStaff.filter(staff => 
      staff.timeSlot === timeSlot && 
      staff.role === role &&
      (staff.date === date || !staff.date) // date가 없으면 모든 날짜에 적용
    ).length;
  }
}

// 타입 가드 함수들
export const isValidTimeSlot = (obj: any): obj is TimeSlot => {
  return obj && 
         typeof obj.time === 'string' && 
         Array.isArray(obj.roles) &&
         obj.roles.every((role: any) => 
           typeof role.name === 'string' && 
           typeof role.count === 'number'
         );
};

export const isValidJobPosting = (obj: any): obj is JobPosting => {
  return obj && 
         typeof obj.id === 'string' &&
         typeof obj.title === 'string' &&
         typeof obj.status === 'string' &&
         (obj.status === 'open' || obj.status === 'closed');
};