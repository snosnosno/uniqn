import { timestampToLocalDateString } from '../../utils/dateUtils';
import { JobPosting } from './jobPosting';
import { TimeSlot, DateSpecificRequirement } from './base';
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
    
    // 기본 timeSlots 추가
    if (jobPosting.timeSlots) {
      allTimeSlots.push(...jobPosting.timeSlots);
    }
    
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
    
    // 기존 방식: 전체 기간에 적용되는 timeSlots
    if (jobPosting.timeSlots && jobPosting.timeSlots.length > 0) {
      // 시작일부터 종료일까지 각 날짜에 동일한 timeSlots 적용
      const startDate = new Date(timestampToLocalDateString(jobPosting.startDate));
      const endDate = new Date(timestampToLocalDateString(jobPosting.endDate));
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0] || '';
        if (dateStr) {
          dateMap.set(dateStr, jobPosting.timeSlots.map(ts => ({
            time: ts.time,
            roles: ts.roles
          })));
        }
      }
    }
    
    // 날짜별 요구사항이 있는 경우 덮어쓰기
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
    
    // 전체 기간 timeSlots 확인
    if (jobPosting.timeSlots?.some(ts => ts.time === timeSlot)) {
      const startDate = new Date(timestampToLocalDateString(jobPosting.startDate));
      const endDate = new Date(timestampToLocalDateString(jobPosting.endDate));
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0] || '';
        if (dateStr) {
          dates.add(dateStr);
        }
      }
    }
    
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
   * 모든 날짜에 공통으로 적용되는 TimeSlot들만 반환
   * @param jobPosting 
   * @returns TimeSlot 배열
   */
  static getCommonTimeSlots(jobPosting: JobPosting): TimeSlot[] {
    return jobPosting.timeSlots?.map(ts => ({
      time: ts.time,
      roles: ts.roles
    })) || [];
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
   * @param date 선택적 날짜 (날짜별 요구사항이 있는 경우)
   * @returns 역할이 가득 찼는지 여부
   */
  static isRoleFull(
    jobPosting: JobPosting,
    timeSlot: string,
    role: string,
    date?: string
  ): boolean {
    let requiredCount = 0;
    
    if (date && this.hasDateSpecificRequirements(jobPosting)) {
      // 날짜별 요구사항이 있는 경우
      const dateReq = jobPosting.dateSpecificRequirements?.find(
        dr => timestampToLocalDateString(dr.date) === date
      );
      const timeSlotData = dateReq?.timeSlots.find(ts => ts.time === timeSlot);
      const roleData = timeSlotData?.roles.find(r => r.name === role);
      requiredCount = roleData?.count || 0;
    } else {
      // 전체 기간 공통 요구사항
      const timeSlotData = jobPosting.timeSlots?.find(ts => ts.time === timeSlot);
      const roleData = timeSlotData?.roles.find(r => r.name === role);
      requiredCount = roleData?.count || 0;
    }
    
    if (requiredCount === 0) return false;
    
    const confirmedCount = date 
      ? this.getConfirmedStaffCount(jobPosting, date, timeSlot, role)
      : jobPosting.confirmedStaff?.filter(
          staff => staff.timeSlot === timeSlot && staff.role === role
        ).length || 0;
    
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
    
    if (this.hasDateSpecificRequirements(jobPosting)) {
      // 날짜별 요구사항이 있는 경우
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
    } else {
      // 전체 기간 공통 요구사항
      jobPosting.timeSlots?.forEach(ts => {
        ts.roles.forEach(role => {
          totalRequired += role.count;
          totalConfirmed += jobPosting.confirmedStaff?.filter(
            staff => staff.timeSlot === ts.time && staff.role === role.name
          ).length || 0;
        });
      });
    }
    
    return totalRequired > 0 ? Math.round((totalConfirmed / totalRequired) * 100) : 0;
  }
  
  /**
   * 날짜별 요구사항 진행 상황을 Map으로 반환
   * @param jobPosting 
   * @returns Map<날짜, {required: number, confirmed: number}>
   */
  static getRequirementProgress(jobPosting: JobPosting): Map<string, {required: number, confirmed: number}> {
    const progressMap = new Map<string, {required: number, confirmed: number}>();
    
    if (this.hasDateSpecificRequirements(jobPosting)) {
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
    } else {
      // 전체 기간 공통 요구사항 처리
      const startDate = new Date(timestampToLocalDateString(jobPosting.startDate));
      const endDate = new Date(timestampToLocalDateString(jobPosting.endDate));
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0] || '';
        if (!dateStr) continue;
        
        let required = 0;
        let confirmed = 0;
        
        jobPosting.timeSlots?.forEach(ts => {
          ts.roles.forEach(role => {
            required += role.count;
            confirmed += this.getConfirmedStaffCount(jobPosting, dateStr, ts.time, role.name);
          });
        });
        
        progressMap.set(dateStr, { required, confirmed });
      }
    }
    
    return progressMap;
  }
}