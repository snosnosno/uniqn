import { useState, useMemo } from 'react';
import {
  Timestamp,
  collection,
  query,
  where,
  type Query,
  type DocumentData,
} from 'firebase/firestore';

import { logger } from '../utils/logger';
import type { AttendanceStatus } from '../types/attendance';
import { formatTime } from '../utils/dateUtils';
import { getTodayString } from '../utils/jobPosting/dateUtils';
import { db } from '../firebase';
import { useFirestoreQuery } from './firestore';

import { WorkLog } from './useShiftSchedule';

/**
 * UI 표시용 출석 기록 인터페이스
 * @description useAttendanceStatus 훅에서 사용하는 UI용 출석 데이터 구조
 * @see types/attendance.ts의 AttendanceRecord와 구분 (Firestore 저장용)
 */
export interface AttendanceDisplayRecord {
  staffId: string;
  workLogId?: string; // WorkLog ID 추가 (출석상태 드롭다운에서 사용)
  status: AttendanceStatus;
  actualStartTime?: string | undefined;
  actualEndTime?: string | undefined;
  scheduledStartTime?: string | undefined;
  scheduledEndTime?: string | undefined;
  workLog?: WorkLog;
}

/** @deprecated AttendanceDisplayRecord 사용 권장 */
export type AttendanceRecord = AttendanceDisplayRecord;

interface UseAttendanceStatusProps {
  eventId?: string;
  date?: string; // YYYY-MM-DD format
}

export const useAttendanceStatus = ({ eventId, date }: UseAttendanceStatusProps) => {
  // Optimistic update를 위한 로컬 업데이트 상태
  const [localUpdates, setLocalUpdates] = useState<Map<string, AttendanceStatus>>(new Map());

  // 현재 날짜를 기본값으로 사용 (로컬 타임존 기준)
  const currentDate = date || getTodayString();
  const currentEventId = eventId || 'default-event';

  // Optimistic update 함수
  const applyOptimisticUpdate = (workLogId: string, newStatus: AttendanceStatus) => {
    setLocalUpdates((prev) => {
      const newMap = new Map(prev);
      newMap.set(workLogId, newStatus);
      return newMap;
    });
  };

  // Firestore 쿼리 생성 (메모이제이션)
  const workLogsQuery = useMemo((): Query<DocumentData> | null => {
    if (!currentEventId) return null;

    let q = query(collection(db, 'workLogs'), where('eventId', '==', currentEventId));

    // 날짜 필터링 (옵션)
    if (date) {
      q = query(q, where('date', '==', date));
    }

    return q;
  }, [currentEventId, date]);

  // useFirestoreQuery로 구독
  const {
    data: rawWorkLogs,
    loading,
    error: hookError,
  } = useFirestoreQuery<Omit<WorkLog, 'id'>>(
    workLogsQuery || query(collection(db, 'workLogs'), where('__name__', '==', '__non_existent__')),
    {
      enabled: workLogsQuery !== null,
      onSuccess: () => {
        logger.debug('출석 기록 실시간 업데이트', {
          component: 'useAttendanceStatus',
          data: { count: rawWorkLogs.length, eventId: currentEventId },
        });
      },
      onError: (err) => {
        logger.error('출석 기록 구독 오류', err, {
          component: 'useAttendanceStatus',
        });
      },
    }
  );

  // WorkLogs를 AttendanceRecords로 변환 + Optimistic Update 적용
  const attendanceRecords = useMemo(() => {
    if (!rawWorkLogs || rawWorkLogs.length === 0) {
      return [];
    }

    try {
      const records: AttendanceDisplayRecord[] = [];
      const typedWorkLogs = rawWorkLogs.map((doc) => doc as unknown as WorkLog);

      typedWorkLogs.forEach((workLog) => {
        // localUpdates에 있는 경우 해당 상태 사용
        const localStatus = workLog.id ? localUpdates.get(workLog.id) : undefined;
        const attendanceRecord = calculateAttendanceStatus(workLog);

        if (localStatus) {
          attendanceRecord.status = localStatus;
        }

        records.push(attendanceRecord);
      });

      return records;
    } catch (err) {
      logger.error('출석 상태 계산 오류', err as Error, {
        component: 'useAttendanceStatus',
      });
      return [];
    }
  }, [rawWorkLogs, localUpdates]);

  // WorkLog 데이터로부터 출석 상태를 계산하는 함수
  const calculateAttendanceStatus = (workLog: WorkLog): AttendanceDisplayRecord => {
    const _now = new Date();
    const currentTime = _now.toTimeString().substring(0, 5); // HH:MM format

    let status: AttendanceStatus = 'not_started';

    // workLog의 status 필드가 있으면 우선 사용 (수동 출석 상태 변경을 반영)
    if (workLog.status) {
      if (['not_started', 'checked_in', 'checked_out'].includes(workLog.status)) {
        status = workLog.status as AttendanceStatus;
      }
    } else {
      // status 필드가 없거나 유효하지 않은 경우 실제 출퇴근 시간으로 계산
      const hasActualStartTime = !!workLog.actualStartTime;
      const hasActualEndTime = !!workLog.actualEndTime;

      if (hasActualStartTime && hasActualEndTime) {
        status = 'checked_out';
      } else if (hasActualStartTime) {
        status = 'checked_in';
      } else {
        // 실제 기록이 없는 경우 - 스케줄 기반으로 상태 판단
        const scheduledStart = workLog.scheduledStartTime;
        const scheduledEnd = workLog.scheduledEndTime;

        if (scheduledStart && scheduledEnd) {
          if (currentTime < scheduledStart) {
            status = 'not_started';
          } else if (currentTime >= scheduledStart && currentTime < scheduledEnd) {
            status = 'not_started'; // 예정 시간은 지났지만 실제 출근 기록이 없으면 출근 전
          } else {
            status = 'not_started'; // 예정 종료 시간도 지난 경우
          }
        }
      }
    }

    // formatTime 함수를 사용하여 시간 문자열 변환 (이미 import됨)
    const formatTimeFromTimestamp = (
      timestamp:
        | Timestamp
        | { seconds: number; nanoseconds: number }
        | Date
        | string
        | null
        | undefined
    ): string | undefined => {
      if (!timestamp) return undefined;

      // 문자열인 경우 이미 HH:MM 형식이면 그대로 반환
      if (typeof timestamp === 'string' && timestamp.includes(':') && timestamp.length <= 8) {
        return timestamp.substring(0, 5);
      }

      // 통합된 formatTime 함수 사용
      const formatted = formatTime(timestamp, { defaultValue: '' });
      return formatted || undefined;
    };

    const staffId = workLog.staffId;

    return {
      staffId: staffId || '',
      ...(workLog.id && { workLogId: workLog.id }), // WorkLog ID 추가 (출석상태 드롭다운에서 사용)
      status,
      ...(formatTimeFromTimestamp(workLog.actualStartTime) && {
        actualStartTime: formatTimeFromTimestamp(workLog.actualStartTime),
      }),
      ...(formatTimeFromTimestamp(workLog.actualEndTime) && {
        actualEndTime: formatTimeFromTimestamp(workLog.actualEndTime),
      }),
      ...(formatTimeFromTimestamp(workLog.scheduledStartTime) && {
        scheduledStartTime: formatTimeFromTimestamp(workLog.scheduledStartTime),
      }),
      ...(formatTimeFromTimestamp(workLog.scheduledEndTime) && {
        scheduledEndTime: formatTimeFromTimestamp(workLog.scheduledEndTime),
      }),
      workLog,
    };
  };

  // applyOptimisticUpdate 함수는 이미 위에 정의되어 있으므로 중복 제거
  // 3초 후 로컬 업데이트 제거 기능 추가
  const _clearOptimisticUpdate = (workLogId: string) => {
    setTimeout(() => {
      setLocalUpdates((prev) => {
        const newMap = new Map(prev);
        newMap.delete(workLogId);
        return newMap;
      });
    }, 3000);
  };

  // 특정 스태프의 출석 상태를 가져오는 함수 - workLogId 기반으로 검색
  const getStaffAttendanceStatus = (
    staffIdOrWorkLogId: string
  ): AttendanceDisplayRecord | undefined => {
    // workLogId로 먼저 검색 시도 (virtual_ 접두사 포함)
    if (staffIdOrWorkLogId.includes('virtual_') || staffIdOrWorkLogId.includes('_')) {
      // workLogId로 검색
      const record = attendanceRecords.find((record) => record.workLogId === staffIdOrWorkLogId);

      if (record) {
        return record;
      }

      // virtual_ 형식인 경우 실제 workLogId 매칭 시도
      if (staffIdOrWorkLogId.startsWith('virtual_')) {
        // virtual_tURgdOBmtYfO5Bgzm8NyGKGtbL12_2025-07-29 형식 파싱
        const virtualPattern = /^virtual_(.+?)_(\d{4}-\d{2}-\d{2})$/;
        const match = staffIdOrWorkLogId.match(virtualPattern);

        if (match) {
          const staffId = match[1];
          const date = match[2];

          const matchedRecord = attendanceRecords.find((record) => {
            const recordStaffId = record.staffId || record.workLog?.staffId;
            const isStaffMatch = recordStaffId === staffId;
            const isDateMatch = record.workLog?.date === date;
            const isMatch = isStaffMatch && isDateMatch;

            return isMatch;
          });

          if (matchedRecord) {
            return matchedRecord;
          } else {
          }
        } else {
        }
      }
    }

    // staffId로 fallback 검색 (이전 호환성 유지)
    const baseStaffId = staffIdOrWorkLogId.match(/^(.+?)(_\d+)?$/)?.[1] || staffIdOrWorkLogId;

    // virtual ID가 포함된 경우 날짜 정보 추출 시도
    let targetDate: string | null = null;
    if (staffIdOrWorkLogId.includes('virtual_')) {
      const dateMatch = staffIdOrWorkLogId.match(/(\d{4}-\d{2}-\d{2})$/);
      if (dateMatch && dateMatch[1]) {
        targetDate = dateMatch[1];
      }
    }

    const fallbackRecord = attendanceRecords.find((record) => {
      const isStaffMatch = record.staffId === staffIdOrWorkLogId || record.staffId === baseStaffId;

      // 날짜 정보가 있으면 날짜도 매칭
      if (targetDate && record.workLog?.date) {
        return isStaffMatch && record.workLog.date === targetDate;
      }

      return isStaffMatch;
    });

    return fallbackRecord || undefined;
  };

  // 출석 상태별 통계를 계산하는 함수
  const getAttendanceStats = () => {
    const stats = {
      total: attendanceRecords.length,
      notStarted: 0,
      checkedIn: 0,
      checkedOut: 0,
    };

    attendanceRecords.forEach((record) => {
      switch (record.status) {
        case 'not_started':
          stats.notStarted++;
          break;
        case 'checked_in':
          stats.checkedIn++;
          break;
        case 'checked_out':
          stats.checkedOut++;
          break;
      }
    });

    return stats;
  };

  return {
    attendanceRecords,
    loading,
    error: hookError ? hookError.message : null,
    getStaffAttendanceStatus,
    getAttendanceStats,
    currentDate,
    currentEventId,
    applyOptimisticUpdate,
  };
};
