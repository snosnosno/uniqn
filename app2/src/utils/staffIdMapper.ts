/**
 * 스태프 식별자 매핑 유틸리티
 * staffId와 userId 불일치 문제를 해결하기 위한 통합 매핑 함수
 */

/**
 * 스태프 객체에서 고유 식별자 추출
 * staffId, userId, id 순서로 체크하여 첫 번째 유효한 값 반환
 */
export function getStaffIdentifier(staff: any): string {
  if (!staff) return '';
  return staff.staffId || staff.userId || staff.id || '';
}

/**
 * WorkLog가 특정 스태프 식별자들과 매칭되는지 확인
 * WorkLog의 staffId 또는 userId가 주어진 식별자 목록에 포함되는지 체크
 */
export function matchStaffIdentifier(log: any, staffIdentifiers: string[]): boolean {
  if (!log || !staffIdentifiers || staffIdentifiers.length === 0) return false;
  
  const logId = log.staffId || log.userId || '';
  if (!logId) return false;
  
  return staffIdentifiers.includes(logId);
}

/**
 * 두 스태프 객체가 같은 사람인지 확인
 * staffId, userId, id 중 하나라도 일치하면 같은 사람으로 판단
 */
export function isSameStaff(staff1: any, staff2: any): boolean {
  if (!staff1 || !staff2) return false;
  
  const id1 = getStaffIdentifier(staff1);
  const id2 = getStaffIdentifier(staff2);
  
  if (id1 && id2 && id1 === id2) return true;
  
  // 추가 체크: 하나는 staffId, 다른 하나는 userId를 사용하는 경우
  if (staff1.staffId && staff2.userId && staff1.staffId === staff2.userId) return true;
  if (staff1.userId && staff2.staffId && staff1.userId === staff2.staffId) return true;
  
  return false;
}

/**
 * 스태프 목록에서 중복 제거
 * 같은 사람이 여러 번 포함된 경우 하나만 유지
 */
export function getUniqueStaffIdentifiers(staffList: any[]): string[] {
  if (!staffList || staffList.length === 0) return [];
  
  const uniqueIds = new Set<string>();
  
  staffList.forEach(staff => {
    const id = getStaffIdentifier(staff);
    if (id) {
      uniqueIds.add(id);
    }
  });
  
  return Array.from(uniqueIds);
}