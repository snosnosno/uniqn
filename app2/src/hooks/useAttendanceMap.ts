import { useMemo } from 'react';
import { logger } from '../utils/logger';

interface AttendanceRecord {
  staffId: string;
  workLog?: {
    staffId?: string;
    date?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

interface UseAttendanceMapReturn {
  attendanceMap: Map<string, AttendanceRecord>;
  getStaffAttendance: (staffId: string, date: string) => AttendanceRecord | undefined;
  getStaffAttendanceByDate: (date: string) => AttendanceRecord[];
}

/**
 * AttendanceRecords를 효율적인 Map 구조로 변환하여 O(1) 검색 제공
 */
export const useAttendanceMap = (
  attendanceRecords: AttendanceRecord[]
): UseAttendanceMapReturn => {
  
  // attendanceRecords를 Map으로 변환 (key: staffId_date)
  const attendanceMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    
    attendanceRecords.forEach(record => {
      if (!record.staffId || !record.workLog?.date) return;
      
      // 복합 키 생성: staffId_date
      const key = `${record.staffId}_${record.workLog.date}`;
      map.set(key, record);
      
      // 하위 호환성을 위해 추가 키 생성 (이제 staffId 통합)
      const workLogStaffId = record.workLog.staffId;
      if (workLogStaffId && workLogStaffId !== record.staffId) {
        const workLogKey = `${workLogStaffId}_${record.workLog.date}`;
        map.set(workLogKey, record);
      }
    });
    
    logger.debug('AttendanceMap 생성 완료', {
      component: 'useAttendanceMap',
      data: { 
        recordCount: attendanceRecords.length,
        mapSize: map.size 
      }
    });
    
    return map;
  }, [attendanceRecords]);

  // 특정 스태프의 특정 날짜 출석 기록 조회
  const getStaffAttendance = useMemo(() => {
    return (staffId: string, date: string): AttendanceRecord | undefined => {
      // 직접 키로 조회 (O(1))
      const directKey = `${staffId}_${date}`;
      const directResult = attendanceMap.get(directKey);
      if (directResult) return directResult;
      
      // staffId에서 숫자 접미사 제거 후 재시도
      const cleanStaffId = staffId.replace(/_\d+$/, '');
      const cleanKey = `${cleanStaffId}_${date}`;
      return attendanceMap.get(cleanKey);
    };
  }, [attendanceMap]);

  // 특정 날짜의 모든 출석 기록 조회
  const getStaffAttendanceByDate = useMemo(() => {
    return (date: string): AttendanceRecord[] => {
      const results: AttendanceRecord[] = [];
      const seen = new Set<string>(); // 중복 제거용
      
      attendanceMap.forEach((record) => {
        if (record.workLog?.date === date && !seen.has(record.staffId)) {
          results.push(record);
          seen.add(record.staffId);
        }
      });
      
      return results;
    };
  }, [attendanceMap]);

  return {
    attendanceMap,
    getStaffAttendance,
    getStaffAttendanceByDate
  };
};