import { Timestamp } from 'firebase/firestore';

/**
 * WorkSession 인터페이스
 * 같은 사람이 같은 날짜에 여러 역할/시간대로 근무 가능
 */
export interface WorkSession {
  // 기본 식별 정보
  id: string;
  personId: string; // Person.id 참조
  personName: string; // 캐시용

  // 날짜 및 세션 정보
  workDate: string; // yyyy-MM-dd 형식
  sessionNumber: number; // 같은 날짜 내 순서 (1, 2, 3...)

  // 역할 및 시간
  role: string; // 이 세션의 역할 (딜러, 매니저 등)
  scheduledStartTime: string; // HH:mm
  scheduledEndTime: string; // HH:mm
  actualStartTime?: string; // HH:mm
  actualEndTime?: string; // HH:mm

  // 이벤트 정보
  eventId: string;
  eventName: string;
  location?: string;

  // 상태
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  attendanceStatus?: 'not_started' | 'checked_in' | 'checked_out';

  // 급여 정보
  hourlyRate?: number;
  totalHours?: number;
  totalPay?: number;
  isPaid?: boolean;
  paidAt?: Timestamp;

  // 메타데이터
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string;
  updatedBy?: string;

  // 기존 workLog와의 호환성
  workLogId?: string; // 기존 workLog 참조 (마이그레이션용)
  applicationId?: string; // 지원서 참조

  // 추가 정보
  notes?: string;
  metadata?: {
    [key: string]: any;
  };
}

/**
 * WorkSession 생성 입력
 */
export interface WorkSessionCreateInput {
  personId: string;
  personName: string;
  workDate: string;
  role: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  eventId: string;
  eventName: string;
  location?: string;
  applicationId?: string;
  notes?: string;
}

/**
 * WorkSession 업데이트 입력
 */
export interface WorkSessionUpdateInput {
  role?: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  actualStartTime?: string;
  actualEndTime?: string;
  status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  attendanceStatus?: 'not_started' | 'checked_in' | 'checked_out';
  hourlyRate?: number;
  totalHours?: number;
  totalPay?: number;
  isPaid?: boolean;
  notes?: string;
}

/**
 * WorkSession 필터
 */
export interface WorkSessionFilter {
  personId?: string;
  workDate?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  eventId?: string;
  role?: string;
  status?: string;
  isPaid?: boolean;
}

/**
 * 같은 날짜의 세션들을 그룹화
 */
export interface WorkSessionGroup {
  date: string;
  personId: string;
  personName: string;
  sessions: WorkSession[];
  totalHours: number;
  totalPay: number;
  roles: string[]; // 이 날짜의 모든 역할
}

/**
 * WorkSession 유틸리티 함수들
 */

/**
 * 세션 번호 자동 생성
 */
export function getNextSessionNumber(
  existingSessions: WorkSession[],
  personId: string,
  workDate: string
): number {
  const sameDaySessions = existingSessions.filter(
    (s) => s.personId === personId && s.workDate === workDate
  );

  if (sameDaySessions.length === 0) return 1;

  const maxNumber = Math.max(...sameDaySessions.map((s) => s.sessionNumber));
  return maxNumber + 1;
}

/**
 * 세션 시간 겹침 체크
 */
export function checkTimeOverlap(
  session1: { scheduledStartTime: string; scheduledEndTime: string },
  session2: { scheduledStartTime: string; scheduledEndTime: string }
): boolean {
  const start1 = timeToMinutes(session1.scheduledStartTime);
  const end1 = timeToMinutes(session1.scheduledEndTime);
  const start2 = timeToMinutes(session2.scheduledStartTime);
  const end2 = timeToMinutes(session2.scheduledEndTime);

  return !(end1 <= start2 || end2 <= start1);
}

/**
 * HH:mm을 분으로 변환
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/**
 * 세션들을 날짜별로 그룹화
 */
export function groupSessionsByDate(sessions: WorkSession[]): WorkSessionGroup[] {
  const groups = new Map<string, WorkSessionGroup>();

  sessions.forEach((session) => {
    const key = `${session.personId}-${session.workDate}`;

    if (!groups.has(key)) {
      groups.set(key, {
        date: session.workDate,
        personId: session.personId,
        personName: session.personName,
        sessions: [],
        totalHours: 0,
        totalPay: 0,
        roles: [],
      });
    }

    const group = groups.get(key)!;
    group.sessions.push(session);
    group.totalHours += session.totalHours || 0;
    group.totalPay += session.totalPay || 0;

    if (!group.roles.includes(session.role)) {
      group.roles.push(session.role);
    }
  });

  // 날짜 순으로 정렬
  return Array.from(groups.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 기존 workLog와의 호환성 변환
 */
export function sessionToWorkLog(session: WorkSession): any {
  return {
    id: session.workLogId || session.id,
    staffId: session.personId, // 하위 호환성
    personId: session.personId,
    staffName: session.personName,
    date: session.workDate,
    role: session.role,
    scheduledStartTime: session.scheduledStartTime,
    scheduledEndTime: session.scheduledEndTime,
    actualStartTime: session.actualStartTime,
    actualEndTime: session.actualEndTime,
    status: session.status,
    eventId: session.eventId,
    eventName: session.eventName,
    location: session.location,
    hourlyRate: session.hourlyRate,
    totalHours: session.totalHours,
    totalPay: session.totalPay,
    isPaid: session.isPaid,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

/**
 * workLog를 session으로 변환
 */
export function workLogToSession(workLog: any, sessionNumber: number = 1): WorkSession {
  return {
    id: workLog.id,
    personId: workLog.personId || workLog.staffId,
    personName: workLog.staffName || workLog.personName || '',
    workDate: workLog.date,
    sessionNumber,
    role: workLog.role || '딜러',
    scheduledStartTime: workLog.scheduledStartTime || '',
    scheduledEndTime: workLog.scheduledEndTime || '',
    actualStartTime: workLog.actualStartTime,
    actualEndTime: workLog.actualEndTime,
    status: workLog.status || 'scheduled',
    attendanceStatus: workLog.attendanceStatus,
    eventId: workLog.eventId || '',
    eventName: workLog.eventName || '',
    location: workLog.location,
    hourlyRate: workLog.hourlyRate,
    totalHours: workLog.totalHours,
    totalPay: workLog.totalPay,
    isPaid: workLog.isPaid,
    paidAt: workLog.paidAt,
    createdAt: workLog.createdAt || Timestamp.now(),
    updatedAt: workLog.updatedAt || Timestamp.now(),
    workLogId: workLog.id,
    applicationId: workLog.applicationId,
    notes: workLog.notes,
    metadata: workLog.metadata,
  };
}
