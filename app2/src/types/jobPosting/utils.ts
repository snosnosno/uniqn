import { timestampToLocalDateString } from '../../utils/dateUtils';
import { JobPosting } from './jobPosting';
import { TimeSlot } from './base';
import { Applicant } from './applicant';

/**
 * JobPosting 관련 유틸리티 클래스
 */
export class JobPostingUtils {
  /**
   * JobPosting의 모든 시간대를 평면화하여 반환
   * @param jobPosting JobPosting 객체
   * @returns TimeSlot 배열
   */
  static flattenTimeSlots(jobPosting: JobPosting): TimeSlot[] {
    const allTimeSlots: TimeSlot[] = [];
    
    // dateSpecificRequirements의 timeSlots 추가
    if (jobPosting.dateSpecificRequirements) {
      jobPosting.dateSpecificRequirements.forEach(dateReq => {
        allTimeSlots.push(...dateReq.timeSlots);
      });
    }
    
    return allTimeSlots;
  }
  
  /**
   * JobPosting이 특정 날짜의 요구사항을 가지고 있는지 확인
   * @param jobPosting 
   * @param date yyyy-MM-dd 형식
   * @returns boolean
   */
  static hasRequirementsForDate(jobPosting: JobPosting, date: string): boolean {
    if (!jobPosting.dateSpecificRequirements) return false;
    
    return jobPosting.dateSpecificRequirements.some(
      dateReq => timestampToLocalDateString(dateReq.date) === date
    );
  }
  
  /**
   * 모든 TimeSlot을 날짜별로 그룹화
   * @param jobPosting 
   * @returns 날짜별 TimeSlot Map
   */
  static groupTimeSlotsByDate(jobPosting: JobPosting): Map<string, TimeSlot[]> {
    const dateMap = new Map<string, TimeSlot[]>();
    
    // 날짜별 요구사항을 Map에 추가
    if (jobPosting.dateSpecificRequirements) {
      jobPosting.dateSpecificRequirements.forEach(dateReq => {
        const dateStr = timestampToLocalDateString(dateReq.date);
        dateMap.set(dateStr, dateReq.timeSlots);
      });
    }
    
    return dateMap;
  }
  
  /**
   * 특정 시간대의 모든 날짜 가져오기
   * @param jobPosting 
   * @param timeSlot 시간대 문자열
   * @returns 날짜 배열
   */
  static getDatesForTimeSlot(jobPosting: JobPosting, timeSlot: string): string[] {
    const dates = new Set<string>();
    
    // 날짜별 요구사항 확인
    if (jobPosting.dateSpecificRequirements) {
      jobPosting.dateSpecificRequirements.forEach(dateReq => {
        if (dateReq.timeSlots.some(ts => ts.time === timeSlot)) {
          dates.add(timestampToLocalDateString(dateReq.date));
        }
      });
    }
    
    return Array.from(dates).sort();
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
    const dateReq = jobPosting.dateSpecificRequirements?.find(dr => dr.date === date);
    return dateReq?.timeSlots || [];
  }

  /**
   * JobPosting의 모든 필요 역할들 추출 (필터링용)
   * @param jobPosting 
   * @returns 역할 이름 배열
   */
  static extractRequiredRoles(jobPosting: JobPosting): string[] {
    const roles = new Set<string>();
    
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
    
    // 입력 날짜도 변환 (안전성을 위해)
    const targetDate = timestampToLocalDateString(date);
    
    return jobPosting.confirmedStaff.filter(staff => {
      const staffDate = timestampToLocalDateString(staff.date);
      return staff.timeSlot === timeSlot && 
             staff.role === role &&
             staffDate === targetDate; // 정확한 날짜 매칭만
    }).length;
  }

  /**
   * 특정 역할이 가득 찼는지 확인
   * @param jobPosting 
   * @param timeSlot 
   * @param role 
   * @param date 날짜
   * @returns 역할이 가득 찼는지 여부
   */
  static isRoleFull(
    jobPosting: JobPosting,
    timeSlot: string,
    role: string,
    date: string
  ): boolean {
    let requiredCount = 0;
    
    // 날짜별 요구사항에서 확인
    const dateReq = jobPosting.dateSpecificRequirements?.find(
      dr => timestampToLocalDateString(dr.date) === date
    );
    const timeSlotData = dateReq?.timeSlots.find(ts => ts.time === timeSlot);
    const roleData = timeSlotData?.roles.find(r => r.name === role);
    requiredCount = roleData?.count || 0;
    
    if (requiredCount === 0) return false;
    
    const confirmedCount = this.getConfirmedStaffCount(jobPosting, date, timeSlot, role);
    
    return confirmedCount >= requiredCount;
  }
  
  /**
   * 특정 날짜에 지원한 지원자들 필터링
   * @param applicants 지원자 목록
   * @param date yyyy-MM-dd 형식
   * @returns 해당 날짜에 지원한 지원자 목록
   */
  static getApplicantsByDate(applicants: Applicant[], date: string): Applicant[] {
    return applicants.filter(applicant => 
      applicant.assignedDate === date || 
      applicant.date === date
    );
  }
  
  /**
   * 요구 인원 충족률 계산
   * @param jobPosting 
   * @returns 충족률 (0-100)
   */
  static calculateFulfillmentRate(jobPosting: JobPosting): number {
    let totalRequired = 0;
    let totalConfirmed = 0;
    
    // 날짜별 요구사항 처리
    jobPosting.dateSpecificRequirements?.forEach(dateReq => {
      const dateStr = timestampToLocalDateString(dateReq.date);
      dateReq.timeSlots.forEach(ts => {
        ts.roles.forEach(role => {
          totalRequired += role.count;
          totalConfirmed += this.getConfirmedStaffCount(
            jobPosting, 
            dateStr, 
            ts.time, 
            role.name
          );
        });
      });
    });
    
    return totalRequired > 0 ? Math.round((totalConfirmed / totalRequired) * 100) : 0;
  }
  
  /**
   * 날짜별 요구사항 진행 상황을 Map으로 반환
   * @param jobPosting 
   * @returns Map<날짜, {required: number, confirmed: number}>
   */
  static getRequirementProgress(jobPosting: JobPosting): Map<string, {required: number, confirmed: number}> {
    const progressMap = new Map<string, {required: number, confirmed: number}>();
    
    // 날짜별 요구사항 처리
    jobPosting.dateSpecificRequirements?.forEach(dateReq => {
      const dateStr = timestampToLocalDateString(dateReq.date);
      let required = 0;
      let confirmed = 0;
      
      dateReq.timeSlots.forEach(ts => {
        ts.roles.forEach(role => {
          required += role.count;
          confirmed += this.getConfirmedStaffCount(jobPosting, dateStr, ts.time, role.name);
        });
      });
      
      progressMap.set(dateStr, { required, confirmed });
    });
    
    return progressMap;
  }
}