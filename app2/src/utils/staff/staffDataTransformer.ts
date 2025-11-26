/**
 * staffDataTransformer.ts
 * WorkLog 데이터를 StaffData 형식으로 변환하는 유틸리티 함수
 *
 * @version 1.0
 * @since 2025-02-04
 */

import type { WorkLog } from '../../types/unifiedData';
import type { JobPosting } from '../../types/jobPosting/jobPosting';
import { logger } from '../logger';

export interface StaffData {
  id: string;
  userId: string;
  staffId: string;
  name: string;
  role?: string;
  assignedRole?: string;
  assignedTime?: string;
  assignedDate?: string;
  status?: string;
  // 연락처 정보
  phone?: string;
  email?: string;
  // 지원자 확정 정보
  postingId?: string;
  postingTitle?: string;
  // 추가 개인정보
  gender?: string;
  age?: number;
  experience?: string;
  nationality?: string;
  region?: string;
  history?: string;
  notes?: string;
  // 은행 정보
  bankName?: string;
  bankAccount?: string;
}

/**
 * WorkLog 컬렉션을 StaffData 배열로 변환
 * 중복 제거 및 최신 정보 유지
 */
export function transformWorkLogsToStaffData(
  workLogs: Map<string, WorkLog>,
  jobPostings: Map<string, JobPosting>,
  currentJobPostingId?: string
): StaffData[] {
  if (!workLogs || workLogs.size === 0 || !currentJobPostingId) {
    logger.info('🔍 [transformWorkLogsToStaffData] Early return', {
      component: 'staffDataTransformer',
      data: {
        hasWorkLogs: !!workLogs,
        workLogsSize: workLogs?.size || 0,
        currentJobPostingId,
      },
    });
    return [];
  }

  // WorkLog에서 고유한 스태프 정보 추출 (중복 제거)
  const staffMap = new Map<string, StaffData>();

  // 디버깅: eventId별 WorkLog 통계 (eventId 추출 로직 적용)
  const workLogsByEvent = new Map<string, number>();
  Array.from(workLogs.values()).forEach((wl) => {
    let eventId = wl.eventId;

    // eventId가 없으면 ID에서 추출
    if (!eventId && wl.id) {
      const datePattern = /(\d{4}-\d{2}-\d{2})$/;
      const dateMatch = wl.id.match(datePattern);
      if (dateMatch) {
        const withoutDate = wl.id.replace(`_${dateMatch[1]}`, '');
        const firstUnderscoreIndex = withoutDate.indexOf('_');
        if (firstUnderscoreIndex > 0) {
          eventId = withoutDate.substring(0, firstUnderscoreIndex);
        }
      }
    }

    if (eventId) {
      const count = workLogsByEvent.get(eventId) || 0;
      workLogsByEvent.set(eventId, count + 1);
    }
  });

  logger.info('🔍 [transformWorkLogsToStaffData] WorkLog 분석', {
    component: 'staffDataTransformer',
    data: {
      totalWorkLogs: workLogs.size,
      currentJobPostingId,
      workLogsByEvent: Object.fromEntries(workLogsByEvent),
      matchingWorkLogs: workLogsByEvent.get(currentJobPostingId) || 0,
    },
  });

  Array.from(workLogs.values()).forEach((workLog) => {
    // ✅ eventId 필터링 - 현재 공고의 WorkLog만 처리
    // 🔧 eventId가 없는 경우 WorkLog ID에서 추출 시도
    let eventId = workLog.eventId;

    if (!eventId && workLog.id) {
      // WorkLog ID 형식: {eventId}_{staffId}_{date}
      // 예: PUXhDb46VSQSdggQnwOw_HPjouZZmvQYHBvGVm6ZKKFgENOR2_0_2025-10-23
      // 마지막 부분이 YYYY-MM-DD 형식의 날짜이므로 날짜 패턴으로 분리
      const datePattern = /(\d{4}-\d{2}-\d{2})$/;
      const dateMatch = workLog.id.match(datePattern);

      if (dateMatch) {
        // 날짜 부분 제거: PUXhDb46VSQSdggQnwOw_HPjouZZmvQYHBvGVm6ZKKFgENOR2_0
        const withoutDate = workLog.id.replace(`_${dateMatch[1]}`, '');
        // 첫 번째 언더스코어까지가 eventId
        const firstUnderscoreIndex = withoutDate.indexOf('_');
        if (firstUnderscoreIndex > 0) {
          eventId = withoutDate.substring(0, firstUnderscoreIndex);
          logger.info('🔧 [transformWorkLogsToStaffData] eventId 추출', {
            component: 'staffDataTransformer',
            data: {
              workLogId: workLog.id,
              extractedEventId: eventId,
            },
          });
        }
      }
    }

    if (eventId !== currentJobPostingId) return;

    const staffInfo = workLog.staffInfo;
    const assignmentInfo = workLog.assignmentInfo;

    if (!staffInfo || !assignmentInfo) return;

    const staffId = workLog.staffId;

    // 이미 존재하는 스태프라면 추가 정보만 업데이트
    if (!staffMap.has(staffId)) {
      // 🔧 staffId에서 실제 userId 추출 (복합 ID인 경우)
      // userId_sequenceNumber 형식에서 뒤의 숫자 제거
      const extractedUserId = staffId.includes('_')
        ? staffId.replace(/_\d+$/, '') // 끝의 _숫자 패턴 제거
        : staffId;

      const staffData: StaffData = {
        id: staffId,
        userId: staffInfo.userId || extractedUserId,
        staffId: staffId,
        name: staffInfo.name || '이름 미정',
        role: assignmentInfo.role || '',
        // 지원자 확정 정보 (WorkLog.assignmentInfo에서)
        assignedRole: assignmentInfo.assignedRole || assignmentInfo.role || '',
        assignedTime: assignmentInfo.assignedTime || '',
        // 🔧 assignedDate 대신 workLog.date 사용 (더 정확한 날짜)
        assignedDate: workLog.date || assignmentInfo.assignedDate || '',
        // 원래 지원 정보
        postingId: assignmentInfo.postingId,
        postingTitle: jobPostings.get(assignmentInfo.postingId)?.title || '알 수 없는 공고',
        // 기타
        status: staffInfo.isActive ? 'active' : 'inactive',
      };

      // 선택적 필드는 조건부로 추가 (exactOptionalPropertyTypes 지원)
      if (staffInfo.phone) staffData.phone = staffInfo.phone;
      if (staffInfo.email) staffData.email = staffInfo.email;
      if (staffInfo.gender) staffData.gender = staffInfo.gender;
      if (staffInfo.age) staffData.age = staffInfo.age;
      if (staffInfo.experience) staffData.experience = staffInfo.experience;
      if (staffInfo.nationality) staffData.nationality = staffInfo.nationality;
      if (staffInfo.region) staffData.region = staffInfo.region;
      if (staffInfo.bankName) staffData.bankName = staffInfo.bankName;
      if (staffInfo.accountNumber) staffData.bankAccount = staffInfo.accountNumber;

      staffMap.set(staffId, staffData);
    }
  });

  const result = Array.from(staffMap.values());

  logger.info('🔍 [transformWorkLogsToStaffData] 변환 결과', {
    component: 'staffDataTransformer',
    data: {
      staffCount: result.length,
      staffIds: result.map((s) => s.id),
      staffNames: result.map((s) => s.name),
    },
  });

  return result;
}

/**
 * 고유한 스태프 수 계산 (이름 기준 중복 제거)
 */
export function getUniqueStaffCount(staffData: StaffData[]): number {
  const uniqueNames = new Set(staffData.map((staff) => staff.name));
  return uniqueNames.size;
}

/**
 * staffId에서 실제 userId 추출
 * userId_sequenceNumber 형식 처리
 */
export function extractUserIdFromStaffId(staffId: string): string {
  return staffId.includes('_') ? staffId.replace(/_\d+$/, '') : staffId;
}

/**
 * staffId에서 날짜 부분 제거
 * staffId_YYYY-MM-DD 형식 처리
 */
export function removeStaffIdDateSuffix(staffId: string): string {
  return staffId.replace(/_\d{4}-\d{2}-\d{2}$/, '');
}
