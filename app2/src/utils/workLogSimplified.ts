import { Timestamp } from 'firebase/firestore';

/**
 * 단순화된 WorkLog 생성 유틸리티
 *
 * 기존 복잡한 로직을 간소화하여 유지보수성 향상
 */

/**
 * WorkLog ID 생성 (표준 형식: eventId_staffId_date)
 * staffId 형식을 정규화하여 일관된 패턴 보장
 */
export const createWorkLogId = (eventId: string, staffId: string, date: string): string => {
  // 🔥 개선된 ID 생성 로직
  // staffId가 이미 assignmentIndex를 포함하는지 체크
  const hasAssignmentIndex = /_\d+$/.test(staffId);

  if (hasAssignmentIndex) {
    // 이미 assignmentIndex가 있으면 그대로 사용
    return `${eventId}_${staffId}_${date}`;
  } else {
    // assignmentIndex가 없으면 _0을 추가 (기본값)
    return `${eventId}_${staffId}_0_${date}`;
  }
};

/**
 * 여러 staffId 패턴으로 WorkLog ID 후보들 생성
 * 조회 시 여러 패턴을 시도할 수 있도록 도움
 */
export const generateWorkLogIdCandidates = (
  eventId: string,
  staffId: string,
  date: string
): string[] => {
  const candidates: string[] = [];

  // 🔥 패턴 1: staffId가 이미 완전한 형태인 경우 (예: userId_0)
  // 실제 WorkLog ID: eventId_userId_0_date
  if (/_\d+$/.test(staffId)) {
    candidates.push(`${eventId}_${staffId}_${date}`);
  }

  // 🔥 패턴 2: staffId에 _0을 추가하는 패턴 (기본값)
  // staffId: userId → WorkLog ID: eventId_userId_0_date
  candidates.push(`${eventId}_${staffId}_0_${date}`);

  // 🔥 패턴 3: 다양한 assignmentIndex 시도 (다중 날짜 할당 대응)
  for (let i = 1; i < 5; i++) {
    // 0~4 인덱스 시도
    candidates.push(`${eventId}_${staffId}_${i}_${date}`);
  }

  // 🔥 패턴 4: 레거시 패턴 (호환성)
  candidates.push(createWorkLogId(eventId, staffId, date));

  // 중복 제거 (ES5 호환)
  return Array.from(new Set(candidates));
};

/**
 * 시간 문자열을 Timestamp로 변환
 * @param timeStr "HH:mm" 형식
 * @param date "YYYY-MM-DD" 형식
 */
export const timeToTimestamp = (
  timeStr: string | null | undefined,
  date: string
): Timestamp | null => {
  if (!timeStr || timeStr === '미정') return null;

  try {
    const timeParts = timeStr.split(':').map(Number);
    if (timeParts.length !== 2) return null;

    const [hours, minutes] = timeParts;
    if (hours === undefined || minutes === undefined || isNaN(hours) || isNaN(minutes)) return null;

    const dateParts = date.split('-').map(Number);
    if (dateParts.length !== 3) return null;

    const [year, month, day] = dateParts;
    if (year === undefined || month === undefined || day === undefined) return null;

    const dateObj = new Date(year, month - 1, day, hours, minutes, 0, 0);

    return Timestamp.fromDate(dateObj);
  } catch {
    return null;
  }
};

/**
 * 시간 범위 문자열 파싱
 * @param timeRange "HH:mm-HH:mm" 또는 "HH:mm" 형식
 */
export const parseTimeRange = (
  timeRange: string | null | undefined
): { start: string | null; end: string | null } => {
  if (!timeRange || timeRange === '미정') {
    return { start: null, end: null };
  }

  if (timeRange.includes('-')) {
    const parts = timeRange.split('-').map((t) => t.trim());
    const start = parts[0] || null;
    const end = parts[1] || null;
    return { start, end };
  }

  return { start: timeRange.trim(), end: null };
};

/**
 * 단순화된 WorkLog 생성 인터페이스
 */
export interface SimpleWorkLogInput {
  eventId: string;
  staffId: string;
  staffName: string;
  role: string;
  date: string;
  timeSlot?: string | null; // "HH:mm-HH:mm" 또는 "HH:mm" 형식
  status?: 'not_started' | 'checked_in' | 'completed' | 'absent';
}

/**
 * WorkLog 데이터 생성 (Firebase 저장용)
 *
 * 기존의 복잡한 로직을 단순화:
 * - assignedTime, scheduledTime 구분 제거
 * - 직관적인 인터페이스
 * - 불필요한 변환 로직 제거
 */
export const createWorkLog = (input: SimpleWorkLogInput) => {
  const { eventId, staffId, staffName, role, date, timeSlot, status = 'not_started' } = input;
  const now = Timestamp.now();

  // 시간 파싱 및 변환
  const { start, end } = parseTimeRange(timeSlot);
  const scheduledStartTime = timeToTimestamp(start, date);
  const scheduledEndTime = timeToTimestamp(end, date);

  // 종료 시간이 시작 시간보다 이른 경우 (다음날) 처리
  if (scheduledStartTime && scheduledEndTime) {
    const startHours = scheduledStartTime.toDate().getHours();
    const endHours = scheduledEndTime.toDate().getHours();

    if (endHours < startHours) {
      // 종료 시간을 다음날로 조정
      const adjustedEnd = new Date(scheduledEndTime.toDate());
      adjustedEnd.setDate(adjustedEnd.getDate() + 1);
      return {
        eventId,
        staffId,
        staffName,
        role,
        date,
        scheduledStartTime,
        scheduledEndTime: Timestamp.fromDate(adjustedEnd),
        actualStartTime: null,
        actualEndTime: null,
        status,
        totalWorkMinutes: 0,
        totalBreakMinutes: 0,
        hoursWorked: 0,
        overtime: 0,
        createdAt: now,
        updatedAt: now,
      };
    }
  }

  return {
    eventId,
    staffId,
    staffName,
    role,
    date,
    scheduledStartTime,
    scheduledEndTime,
    actualStartTime: null,
    actualEndTime: null,
    status,
    totalWorkMinutes: 0,
    totalBreakMinutes: 0,
    hoursWorked: 0,
    overtime: 0,
    createdAt: now,
    updatedAt: now,
  };
};

/**
 * 근무 시간 계산 (시간 단위)
 */
export const calculateHoursWorked = (
  startTime: Timestamp | null,
  endTime: Timestamp | null
): number => {
  if (!startTime || !endTime) return 0;

  const start = startTime.toDate();
  const end = endTime.toDate();
  const diffMs = end.getTime() - start.getTime();

  // 음수인 경우 (다음날로 넘어간 경우) 처리
  if (diffMs < 0) {
    const adjustedEnd = new Date(end);
    adjustedEnd.setDate(adjustedEnd.getDate() + 1);
    const adjustedDiffMs = adjustedEnd.getTime() - start.getTime();
    return Math.round((adjustedDiffMs / (1000 * 60 * 60)) * 100) / 100;
  }

  return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
};

/**
 * WorkLog 업데이트 준비 결과 타입
 */
interface WorkLogUpdateData extends Omit<Partial<SimpleWorkLogInput>, 'timeSlot'> {
  actualStartTime?: Timestamp | null;
  actualEndTime?: Timestamp | null;
  scheduledStartTime?: Timestamp | null;
  scheduledEndTime?: Timestamp | null;
  hoursWorked?: number;
  totalWorkMinutes?: number;
  updatedAt: Timestamp;
}

/**
 * WorkLog 업데이트 데이터 준비
 */
export const prepareWorkLogUpdate = (
  updates: Partial<SimpleWorkLogInput> & {
    actualStartTime?: Timestamp | null;
    actualEndTime?: Timestamp | null;
  }
): WorkLogUpdateData => {
  const { timeSlot, ...restUpdates } = updates;
  const prepared: WorkLogUpdateData = {
    ...restUpdates,
    updatedAt: Timestamp.now(),
  };

  // 시간 필드 업데이트
  if (timeSlot !== undefined && updates.date) {
    const { start, end } = parseTimeRange(timeSlot);
    prepared.scheduledStartTime = timeToTimestamp(start, updates.date);
    prepared.scheduledEndTime = timeToTimestamp(end, updates.date);
  }

  // 근무 시간 재계산
  if (prepared.actualStartTime && prepared.actualEndTime) {
    prepared.hoursWorked = calculateHoursWorked(prepared.actualStartTime, prepared.actualEndTime);
    prepared.totalWorkMinutes = Math.round(prepared.hoursWorked * 60);
  }

  return prepared;
};

/**
 * 🚀 createVirtualWorkLog 제거됨 - 스태프 확정 시 WorkLog 사전 생성으로 대체
 * 가상 WorkLog는 더 이상 사용하지 않습니다.
 */
