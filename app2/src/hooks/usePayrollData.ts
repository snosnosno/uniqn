// 급여 데이터 관리 훅
import { collection, query, where, getDocs, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { useState, useEffect, useCallback } from 'react';

import { db } from '../firebase';
import { payrollDataGenerator } from '../utils/payroll/PayrollDataGenerator';
import { PayrollCalculationData, PayrollSummary, PayrollSettings } from '../utils/payroll/types';

import { WorkLog } from './useShiftSchedule';

interface UsePayrollDataProps {
  eventId?: string;
  staffId?: string;
  startDate?: string;
  endDate?: string;
}

export const usePayrollData = (props: UsePayrollDataProps = {}) => {
  const [payrollData, setPayrollData] = useState<PayrollCalculationData[]>([]);
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [settings, setSettings] = useState<PayrollSettings>(payrollDataGenerator.getSettings());

  // WorkLog 데이터에서 급여 데이터 생성
  const generatePayrollFromWorkLogs = useCallback(async (
    eventId: string,
    startDate?: string,
    endDate?: string
  ) => {
    setLoading(true);
    setError(null);

    try {
      // WorkLog 데이터 조회
      let workLogsQuery = query(
        collection(db, 'workLogs'),
        where('eventId', '==', eventId)
      );

      if (startDate) {
        workLogsQuery = query(workLogsQuery, where('date', '>=', startDate));
      }
      if (endDate) {
        workLogsQuery = query(workLogsQuery, where('date', '<=', endDate));
      }

      const workLogsSnapshot = await getDocs(workLogsQuery);
      const workLogs: WorkLog[] = workLogsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as WorkLog));

      // 스태프별로 그룹화
      const staffGroups = new Map<string, WorkLog[]>();
      workLogs.forEach(log => {
        const key = log.dealerId;
        if (!staffGroups.has(key)) {
          staffGroups.set(key, []);
        }
        staffGroups.get(key)!.push(log);
      });

      // 각 스태프별 급여 데이터 계산
      const payrollCalculations: PayrollCalculationData[] = [];
      
      for (const [staffId, logs] of Array.from(staffGroups)) {
        if (logs.length === 0) continue;

        // 스태프 정보 가져오기 (첫 번째 로그에서)
        const firstLog = logs[0];
        const staffName = firstLog?.dealerName || 'Unknown Staff';
        
        // 직무 정보 가져오기 (별도 조회 필요할 수 있음)
        const jobRole = await getStaffJobRole(staffId) || 'Dealer';
        
        const payrollData = payrollDataGenerator.calculateStaffPayroll(
          staffId,
          staffName,
          jobRole,
          logs,
          eventId,
          await getEventName(eventId)
        );

        payrollCalculations.push(payrollData);
      }

      setPayrollData(payrollCalculations);

      // 요약 데이터 생성
      if (payrollCalculations.length > 0) {
        const summaryData = generateSummaryFromData(payrollCalculations, startDate, endDate);
        setSummary(summaryData);
      }

    } catch (err) {
      console.error('급여 데이터 생성 중 오류:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 기존 급여 데이터 조회
  const fetchExistingPayrollData = useCallback(async (
    eventId?: string,
    staffId?: string,
    startDate?: string,
    endDate?: string
  ) => {
    setLoading(true);
    setError(null);

    try {
      let payrollQuery = query(collection(db, 'payrollCalculations'));

      if (eventId) {
        payrollQuery = query(payrollQuery, where('eventId', '==', eventId));
      }
      if (staffId) {
        payrollQuery = query(payrollQuery, where('staffId', '==', staffId));
      }

      const snapshot = await getDocs(payrollQuery);
      const data: PayrollCalculationData[] = snapshot.docs.map(doc => ({
        ...doc.data()
      } as PayrollCalculationData));

      // 날짜 필터링 (클라이언트 사이드)
      const filteredData = data.filter(item => {
        if (startDate && item.period.start < startDate) return false;
        if (endDate && item.period.end > endDate) return false;
        return true;
      });

      setPayrollData(filteredData);

      // 요약 데이터 생성
      if (filteredData.length > 0) {
        const summaryData = generateSummaryFromData(filteredData, startDate, endDate);
        setSummary(summaryData);
      }

    } catch (err) {
      console.error('급여 데이터 조회 중 오류:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 급여 데이터 저장
  const savePayrollData = useCallback(async (data: PayrollCalculationData[]) => {
    setLoading(true);
    setError(null);

    try {
      const payrollCollection = collection(db, 'payrollCalculations');
      
      for (const payrollItem of data) {
        await addDoc(payrollCollection, {
          ...payrollItem,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        });
      }

      console.log(`${data.length}개의 급여 데이터가 저장되었습니다.`);
    } catch (err) {
      console.error('급여 데이터 저장 중 오류:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 급여 데이터 상태 업데이트
  const updatePayrollStatus = useCallback(async (
    payrollId: string, 
    status: 'draft' | 'confirmed' | 'paid'
  ) => {
    try {
      const payrollRef = doc(db, 'payrollCalculations', payrollId);
      await updateDoc(payrollRef, {
        status,
        updatedAt: Timestamp.now()
      });
    } catch (err) {
      console.error('급여 상태 업데이트 중 오류:', err);
      setError(err as Error);
    }
  }, []);

  // 급여 설정 업데이트
  const updatePayrollSettings = useCallback((newSettings: Partial<PayrollSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    payrollDataGenerator.updateSettings(updatedSettings);
  }, [settings]);

  // 월별 급여 요약 생성
  const generateMonthlySummary = useCallback((year: number, month: number) => {
    if (payrollData.length === 0) return null;
    
    const monthlyData = payrollData.filter(data => {
      const dataYear = new Date(data.period.start).getFullYear();
      const dataMonth = new Date(data.period.start).getMonth() + 1;
      return dataYear === year && dataMonth === month;
    });

    return payrollDataGenerator.generateMonthlySummary(year, month, monthlyData);
  }, [payrollData]);

  // CSV 내보내기
  const exportToCSV = useCallback(() => {
    return payrollDataGenerator.exportToCSV(payrollData);
  }, [payrollData]);

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    if (props.eventId) {
      fetchExistingPayrollData(
        props.eventId,
        props.staffId,
        props.startDate,
        props.endDate
      );
    }
  }, [props.eventId, props.staffId, props.startDate, props.endDate, fetchExistingPayrollData]);

  return {
    payrollData,
    summary,
    loading,
    error,
    settings,
    generatePayrollFromWorkLogs,
    fetchExistingPayrollData,
    savePayrollData,
    updatePayrollStatus,
    updatePayrollSettings,
    generateMonthlySummary,
    exportToCSV
  };
};

// 헬퍼 함수들
async function getStaffJobRole(staffId: string): Promise<string> {
  try {
    // StaffJobApplication 또는 users 컬렉션에서 직무 정보 조회
    const staffQuery = query(
      collection(db, 'staffJobApplications'),
      where('userId', '==', staffId)
    );
    const snapshot = await getDocs(staffQuery);
    
    if (!snapshot.empty && snapshot.docs[0]) {
      const staffData = snapshot.docs[0].data();
      return staffData.jobRole || 'Dealer';
    }
    
    return 'Dealer'; // 기본값
  } catch (error) {
    console.error('스태프 직무 조회 중 오류:', error);
    return 'Dealer';
  }
}

async function getEventName(eventId: string): Promise<string> {
  try {
    const eventQuery = query(
      collection(db, 'events'),
      where('id', '==', eventId)
    );
    const snapshot = await getDocs(eventQuery);
    
    if (!snapshot.empty && snapshot.docs[0]) {
      const eventData = snapshot.docs[0].data();
      return eventData.title || eventId;
    }
    
    return eventId;
  } catch (error) {
    console.error('이벤트 이름 조회 중 오류:', error);
    return eventId;
  }
}

function generateSummaryFromData(
  data: PayrollCalculationData[],
  startDate?: string,
  endDate?: string
): PayrollSummary {
  // 기간 타입 결정
  const start = startDate || data[0]?.period.start || new Date().toISOString().split('T')[0];
  const end = endDate || data[data.length - 1]?.period.end || new Date().toISOString().split('T')[0] || '';
  
  const daysDiff = Math.abs(new Date(end || '').getTime() - new Date(start || '').getTime()) / (1000 * 60 * 60 * 24);
  const periodType = daysDiff > 20 ? 'monthly' : 'weekly';

  return {
    period: { type: periodType, start: start || '', end: end || '' },
    totalStaff: data.length,
    totalHours: data.reduce((sum, item) => sum + item.workTime.totalHours, 0),
    regularHours: data.reduce((sum, item) => sum + item.workTime.regularHours, 0),
    overtimeHours: data.reduce((sum, item) => sum + item.workTime.overtimeHours, 0),
    totalPay: data.reduce((sum, item) => sum + item.payment.totalPay, 0),
    basePay: data.reduce((sum, item) => sum + item.payment.regularPay, 0),
    overtimePay: data.reduce((sum, item) => sum + item.payment.overtimePay, 0),
    totalDeductions: data.reduce((sum, item) => sum + item.payment.deduction, 0),
    totalExceptions: data.reduce((sum, item) => sum + item.exceptions.late.count + item.exceptions.earlyLeave.count + item.exceptions.absence.count, 0),
    averageWorkHours: data.length > 0 ? data.reduce((sum, item) => sum + item.workTime.totalHours, 0) / data.length : 0,
    averagePay: data.length > 0 ? data.reduce((sum, item) => sum + item.payment.totalPay, 0) / data.length : 0,
    exceptionSummary: {
      totalLate: data.reduce((sum, item) => sum + item.exceptions.late.count, 0),
      totalEarlyLeave: data.reduce((sum, item) => sum + item.exceptions.earlyLeave.count, 0),
      totalAbsence: data.reduce((sum, item) => sum + item.exceptions.absence.count, 0),
      totalOvertime: data.reduce((sum, item) => sum + item.exceptions.overtime.count, 0),
    },
    staffSummaries: data
  };
}