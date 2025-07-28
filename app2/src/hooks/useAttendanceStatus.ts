import { useState, useEffect } from 'react';

import { AttendanceStatus } from '../components/AttendanceStatusCard';
import { safeOnSnapshot } from '../utils/firebaseConnectionManager';

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

  // 현재 날짜를 기본값으로 사용
  const currentDate = date || new Date().toISOString().split('T')[0];
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
            
            // eventId로 필터링
            const filteredWorkLogs = workLogs.filter(workLog => 
              workLog.eventId === currentEventId
            );
            
            filteredWorkLogs.forEach((workLog) => {
              const attendanceRecord = calculateAttendanceStatus(workLog);
              records.push(attendanceRecord);
            });


            setAttendanceRecords(records);
            setError(null);
          } catch (err) {
            console.error('출석 상태 계산 오류:', err);
            setError('출석 상태를 계산하는 중 오류가 발생했습니다.');
          } finally {
            setLoading(false);
          }
        },
        (err) => {
          console.error('출석 기록 구독 오류:', err);
          setError('출석 기록을 불러오는 중 오류가 발생했습니다.');
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error('출석 상태 훅 초기화 오류:', err);
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
    
    // 실제 출퇴근 시간이 있는지 확인
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
          status = 'absent'; // 예정 시간은 지났지만 실제 출근 기록이 없으면 결근
        } else {
          status = 'absent'; // 예정 종료 시간도 지난 경우
        }
      }
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
        console.error('시간 포맷 변환 오류:', error, timestamp);
        return undefined;
      }
    };

    // staffId는 workLog.dealerId 사용
    const staffId = workLog.dealerId;

    return {
      staffId: staffId,
      workLogId: workLog.id, // WorkLog ID 추가 (출석상태 드롭다운에서 사용)
      status,
      checkInTime: formatTimeFromTimestamp(workLog.actualStartTime),
      checkOutTime: formatTimeFromTimestamp(workLog.actualEndTime),
      scheduledStartTime: formatTimeFromTimestamp(workLog.scheduledStartTime),
      scheduledEndTime: formatTimeFromTimestamp(workLog.scheduledEndTime),
      workLog
    };
  };

  // 특정 스태프의 출석 상태를 가져오는 함수
  const getStaffAttendanceStatus = (staffId: string): AttendanceRecord | null => {
    return attendanceRecords.find(record => record.staffId === staffId) || null;
  };

  // 출석 상태별 통계를 계산하는 함수
  const getAttendanceStats = () => {
    const stats = {
      total: attendanceRecords.length,
      notStarted: 0,
      checkedIn: 0,
      checkedOut: 0,
      absent: 0
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
        case 'absent':
          stats.absent++;
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
    currentEventId
  };
};