import { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';

import { logger } from '../utils/logger';
import { AttendanceStatus } from '../components/AttendanceStatusCard';
import { formatTime } from '../utils/dateUtils';
import { safeOnSnapshot } from '../utils/firebaseConnectionManager';
import { getTodayString } from '../utils/jobPosting/dateUtils';

import { WorkLog } from './useShiftSchedule';

export interface AttendanceRecord {
  staffId: string;
  workLogId?: string; // WorkLog ID 추가 (출석상태 드롭다운에서 사용)
  status: AttendanceStatus;
  actualStartTime?: string | undefined;
  actualEndTime?: string | undefined;
  /** @deprecated - actualStartTime 사용 권장. 하위 호환성을 위해 유지 */
  checkInTime?: string | undefined;
  /** @deprecated - actualEndTime 사용 권장. 하위 호환성을 위해 유지 */
  checkOutTime?: string | undefined;
  scheduledStartTime?: string | undefined;
  scheduledEndTime?: string | undefined;
  workLog?: WorkLog;
}

interface UseAttendanceStatusProps {
  eventId?: string;
  date?: string; // YYYY-MM-DD format
}

export const useAttendanceStatus = ({ eventId, date }: UseAttendanceStatusProps) => {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Optimistic update를 위한 로컬 업데이트 상태
  const [_localUpdates, setLocalUpdates] = useState<Map<string, AttendanceStatus>>(new Map());

  // 현재 날짜를 기본값으로 사용 (로컬 타임존 기준)
  const currentDate = date || getTodayString();
  const currentEventId = eventId || 'default-event';

  useEffect(() => {
    if (!currentEventId || !currentDate) {
      setLoading(false);
      return () => {};
    }

    try {
      // workLogs 컬렉션에서 해당 이벤트의 기록들을 실시간으로 구독
      // 날짜 필터를 제거하고 eventId만으로 필터링하여 모든 workLogs를 가져옴
      
      // safeOnSnapshot을 사용하여 안전한 리스너 설정
      const unsubscribe = safeOnSnapshot<WorkLog>(
        'workLogs',
        (workLogs) => {
          try {
            const records: AttendanceRecord[] = [];
            
            // eventId로 필터링 - 현재 eventId와 일치하는 것만
            const filteredWorkLogs = workLogs.filter(workLog => 
              workLog.eventId === currentEventId
            );
            
            // logger.debug 제거 - 성능 최적화
            
            // workLogs 처리
            filteredWorkLogs.forEach((workLog) => {
              const attendanceRecord = calculateAttendanceStatus(workLog);
              records.push(attendanceRecord);
            });

            // 이전 상태와 비교하여 변경사항 감지
            const prevRecordsMap = new Map(attendanceRecords.map(r => [r.workLogId, r.status]));
            const _changedRecords = records.filter(r => {
              const prevStatus = prevRecordsMap.get(r.workLogId);
              return prevStatus && prevStatus !== r.status;
            });

            // logger.debug 제거 - 성능 최적화 (매번 호출되므로 성능 저하 원인)

            // 항상 새로운 배열로 설정하여 React가 변경을 감지하도록 함
            setAttendanceRecords([...records]);
            setError(null);
          } catch (err) {
            logger.error('출석 상태 계산 오류:', err instanceof Error ? err : new Error(String(err)), { component: 'useAttendanceStatus' });
            setError('출석 상태를 계산하는 중 오류가 발생했습니다.');
          } finally {
            setLoading(false);
          }
        },
        (err) => {
          logger.error('출석 기록 구독 오류:', err instanceof Error ? err : new Error(String(err)), { component: 'useAttendanceStatus' });
          setError('출석 기록을 불러오는 중 오류가 발생했습니다.');
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      logger.error('출석 상태 훅 초기화 오류:', err instanceof Error ? err : new Error(String(err)), { component: 'useAttendanceStatus' });
      setError('출석 상태 시스템을 초기화하는 중 오류가 발생했습니다.');
      setLoading(false);
      return () => {};
    }
  }, [currentEventId, currentDate]);

  // WorkLog 데이터로부터 출석 상태를 계산하는 함수
  const calculateAttendanceStatus = (workLog: WorkLog): AttendanceRecord => {
    const _now = new Date();
    const currentTime = _now.toTimeString().substring(0, 5); // HH:MM format

    let status: AttendanceStatus = 'not_started';
    
    // workLog의 status 필드가 있으면 우선 사용 (수동 출석 상태 변경을 반영)
    if (workLog.status && ['not_started', 'checked_in', 'checked_out'].includes(workLog.status)) {
      status = workLog.status as AttendanceStatus;
      // logger.debug 제거 - 성능 최적화
    } else {
      // status 필드가 없거나 유효하지 않은 경우 실제 출퇴근 시간으로 계산
      const hasActualStartTime = !!(workLog.actualStartTime);
      const hasActualEndTime = !!(workLog.actualEndTime);
      
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
      
      // logger.debug 제거 - 성능 최적화
    }

    // formatTime 함수를 사용하여 시간 문자열 변환 (이미 import됨)
    const formatTimeFromTimestamp = (timestamp: Timestamp | { seconds: number; nanoseconds: number } | Date | string | null | undefined): string | undefined => {
      if (!timestamp) return undefined;
      
      // 문자열인 경우 이미 HH:MM 형식이면 그대로 반환
      if (typeof timestamp === 'string' && timestamp.includes(':') && timestamp.length <= 8) {
        return timestamp.substring(0, 5);
      }
      
      // 통합된 formatTime 함수 사용
      const formatted = formatTime(timestamp, { defaultValue: '' });
      return formatted || undefined;
    };

    // staffId 우선, dealerId는 하위 호환성을 위해 fallback
    const staffId = workLog.staffId || workLog.dealerId;

    return {
      staffId: staffId || '',
      ...(workLog.id && { workLogId: workLog.id }), // WorkLog ID 추가 (출석상태 드롭다운에서 사용)
      status,
      ...(formatTimeFromTimestamp(workLog.actualStartTime) && { actualStartTime: formatTimeFromTimestamp(workLog.actualStartTime) }),
      ...(formatTimeFromTimestamp(workLog.actualEndTime) && { actualEndTime: formatTimeFromTimestamp(workLog.actualEndTime) }),
      // 하위 호환성을 위한 fallback
      ...(formatTimeFromTimestamp(workLog.actualStartTime) && { checkInTime: formatTimeFromTimestamp(workLog.actualStartTime) }),
      ...(formatTimeFromTimestamp(workLog.actualEndTime) && { checkOutTime: formatTimeFromTimestamp(workLog.actualEndTime) }),
      ...(formatTimeFromTimestamp(workLog.scheduledStartTime) && { scheduledStartTime: formatTimeFromTimestamp(workLog.scheduledStartTime) }),
      ...(formatTimeFromTimestamp(workLog.scheduledEndTime) && { scheduledEndTime: formatTimeFromTimestamp(workLog.scheduledEndTime) }),
      workLog
    };
  };

  // Optimistic update를 위한 함수
  const applyOptimisticUpdate = (workLogId: string, newStatus: AttendanceStatus) => {
    // logger.debug 제거 - 성능 최적화
    
    // 로컬 업데이트 맵에 추가
    setLocalUpdates(prev => {
      const newMap = new Map(prev);
      newMap.set(workLogId, newStatus);
      return newMap;
    });
    
    // 즉시 attendanceRecords 업데이트
    setAttendanceRecords(prev => {
      return prev.map(record => {
        if (record.workLogId === workLogId) {
          // logger.debug 제거 - 성능 최적화
          return {
            ...record,
            status: newStatus
          };
        }
        return record;
      });
    });
    
    // 3초 후 로컬 업데이트 제거 (Firebase 업데이트가 반영될 시간)
    setTimeout(() => {
      setLocalUpdates(prev => {
        const newMap = new Map(prev);
        newMap.delete(workLogId);
        return newMap;
      });
    }, 3000);
  };

  // 특정 스태프의 출석 상태를 가져오는 함수 - workLogId 기반으로 검색
  const getStaffAttendanceStatus = (staffIdOrWorkLogId: string): AttendanceRecord | undefined => {
    // logger.debug 제거 - 성능 최적화 (매번 호출되므로 성능 저하 원인)

    // workLogId로 먼저 검색 시도 (virtual_ 접두사 포함)
    if (staffIdOrWorkLogId.includes('virtual_') || staffIdOrWorkLogId.includes('_')) {
      // workLogId로 검색
      const record = attendanceRecords.find(record => record.workLogId === staffIdOrWorkLogId);
      
      if (record) {
        // logger.debug 제거 - 성능 최적화
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
          
          // logger.debug 제거 - 성능 최적화
          
          const matchedRecord = attendanceRecords.find(record => {
            // staffId 우선, dealerId는 하위 호환성을 위해 fallback
            const recordStaffId = record.staffId || record.workLog?.staffId || record.workLog?.dealerId;
            const isStaffMatch = recordStaffId === staffId;
            const isDateMatch = record.workLog?.date === date;
            const isMatch = isStaffMatch && isDateMatch;
            
            // logger.debug 제거 - 성능 최적화
            return isMatch;
          });
          
          if (matchedRecord) {
            // logger.debug 제거 - 성능 최적화
            return matchedRecord;
          } else {
            // logger.debug 제거 - 성능 최적화
          }
        } else {
          // logger.debug 제거 - 성능 최적화
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
    
    const fallbackRecord = attendanceRecords.find(record => {
      const isStaffMatch = record.staffId === staffIdOrWorkLogId || record.staffId === baseStaffId;
      
      // 날짜 정보가 있으면 날짜도 매칭
      if (targetDate && record.workLog?.date) {
        return isStaffMatch && record.workLog.date === targetDate;
      }
      
      return isStaffMatch;
    });

    // logger.debug 제거 - 성능 최적화 (매번 호출되므로 성능 저하 원인)
    
    return fallbackRecord || undefined;
  };

  // 출석 상태별 통계를 계산하는 함수
  const getAttendanceStats = () => {
    const stats = {
      total: attendanceRecords.length,
      notStarted: 0,
      checkedIn: 0,
      checkedOut: 0
    };

    attendanceRecords.forEach(record => {
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
    error,
    getStaffAttendanceStatus,
    getAttendanceStats,
    currentDate,
    currentEventId,
    applyOptimisticUpdate
  };
};