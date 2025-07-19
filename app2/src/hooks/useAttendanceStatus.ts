import { useState, useEffect } from 'react';

import { AttendanceStatus } from '../components/AttendanceStatusCard';
import { safeOnSnapshot } from '../utils/firebaseConnectionManager';

import { WorkLog } from './useShiftSchedule';

export interface AttendanceRecord {
  staffId: string;
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
      // workLogs 컬렉션에서 해당 날짜의 기록들을 실시간으로 구독
      // const workLogsQuery = query(
      //   collection(db, 'workLogs'),
      //   where('eventId', '==', currentEventId),
      //   where('date', '==', currentDate)
      // );

      // safeOnSnapshot을 사용하여 안전한 리스너 설정
      const unsubscribe = safeOnSnapshot<WorkLog>(
        'workLogs',
        (workLogs) => {
          try {
            const records: AttendanceRecord[] = [];
            
            workLogs.forEach((workLog) => {
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
    
    // QR 실제 기록이 있는 경우
    if (workLog.type === 'qr') {
      if (workLog.actualStartTime && workLog.actualEndTime) {
        status = 'checked_out';
      } else if (workLog.actualStartTime) {
        status = 'checked_in';
      }
    } else {
      // 스케줄 기반인 경우 - 현재 시간과 비교하여 상태 판단
      const scheduledStart = workLog.scheduledStartTime;
      const scheduledEnd = workLog.scheduledEndTime;
      
      if (scheduledStart && scheduledEnd) {
        if (currentTime < scheduledStart) {
          status = 'not_started';
        } else if (currentTime >= scheduledStart && currentTime < scheduledEnd) {
          // 예정 시간은 지났지만 실제 출근 기록이 없으면 결근 처리
          status = 'absent';
        } else {
          // 예정 종료 시간도 지난 경우
          status = 'absent';
        }
      }
    }

    const formatTime = (timeString?: string) => {
      if (!timeString) return undefined;
      // HH:MM 형식으로 변환
      return timeString.length > 5 ? timeString.substring(0, 5) : timeString;
    };

    return {
      staffId: workLog.dealerId,
      status,
      checkInTime: formatTime(workLog.actualStartTime),
      checkOutTime: formatTime(workLog.actualEndTime),
      scheduledStartTime: formatTime(workLog.scheduledStartTime),
      scheduledEndTime: formatTime(workLog.scheduledEndTime),
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