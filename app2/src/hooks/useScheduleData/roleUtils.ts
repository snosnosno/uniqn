import { logger } from '../../utils/logger';

/**
 * 지원서 상태에 따른 역할 결정 함수 (날짜별 역할 매칭)
 * @param data applications 컬렉션 데이터
 * @param targetDate 대상 날짜 (YYYY-MM-DD 형식)
 * @returns 해당 날짜에 지원한 역할 문자열
 */
export const getRoleForApplicationStatus = (data: any, targetDate?: string): string => {
  // 확정된 경우: 날짜별 확정 역할 찾기
  if (data.status === 'confirmed') {
    // 날짜별 역할 매칭 시도
    if (targetDate && data.assignedDates && data.assignedRoles && 
        Array.isArray(data.assignedDates) && Array.isArray(data.assignedRoles)) {
      
      // 대상 날짜와 일치하는 인덱스 찾기
      const dateIndex = data.assignedDates.findIndex((date: any) => {
        const dateStr = typeof date === 'string' ? date : 
                       date?.toDate ? date.toDate().toISOString().substring(0, 10) :
                       date?.seconds ? new Date(date.seconds * 1000).toISOString().substring(0, 10) :
                       String(date);
        return dateStr === targetDate;
      });
      
      if (dateIndex >= 0 && data.assignedRoles[dateIndex]) {
        const confirmedRole = data.assignedRoles[dateIndex];

        return confirmedRole;
      }
    }
    
    // 날짜별 매칭 실패 시 기본 확정 역할 사용
    const confirmedRole = data.assignedRole || data.confirmedRole || data.role || '';

    return confirmedRole;
  }
  
  // 지원중인 경우: 해당 날짜에 지원한 역할만 표시
  if (data.status === 'applied' || !data.status) {
    
    // 날짜별 역할 매칭 시도
    if (targetDate && data.assignedDates && data.assignedRoles &&
        Array.isArray(data.assignedDates) && Array.isArray(data.assignedRoles)) {
      // 해당 날짜의 모든 역할 수집
      const dateRoles: string[] = [];
      data.assignedDates.forEach((date: any, index: number) => {
        const dateStr = typeof date === 'string' ? date :
                       date?.toDate ? date.toDate().toISOString().substring(0, 10) :
                       date?.seconds ? new Date(date.seconds * 1000).toISOString().substring(0, 10) :
                       String(date);

        if (dateStr === targetDate && data.assignedRoles[index]) {
          dateRoles.push(data.assignedRoles[index]);
        }
      });
      
      if (dateRoles.length > 0) {
        const appliedRoles = dateRoles.join(', ');
        return appliedRoles;
      }
    }
    
    // 날짜별 매칭 실패 시 기본 지원 역할 사용 (다중 역할 처리)
    if (data.assignedRoles && Array.isArray(data.assignedRoles) && data.assignedRoles.length > 0) {
      const appliedRoles = data.assignedRoles.join(', ');
      return appliedRoles;
    }

    const appliedRole = data.assignedRole || data.role || '';
    return appliedRole;
  }
  
  // 거절된 경우
  if (data.status === 'rejected') {
    const rejectedRole = data.assignedRole || data.role || '';

    return rejectedRole;
  }
  
  // 기타 상태
  const defaultRole = data.assignedRole || data.confirmedRole || data.role || '';

  return defaultRole;
};