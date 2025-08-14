// 단순 정산 데이터 관리 Hook
import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '../utils/logger';
import { WorkLog } from './useShiftSchedule';
import { 
  workLogToPayrollData, 
  aggregatePayrollData,
  groupPayrollByStaff,
  generateCSVData
} from '../utils/simplePayrollCalculator';
import { SimplePayrollData, SimplePayrollSummary, DEFAULT_HOURLY_RATES } from '../types/simplePayroll';

interface UseSimplePayrollProps {
  eventId?: string;
  staffId?: string;
  startDate?: string;
  endDate?: string;
  realtime?: boolean; // 실시간 구독 여부
}

export const useSimplePayroll = ({
  eventId,
  staffId,
  startDate,
  endDate,
  realtime = false,
}: UseSimplePayrollProps = {}) => {
  const [payrollData, setPayrollData] = useState<SimplePayrollData[]>([]);
  const [summary, setSummary] = useState<SimplePayrollSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // workLogs 데이터 조회 및 계산
  const fetchPayrollData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 쿼리 조건 구성
      const constraints = [];
      
      if (eventId) {
        constraints.push(where('eventId', '==', eventId));
      }
      if (staffId) {
        constraints.push(where('dealerId', '==', staffId));
      }
      if (startDate) {
        constraints.push(where('date', '>=', startDate));
      }
      if (endDate) {
        constraints.push(where('date', '<=', endDate));
      }

      // workLogs 컬렉션 쿼리
      const workLogsQuery = constraints.length > 0
        ? query(collection(db, 'workLogs'), ...constraints)
        : query(collection(db, 'workLogs'));

      const snapshot = await getDocs(workLogsQuery);
      const workLogs: WorkLog[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as WorkLog));

      // 스태프별 시급 정보 가져오기 (선택사항)
      const staffRates = new Map<string, number>();
      
      // 현재는 기본값 사용
      workLogs.forEach(log => {
        if (!staffRates.has(log.dealerId)) {
          // 직무에 따른 시급 설정 (임시로 기본값 사용)
          const defaultRate = DEFAULT_HOURLY_RATES?.['default'] ?? 15000;
          staffRates.set(log.dealerId, defaultRate);
        }
      });

      // WorkLog를 SimplePayrollData로 변환
      const payrollDataArray = workLogs.map(log => 
        workLogToPayrollData(log, staffRates.get(log.dealerId))
      );

      // 날짜순 정렬
      payrollDataArray.sort((a, b) => a.date.localeCompare(b.date));

      setPayrollData(payrollDataArray);

      // 요약 데이터 생성
      const summaryData = aggregatePayrollData(payrollDataArray);
      setSummary(summaryData);

      logger.info(`단순 정산 데이터 조회 완료: ${payrollDataArray.length}건, 총 ${summaryData.totalPay}원`);
    } catch (err) {
      logger.error('정산 데이터 조회 오류', err instanceof Error ? err : new Error(String(err)), {
        component: 'useSimplePayroll'
      });
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [eventId, staffId, startDate, endDate]);

  // 실시간 구독 설정
  useEffect(() => {
    let unsubscribe: Unsubscribe | undefined;

    if (realtime && (eventId || staffId)) {
      // 실시간 구독 쿼리 구성
      const constraints = [];
      
      if (eventId) {
        constraints.push(where('eventId', '==', eventId));
      }
      if (staffId) {
        constraints.push(where('dealerId', '==', staffId));
      }
      if (startDate) {
        constraints.push(where('date', '>=', startDate));
      }
      if (endDate) {
        constraints.push(where('date', '<=', endDate));
      }

      const workLogsQuery = query(collection(db, 'workLogs'), ...constraints);

      unsubscribe = onSnapshot(workLogsQuery, 
        (snapshot) => {
          const workLogs: WorkLog[] = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as WorkLog));

          // WorkLog를 SimplePayrollData로 변환
          const defaultRate = DEFAULT_HOURLY_RATES?.['default'] ?? 15000;
          const payrollDataArray = workLogs.map(log => 
            workLogToPayrollData(log, defaultRate)
          );

          // 날짜순 정렬
          payrollDataArray.sort((a, b) => a.date.localeCompare(b.date));

          setPayrollData(payrollDataArray);

          // 요약 데이터 생성
          const summaryData = aggregatePayrollData(payrollDataArray);
          setSummary(summaryData);
        },
        (err) => {
          logger.error('실시간 구독 오류', err, { component: 'useSimplePayroll' });
          setError(err as Error);
        }
      );
    } else {
      // 실시간 구독이 아닌 경우 한 번만 조회
      fetchPayrollData();
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [eventId, staffId, startDate, endDate, realtime, fetchPayrollData]);

  // 스태프별 정산 데이터 가져오기
  const getStaffPayroll = useCallback((staffId: string) => {
    return payrollData.filter(p => p.staffId === staffId);
  }, [payrollData]);

  // 날짜별 정산 데이터 가져오기
  const getDatePayroll = useCallback((date: string) => {
    return payrollData.filter(p => p.date === date);
  }, [payrollData]);

  // CSV 내보내기
  const exportToCSV = useCallback(() => {
    const csvData = generateCSVData(payrollData);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const fileName = `payroll_${new Date().toISOString().split('T')[0]}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    logger.info(`CSV 내보내기 완료: ${fileName}`);
  }, [payrollData]);

  // 스태프별 그룹화된 데이터
  const groupedByStaff = useCallback(() => {
    return groupPayrollByStaff(payrollData);
  }, [payrollData]);

  return {
    payrollData,
    summary,
    loading,
    error,
    refetch: fetchPayrollData,
    getStaffPayroll,
    getDatePayroll,
    exportToCSV,
    groupedByStaff,
  };
};