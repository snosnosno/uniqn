import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { callFunctionLazy } from '../../utils/firebase-dynamic';

// import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
// import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useJobPostingContext } from '../../contexts/JobPostingContext';
import { usePayrollData } from '../../hooks/usePayrollData';
import { formatCurrency, formatDate } from '../../i18n-helpers';
// import { PayrollCalculationData } from '../../utils/payroll/types';

interface Payroll {
  id: string;
  eventId: string;
  eventName?: string;
  workDurationInHours: number;
  calculatedPay: number;
  status: string;
  calculationDate: { toDate: () => Date };
  userId: string;
  staffName?: string;
}

interface PayrollProcessingTabProps {
  jobPosting?: any; // Optional for compatibility with TabConfig
}

const PayrollProcessingTab: React.FC<PayrollProcessingTabProps> = () => {
  const { i18n } = useTranslation();
  const { currentUser } = useAuth();
  const { jobPosting, staff, loading: contextLoading } = useJobPostingContext();
  
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  
  // Payroll data hook for advanced calculations
  const {
    payrollData: calculatedPayrollData,
    summary: payrollSummary,
    loading: calculationLoading,
    generatePayrollFromWorkLogs,
    exportToCSV
  } = usePayrollData({
    eventId: jobPosting?.id || ''
  });

  // 급여 통계 계산 - Hook은 early return 전에 호출
  const payrollStats = useMemo(() => {
    const totalPay = payrolls.reduce((sum, p) => sum + p.calculatedPay, 0);
    const totalHours = payrolls.reduce((sum, p) => sum + p.workDurationInHours, 0);
    const paidPayrolls = payrolls.filter(p => p.status === 'paid');
    const paidAmount = paidPayrolls.reduce((sum, p) => sum + p.calculatedPay, 0);
    const pendingAmount = totalPay - paidAmount;

    return {
      totalStaff: payrolls.length,
      totalHours,
      totalPay,
      paidAmount,
      pendingAmount
    };
  }, [payrolls]);

  useEffect(() => {
    if (!currentUser || !jobPosting?.id) {
      setLoading(false);
      return;
    }

    fetchJobPostingPayrollData();
  }, [currentUser, jobPosting?.id, staff]);

  // Early return if no job posting - 모든 Hook 호출 후에 배치
  if (!jobPosting) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center min-h-96">
          <div className="text-lg text-gray-500">공고 정보를 불러올 수 없습니다.</div>
        </div>
      </div>
    );
  }

  const fetchJobPostingPayrollData = async () => {
    if (!jobPosting?.id || !staff.length) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // 해당 공고의 스태프 ID들 추출
      const staffUserIds = staff.map(s => s.id).filter(Boolean);
      
      if (staffUserIds.length === 0) {
        setPayrolls([]);
        setLoading(false);
        return;
      }

      // Firebase Functions를 통해 스태프별 급여 데이터 가져오기
      const payrollPromises = staffUserIds.map(async (userId) => {
        try {
          const result: any = await callFunctionLazy('getPayrollsForUsers', { userId });
          const userPayrolls = result?.payrolls || [];
          
          // 해당 공고의 이벤트 ID와 관련된 급여만 필터링
          return userPayrolls.filter((p: Payroll) => 
            p.eventId === jobPosting.id || 
            p.eventId === `job-${jobPosting.id}` ||
            isRelatedToJobPosting(p, jobPosting)
          );
        } catch (error) {
          console.error(`Error fetching payroll for user ${userId}:`, error);
          return [];
        }
      });

      const allPayrollResults = await Promise.all(payrollPromises);
      const flatPayrolls = allPayrollResults.flat();

      // 스태프 정보와 매칭하여 이름 추가
      const payrollsWithStaffNames = flatPayrolls.map((p: Payroll) => {
        const staffMember = staff.find(s => s.id === p.userId);
        return {
          ...p,
          staffName: staffMember?.name || `User ${p.userId}`,
          eventName: jobPosting.title
        };
      });

      setPayrolls(payrollsWithStaffNames);
    } catch (error: any) {
      console.error('급여 데이터 조회 오류:', error);
      setError('급여 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 공고와 관련된 급여인지 확인하는 헬퍼 함수
  const isRelatedToJobPosting = (payroll: Payroll, jobPosting: any) => {
    // 급여 계산 날짜가 공고 기간 내에 있는지 확인
    if (!jobPosting.startDate || !jobPosting.endDate) return false;
    
    const payrollDate = payroll.calculationDate.toDate();
    const startDate = new Date(jobPosting.startDate);
    const endDate = new Date(jobPosting.endDate);
    
    return payrollDate >= startDate && payrollDate <= endDate;
  };

  // 고급 급여 계산 실행
  const handleGenerateAdvancedPayroll = async () => {
    if (!jobPosting?.id) return;
    
    try {
      await generatePayrollFromWorkLogs(
        jobPosting.id,
        selectedPeriod.start,
        selectedPeriod.end
      );
    } catch (error) {
      console.error('고급 급여 계산 오류:', error);
      setError('고급 급여 계산에 실패했습니다.');
    }
  };

  // CSV 내보내기
  const handleExportPayroll = () => {
    if (calculatedPayrollData.length > 0) {
      const csvData = exportToCSV();
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `payroll_${jobPosting.title}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (payrolls.length > 0) {
      // 기본 급여 데이터 CSV 내보내기
      exportBasicPayrollToCSV();
    }
  };

  const exportBasicPayrollToCSV = () => {
    const headers = ['직원명', '이벤트', '근무시간', '급여', '상태', '계산일자'];
    const csvContent = [
      headers.join(','),
      ...payrolls.map(p => [
        p.staffName || 'Unknown',
        p.eventName || 'Unknown Event',
        p.workDurationInHours.toFixed(2),
        p.calculatedPay,
        p.status === 'paid' ? '지급완료' : '지급대기',
        formatDate(p.calculationDate.toDate(), i18n.language)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `payroll_basic_${jobPosting.title}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (contextLoading || loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center min-h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 ml-4">급여 데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* 헤더 */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-lg font-medium">{jobPosting.title} - 급여 처리</h3>
          <p className="text-sm text-gray-600 mt-1">
            총 {staff.length}명의 스태프 | {payrollStats.totalStaff}건의 급여 기록
          </p>
        </div>
        
        <div className="flex space-x-2">
          {calculatedPayrollData.length > 0 && (
            <button
              onClick={handleExportPayroll}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              고급 급여 내보내기
            </button>
          )}
          
          {payrolls.length > 0 && (
            <button
              onClick={handleExportPayroll}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              기본 급여 내보내기
            </button>
          )}
        </div>
      </div>

      {error ? <div className="bg-red-50 p-4 rounded-lg mb-6">
          <p className="text-red-600">{error}</p>
        </div> : null}

      {/* 급여 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <h4 className="text-sm font-medium text-gray-500">총 스태프 수</h4>
          <p className="text-2xl font-bold text-gray-900">{payrollStats.totalStaff}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h4 className="text-sm font-medium text-gray-500">총 근무 시간</h4>
          <p className="text-2xl font-bold text-gray-900">{payrollStats.totalHours.toFixed(1)}h</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h4 className="text-sm font-medium text-gray-500">총 급여</h4>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(payrollStats.totalPay, i18n.language === 'ko' ? 'KRW' : 'USD', i18n.language)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h4 className="text-sm font-medium text-gray-500">지급 완료</h4>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(payrollStats.paidAmount, i18n.language === 'ko' ? 'KRW' : 'USD', i18n.language)}
          </p>
          {payrollStats.pendingAmount > 0 && (
            <p className="text-sm text-orange-600 mt-1">
              대기중: {formatCurrency(payrollStats.pendingAmount, i18n.language === 'ko' ? 'KRW' : 'USD', i18n.language)}
            </p>
          )}
        </div>
      </div>

      {/* 고급 급여 계산 섹션 */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h4 className="text-lg font-medium mb-4">고급 급여 계산</h4>
        <div className="flex flex-col md:flex-row md:items-end space-y-4 md:space-y-0 md:space-x-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">시작일</label>
            <input
              type="date"
              value={selectedPeriod.start}
              onChange={(e) => setSelectedPeriod(prev => ({ ...prev, start: e.target.value }))}
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">종료일</label>
            <input
              type="date"
              value={selectedPeriod.end}
              onChange={(e) => setSelectedPeriod(prev => ({ ...prev, end: e.target.value }))}
              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <button
            onClick={handleGenerateAdvancedPayroll}
            disabled={calculationLoading}
            className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-400"
          >
            {calculationLoading ? '계산 중...' : '급여 계산'}
          </button>
        </div>
        
        {payrollSummary ? <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h5 className="font-medium mb-2">계산 요약</h5>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">총 근무시간:</span>
                <span className="ml-2 font-medium">{payrollSummary.totalHours.toFixed(1)}h</span>
              </div>
              <div>
                <span className="text-gray-500">정규시간:</span>
                <span className="ml-2 font-medium">{payrollSummary.regularHours.toFixed(1)}h</span>
              </div>
              <div>
                <span className="text-gray-500">초과시간:</span>
                <span className="ml-2 font-medium">{payrollSummary.overtimeHours.toFixed(1)}h</span>
              </div>
              <div>
                <span className="text-gray-500">총 급여:</span>
                <span className="ml-2 font-medium">
                  {formatCurrency(payrollSummary.totalPay, i18n.language === 'ko' ? 'KRW' : 'USD', i18n.language)}
                </span>
              </div>
            </div>
          </div> : null}
      </div>

      {/* 급여 내역 테이블 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h4 className="text-lg font-medium mb-4">급여 내역</h4>
        
        {payrolls.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    직원명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    이벤트
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    계산일자
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    근무시간
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    급여
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payrolls.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{p.staffName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{p.eventName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatDate(p.calculationDate.toDate(), i18n.language)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{p.workDurationInHours.toFixed(2)}h</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(p.calculatedPay, i18n.language === 'ko' ? 'KRW' : 'USD', i18n.language)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        p.status === 'paid' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {p.status === 'paid' ? '지급완료' : '지급대기'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">💰</div>
            <h5 className="text-lg font-medium text-gray-900 mb-2">
              급여 내역이 없습니다
            </h5>
            <p className="text-gray-500">
              해당 공고에 대한 급여 내역이 아직 생성되지 않았습니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PayrollProcessingTab;