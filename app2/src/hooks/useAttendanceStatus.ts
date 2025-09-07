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
  const [localUpdates, setLocalUpdates] = useState<Map<string, AttendanceStatus>>(new Map());

  // 현재 날짜를 기본값으로 사용 (로컬 타임존 기준)
  const currentDate = date || getTodayString();
  const currentEventId = eventId || 'default-event';

  // Optimistic update 함수 추가
  const applyOptimisticUpdate = (workLogId: string, newStatus: AttendanceStatus) => {
    setLocalUpdates(prev => {
      const newMap = new Map(prev);
      newMap.set(workLogId, newStatus);
      return newMap;
    });
    
    // 즉시 attendanceRecords 업데이트
    setAttendanceRecords(prev => {
      return prev.map(record => {
        if (record.workLogId === workLogId) {
          return { ...record, status: newStatus };
        }
        return record;
      });
    });
    
    logger.info('Optimistic update 적용', { 
      component: 'useAttendanceStatus',
      data: { workLogId, newStatus }
    });
  };

  useEffect(() => {
    if (!currentEventId) {
      setLoading(false);
      return () => {};
    }

    try {
      // workLogs 컬렉션에서 해당 이벤트의 기록들을 실시간으로 구독
      // 날짜 필터링을 옵션으로 추가
      
      // safeOnSnapshot을 사용하여 안전한 리스너 설정
      const unsubscribe = safeOnSnapshot<WorkLog>(
        'workLogs',
        (workLogs) => {
          try {
            const records: AttendanceRecord[] = [];
            
            // eventId로 필터링 - 현재 eventId와 일치하는 것만
            let filteredWorkLogs = workLogs.filter(workLog => 
              workLog.eventId === currentEventId
            );
            
            // 날짜 필터링 (옵션)
            if (date) {
              filteredWorkLogs = filteredWorkLogs.filter(workLog =>
                workLog.date === date
              );
            }
            
            // workLogs 처리
            filteredWorkLogs.forEach((workLog) => {
              // localUpdates에 있는 경우 해당 상태 사용
              const localStatus = workLog.id ? localUpdates.get(workLog.id) : undefined;
              const attendanceRecord = calculateAttendanceStatus(workLog);
              
              if (localStatus) {
                attendanceRecord.status = localStatus;
              }
              
              records.push(attendanceRecord);
            });

            // 이전 상태와 비교하여 변경사항 감지
            const prevRecordsMap = new Map(attendanceRecords.map(r => [r.workLogId, r.status]));
            const changedRecords = records.filter(r => {
              const prevStatus = prevRecordsMap.get(r.workLogId);
              return prevStatus && prevStatus !== r.status;
            });

            if (changedRecords.length > 0) {
              logger.info('출석 상태 변경 감지', { 
                component: 'useAttendanceStatus',
                data: { changedCount: changedRecords.length }
              });
            }

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
  }, [currentEventId, currentDate, localUpdates]);

  // WorkLog 데이터로부터 출석 상태를 계산하는 함수
  const calculateAttendanceStatus = (workLog: WorkLog): AttendanceRecord => {
    const _now = new Date();
    const currentTime = _now.toTimeString().substring(0, 5); // HH:MM format

    let status: AttendanceStatus = 'not_started';
    
    // workLog의 status 필드가 있으면 우선 사용 (수동 출석 상태 변경을 반영)
    if (workLog.status) {
      // 'scheduled' 상태는 'not_started'로 매핑
      if (workLog.status === 'scheduled') {
        status = 'not_started';
      } else if (['not_started', 'checked_in', 'checked_out'].includes(workLog.status)) {
        status = workLog.status as AttendanceStatus;
      }
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

    const staffId = workLog.staffId;

    return {
      staffId: staffId || '',
      ...(workLog.id && { workLogId: workLog.id }), // WorkLog ID 추가 (출석상태 드롭다운에서 사용)
      status,
      ...(formatTimeFromTimestamp(workLog.actualStartTime) && { actualStartTime: formatTimeFromTimestamp(workLog.actualStartTime) }),
      ...(formatTimeFromTimestamp(workLog.actualEndTime) && { actualEndTime: formatTimeFromTimestamp(workLog.actualEndTime) }),
      ...(formatTimeFromTimestamp(workLog.scheduledStartTime) && { scheduledStartTime: formatTimeFromTimestamp(workLog.scheduledStartTime) }),
      ...(formatTimeFromTimestamp(workLog.scheduledEndTime) && { scheduledEndTime: formatTimeFromTimestamp(workLog.scheduledEndTime) }),
      workLog
    };
  };

  // applyOptimisticUpdate 함수는 이미 위에 정의되어 있으므로 중복 제거
  // 3초 후 로컬 업데이트 제거 기능 추가
  const _clearOptimisticUpdate = (workLogId: string) => {
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
            const recordStaffId = record.staffId || record.workLog?.staffId;
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