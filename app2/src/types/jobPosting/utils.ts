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
   * v2.2: 멀티데이/단일일 구분 로직 강화 (날짜별 독립 카운트)
   * @param jobPosting
   * @param date
   * @param timeSlot
   * @param role
   * @returns 확정된 스태프 수 (지원서별로 구분하여 중복 제거)
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

    // 🆕 v2.4: 날짜별 독립 카운트 - 정확한 날짜 매칭 우선순위
    // 1. 정확한 날짜 매칭을 먼저 찾기 (단일일 우선)
    let matchingRequirement = jobPosting.dateSpecificRequirements?.find(req => {
      const reqDate = timestampToLocalDateString(req.date);
      return reqDate === targetDate;
    });

    // 2. 정확한 날짜 매칭이 없다면 멀티데이 범위 내에서 찾기
    if (!matchingRequirement) {
      matchingRequirement = jobPosting.dateSpecificRequirements?.find(req => {
        const firstTimeSlot = req.timeSlots?.[0];
        const reqDate = timestampToLocalDateString(req.date);
        const endDate = firstTimeSlot?.duration?.endDate ? timestampToLocalDateString(firstTimeSlot.duration.endDate) : null;

        if (firstTimeSlot?.duration?.type === 'multi' && endDate) {
          return reqDate <= targetDate && endDate >= targetDate;
        }
        return false;
      });
    }

    // 매칭된 요구사항이 멀티데이인지 확인
    const isMultiDayRange = matchingRequirement ?
      matchingRequirement.timeSlots?.[0]?.duration?.type === 'multi' : false;

    // 🔍 상세 디버그 로그
    if (process.env.NODE_ENV === 'development') {
      console.debug('🔍 [v2.4 우선순위 매칭]', {
        targetDate,
        matchingRequirement: matchingRequirement ? {
          date: timestampToLocalDateString(matchingRequirement.date),
          durationType: matchingRequirement.timeSlots?.[0]?.duration?.type,
          endDate: matchingRequirement.timeSlots?.[0]?.duration?.endDate ?
            timestampToLocalDateString(matchingRequirement.timeSlots[0].duration.endDate) : null
        } : null,
        isMultiDayRange
      });
    }

    const matchingStaff = jobPosting.confirmedStaff.filter(staff => {
      const staffDate = timestampToLocalDateString(staff.date);

      // 기본 조건: 역할, 시간대, 날짜 매칭
      const basicMatch = staff.timeSlot === timeSlot &&
                        staff.role === role &&
                        staffDate === targetDate;

      if (!basicMatch) return false;

      // 🚨 핵심 로직: 멀티데이 범위 내에서의 카운팅 규칙
      if (isMultiDayRange) {
        // 멀티데이 범위에서 조회하는 경우: 멀티데이 지원만 카운트
        return staff.applicationType === 'multi';
      } else {
        // 단일일에서 조회하는 경우: 단일일 지원만 카운트 (멀티데이 제외)
        return staff.applicationType !== 'multi';
      }
    });

    // applicationId가 있는 경우와 없는 경우 구분 처리
    const withApplicationId = matchingStaff.filter(staff => staff.applicationId);
    const withoutApplicationId = matchingStaff.filter(staff => !staff.applicationId);

    // 🆕 v2.2: 멀티데이와 단일일을 구분하여 카운트
    // 1. 기존 데이터(applicationId 없음): 개별 카운트
    // 2. 신규 데이터(applicationId 있음): applicationId별 중복 제거
    const uniqueApplicationIds = new Set(withApplicationId.map(staff => staff.applicationId));

    const finalCount = withoutApplicationId.length + uniqueApplicationIds.size;

    // 🔍 디버깅 로그 (개발 환경에서만) - 조건 제거하여 모든 호출 로그 출력
    if (process.env.NODE_ENV === 'development') {
      console.debug('📊 [JobPostingUtils.getConfirmedStaffCount]', {
        targetDate,
        timeSlot,
        role,
        isMultiDayRange,
        totalMatching: matchingStaff.length,
        withApplicationId: withApplicationId.length,
        withoutApplicationId: withoutApplicationId.length,
        uniqueApplications: uniqueApplicationIds.size,
        applicationIds: Array.from(uniqueApplicationIds),
        finalCount,
        // 🆕 전체 confirmedStaff 데이터 확인
        allConfirmedStaff: jobPosting.confirmedStaff?.map(staff => ({
          userId: staff.userId,
          role: staff.role,
          timeSlot: staff.timeSlot,
          date: staff.date,
          applicationId: staff.applicationId,
          applicationType: staff.applicationType
        })) || [],
        // 🆕 실제 매칭된 스태프들의 상세 정보
        matchingStaffDetails: matchingStaff.map(staff => ({
          userId: staff.userId,
          role: staff.role,
          timeSlot: staff.timeSlot,
          date: staff.date,
          staffDate: timestampToLocalDateString(staff.date),
          applicationId: staff.applicationId,
          applicationType: staff.applicationType
        }))
      });
    }

    // 기존 데이터(applicationId 없음) + 신규 데이터(applicationId별 중복 제거)
    return finalCount;
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