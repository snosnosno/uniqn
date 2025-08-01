import { useState, useEffect } from 'react';

import { logger } from '../utils/logger';
import { AttendanceStatus } from '../components/AttendanceStatusCard';
import { safeOnSnapshot } from '../utils/firebaseConnectionManager';
import { getTodayString } from '../utils/jobPosting/dateUtils';

import { WorkLog } from './useShiftSchedule';

export interface AttendanceRecord {
  staffId: string;
  workLogId?: string; // WorkLog ID 추가 (출석상태 드롭다운에서 사용)
  status: AttendanceStatus;
  checkInTime?: string | undefined;
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
  const [localUpdates, setLocalUpdates] = useState<Map<string, AttendanceStatus>>(new Map());

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
            
            logger.debug('🔍 useAttendanceStatus - 필터링된 workLogs:', { 
              component: 'useAttendanceStatus',
              data: {
                currentEventId,
                totalWorkLogs: workLogs.length,
                filteredCount: filteredWorkLogs.length,
                eventIds: Array.from(new Set(workLogs.map(w => w.eventId)))
              }
            });
            
            // 변경 감지를 위한 상세 로깅
            filteredWorkLogs.forEach((workLog) => {
              const attendanceRecord = calculateAttendanceStatus(workLog);
              records.push(attendanceRecord);
              
              // 모든 workLog의 상태 변경 추적
              logger.debug('📊 useAttendanceStatus - workLog 처리:', { 
                component: 'useAttendanceStatus',
                data: {
                  workLogId: workLog.id,
                  dealerId: workLog.dealerId,
                  eventId: workLog.eventId,
                  date: workLog.date,
                  workLogStatus: workLog.status,
                  calculatedStatus: attendanceRecord.status,
                  hasActualStartTime: !!workLog.actualStartTime,
                  hasActualEndTime: !!workLog.actualEndTime,
                  updatedAt: workLog.updatedAt,
                  timestamp: new Date().toISOString()
                }
              });
            });

            // 이전 상태와 비교하여 변경사항 감지
            const prevRecordsMap = new Map(attendanceRecords.map(r => [r.workLogId, r.status]));
            const changedRecords = records.filter(r => {
              const prevStatus = prevRecordsMap.get(r.workLogId);
              return prevStatus && prevStatus !== r.status;
            });

            if (changedRecords.length > 0) {
              logger.debug('🔄 useAttendanceStatus - 상태 변경 감지:', { 
                component: 'useAttendanceStatus',
                data: {
                  changedCount: changedRecords.length,
                  changes: changedRecords.map(r => ({
                    workLogId: r.workLogId,
                    staffId: r.staffId,
                    oldStatus: prevRecordsMap.get(r.workLogId),
                    newStatus: r.status
                  }))
                }
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
  }, [currentEventId, currentDate]);

  // WorkLog 데이터로부터 출석 상태를 계산하는 함수
  const calculateAttendanceStatus = (workLog: WorkLog): AttendanceRecord => {
    const now = new Date();
    const currentTime = now.toTimeString().substring(0, 5); // HH:MM format

    let status: AttendanceStatus = 'not_started';
    
    // workLog의 status 필드가 있으면 우선 사용 (수동 출석 상태 변경을 반영)
    if (workLog.status && ['not_started', 'checked_in', 'checked_out'].includes(workLog.status)) {
      status = workLog.status as AttendanceStatus;
      logger.debug('📊 workLog.status 사용:', { 
        component: 'useAttendanceStatus',
        data: {
          workLogId: workLog.id,
          dealerId: workLog.dealerId,
          status: workLog.status,
          date: workLog.date
        }
      });
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
      
      logger.debug('🕐 실제 시간 기반 상태 계산:', { 
        component: 'useAttendanceStatus',
        data: {
          workLogId: workLog.id,
          dealerId: workLog.dealerId,
          hasActualStartTime,
          hasActualEndTime,
          calculatedStatus: status,
          date: workLog.date
        }
      });
    }

    // Timestamp를 시간 문자열로 변환하는 함수
    const formatTimeFromTimestamp = (timestamp: any): string | undefined => {
      if (!timestamp) return undefined;
      
      try {
        let date: Date;
        
        // Timestamp 객체인 경우
        if (timestamp && typeof timestamp.toDate === 'function') {
          date = timestamp.toDate();
        }
        // Date 객체인 경우
        else if (timestamp instanceof Date) {
          date = timestamp;
        }
        // 문자열인 경우 (이미 HH:MM 형식이거나 ISO 문자열)
        else if (typeof timestamp === 'string') {
          if (timestamp.includes(':') && timestamp.length <= 8) {
            // 이미 HH:MM 또는 HH:MM:SS 형식
            return timestamp.substring(0, 5);
          } else {
            // ISO 문자열 등
            date = new Date(timestamp);
          }
        }
        // 숫자인 경우 (milliseconds)
        else if (typeof timestamp === 'number') {
          date = new Date(timestamp);
        }
        else {
          return undefined;
        }
        
        // Date 객체에서 HH:MM 형식으로 변환
        if (date && !isNaN(date.getTime())) {
          return date.toLocaleTimeString('ko-KR', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
          });
        }
        
        return undefined;
      } catch (error) {
        logger.error('시간 포맷 변환 오류:', error instanceof Error ? error : new Error(String(error)), { component: 'useAttendanceStatus' });
        return undefined;
      }
    };

    // staffId는 workLog.dealerId 사용
    const staffId = workLog.dealerId;

    return {
      staffId: staffId,
      ...(workLog.id && { workLogId: workLog.id }), // WorkLog ID 추가 (출석상태 드롭다운에서 사용)
      status,
      ...(formatTimeFromTimestamp(workLog.actualStartTime) && { checkInTime: formatTimeFromTimestamp(workLog.actualStartTime) }),
      ...(formatTimeFromTimestamp(workLog.actualEndTime) && { checkOutTime: formatTimeFromTimestamp(workLog.actualEndTime) }),
      ...(formatTimeFromTimestamp(workLog.scheduledStartTime) && { scheduledStartTime: formatTimeFromTimestamp(workLog.scheduledStartTime) }),
      ...(formatTimeFromTimestamp(workLog.scheduledEndTime) && { scheduledEndTime: formatTimeFromTimestamp(workLog.scheduledEndTime) }),
      workLog
    };
  };

  // Optimistic update를 위한 함수
  const applyOptimisticUpdate = (workLogId: string, newStatus: AttendanceStatus) => {
    logger.debug('🚀 Optimistic update 적용:', { component: 'useAttendanceStatus', data: { workLogId, newStatus } });
    
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
          logger.debug('✨ Optimistic update - 레코드 업데이트:', { 
            component: 'useAttendanceStatus',
            data: {
              workLogId: record.workLogId,
              oldStatus: record.status,
              newStatus
            }
          });
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
  const getStaffAttendanceStatus = (staffIdOrWorkLogId: string): AttendanceRecord | null => {
    logger.debug('🔍 getStaffAttendanceStatus 호출:', { 
      component: 'useAttendanceStatus',
      data: {
        input: staffIdOrWorkLogId,
        totalRecords: attendanceRecords.length,
        recordIds: attendanceRecords.map(r => ({
          workLogId: r.workLogId,
          staffId: r.staffId,
          date: r.workLog?.date
        }))
      }
    });

    // workLogId로 먼저 검색 시도 (virtual_ 접두사 포함)
    if (staffIdOrWorkLogId.includes('virtual_') || staffIdOrWorkLogId.includes('_')) {
      // workLogId로 검색
      const record = attendanceRecords.find(record => record.workLogId === staffIdOrWorkLogId);
      
      if (record) {
        logger.debug('✅ getStaffAttendanceStatus - workLogId로 직접 찾음:', { 
          component: 'useAttendanceStatus',
          data: {
            workLogId: staffIdOrWorkLogId,
            status: record.status,
            date: record.workLog?.date
          }
        });
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
          
          logger.debug('🔎 virtual ID 파싱 결과:', { 
            component: 'useAttendanceStatus',
            data: {
              virtualId: staffIdOrWorkLogId,
              parsedStaffId: staffId,
              parsedDate: date
            }
          });
          
          const matchedRecord = attendanceRecords.find(record => {
            // dealerId 필드도 확인 (호환성을 위해)
            const recordStaffId = record.staffId || record.workLog?.dealerId;
            const isStaffMatch = recordStaffId === staffId;
            const isDateMatch = record.workLog?.date === date;
            const isMatch = isStaffMatch && isDateMatch;
            
            if (isStaffMatch) {
              logger.debug('📋 스태프 매칭 확인:', { 
                component: 'useAttendanceStatus',
                data: {
                  recordStaffId,
                  targetStaffId: staffId,
                  recordDate: record.workLog?.date,
                  targetDate: date,
                  isDateMatch,
                  workLogId: record.workLogId,
                  isMatch
                }
              });
            }
            return isMatch;
          });
          
          if (matchedRecord) {
            logger.debug('✅ getStaffAttendanceStatus - virtual ID 매칭 성공:', { 
              component: 'useAttendanceStatus',
              data: {
                virtualId: staffIdOrWorkLogId,
                staffId,
                date,
                status: matchedRecord.status,
                workLogId: matchedRecord.workLogId
              }
            });
            return matchedRecord;
          } else {
            logger.debug('❌ virtual ID 매칭 실패:', { 
              component: 'useAttendanceStatus',
              data: {
                virtualId: staffIdOrWorkLogId,
                staffId,
                date,
                availableDates: attendanceRecords
                  .filter(r => r.staffId === staffId)
                  .map(r => r.workLog?.date)
              }
            });
          }
        } else {
          logger.debug('⚠️ virtual ID 파싱 실패:', { component: 'useAttendanceStatus', data: staffIdOrWorkLogId });
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

    if (fallbackRecord) {
      logger.debug('⚠️ getStaffAttendanceStatus - staffId로 fallback 검색 성공:', { 
        component: 'useAttendanceStatus',
        data: {
          input: staffIdOrWorkLogId,
          baseStaffId,
          targetDate,
          foundStaffId: fallbackRecord.staffId,
          foundDate: fallbackRecord.workLog?.date,
          status: fallbackRecord.status,
          workLogId: fallbackRecord.workLogId
        }
      });
    } else {
      logger.debug('❌ getStaffAttendanceStatus - 매칭 실패:', { 
        component: 'useAttendanceStatus',
        data: {
          input: staffIdOrWorkLogId,
          baseStaffId,
          targetDate,
          availableRecords: attendanceRecords.map(r => ({
            staffId: r.staffId,
            date: r.workLog?.date,
            workLogId: r.workLogId
          }))
        }
      });
    }
    
    return fallbackRecord || null;
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