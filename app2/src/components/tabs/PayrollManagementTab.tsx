import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { JobPosting } from '../../types/jobPosting';
import { useJobPostingPayroll } from '../../hooks/useJobPostingPayroll';
import { formatCurrency } from '../../i18n-helpers';
import { logger } from '../../utils/logger';

interface PayrollManagementTabProps {
  jobPosting?: JobPosting | null;
}

const PayrollManagementTab: React.FC<PayrollManagementTabProps> = ({ jobPosting }) => {
  const { i18n } = useTranslation();
  
  // 날짜 범위 상태
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  // 급여 유형 상태 (공고의 기본값 사용)
  const [selectedSalaryType, setSelectedSalaryType] = useState<'hourly' | 'daily' | 'monthly' | 'other'>(
    jobPosting?.salaryType || 'hourly'
  );

  // 급여 금액 상태 (공고의 기본값 사용)
  const [salaryAmount, setSalaryAmount] = useState(jobPosting?.salaryAmount || '');

  // 정산 데이터 조회 - jobPosting의 confirmedStaff는 레퍼런스가 자주 바뀔 수 있으므로 id만 의존성에 추가
  const payrollParams = useMemo(() => {
    if (!jobPosting?.id) {
      return {};
    }
    
    const params: any = {
      jobPostingId: jobPosting.id,
      confirmedStaff: jobPosting.confirmedStaff || [],
      salaryType: selectedSalaryType
    };
    
    if (salaryAmount) {
      params.salaryAmount = salaryAmount;
    }
    if (dateRange.start) {
      params.startDate = dateRange.start;
    }
    if (dateRange.end) {
      params.endDate = dateRange.end;
    }
    
    return params;
  }, [jobPosting?.id, jobPosting?.confirmedStaff?.length, selectedSalaryType, salaryAmount, dateRange.start, dateRange.end]);
  
  const {
    payrollData,
    summary,
    loading,
    error,
    exportToCSV
  } = useJobPostingPayroll(payrollParams);

  // 날짜 변경 핸들러
  const handleDateChange = useCallback((type: 'start' | 'end', value: string) => {
    setDateRange(prev => ({
      ...prev,
      [type]: value
    }));
    
    logger.info(`정산 기간 변경: ${type} = ${value}`, {
      component: 'PayrollManagementTab'
    });
  }, []);

  // 급여 유형 변경 핸들러
  const handleSalaryTypeChange = useCallback((type: 'hourly' | 'daily' | 'monthly' | 'other') => {
    setSelectedSalaryType(type);
    
    logger.info(`급여 유형 변경: ${type}`, {
      component: 'PayrollManagementTab'
    });
  }, []);

  // 급여 금액 변경 핸들러
  const handleSalaryAmountChange = useCallback((value: string) => {
    setSalaryAmount(value);
  }, []);

  // 급여 유형 한글 변환
  const getSalaryTypeLabel = useCallback((type: string) => {
    const labels: { [key: string]: string } = {
      hourly: '시급',
      daily: '일급',
      monthly: '월급',
      other: '기타'
    };
    return labels[type] || type;
  }, []);

  // 확정된 스태프가 없는 경우
  if (!jobPosting?.confirmedStaff || jobPosting.confirmedStaff.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">👥</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            확정된 스태프가 없습니다
          </h3>
          <p className="text-gray-500">
            지원자를 승인하여 스태프로 확정한 후 정산을 진행할 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center min-h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-red-800 mb-2">오류 발생</h3>
          <p className="text-red-600">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900">정산 관리</h2>
        <button
          onClick={exportToCSV}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          disabled={payrollData.length === 0}
        >
          CSV 내보내기
        </button>
      </div>

      {/* 설정 패널 */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-4">
        {/* 기간 선택 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              시작일
            </label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => handleDateChange('start', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              종료일
            </label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => handleDateChange('end', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* 급여 설정 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              급여 유형
            </label>
            <select
              value={selectedSalaryType}
              onChange={(e) => handleSalaryTypeChange(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="hourly">시급</option>
              <option value="daily">일급</option>
              <option value="monthly">월급</option>
              <option value="other">기타</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              금액 (원)
            </label>
            <input
              type="number"
              value={salaryAmount}
              onChange={(e) => handleSalaryAmountChange(e.target.value)}
              placeholder={selectedSalaryType === 'hourly' ? '15000' : '200000'}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">총 인원</h3>
          <p className="text-2xl font-bold text-gray-900">{summary.totalStaff}명</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">총 근무일수</h3>
          <p className="text-2xl font-bold text-gray-900">{summary.totalDays}일</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">총 근무시간</h3>
          <p className="text-2xl font-bold text-gray-900">{summary.totalHours.toFixed(1)}시간</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">총 지급액</h3>
          <p className="text-2xl font-bold text-indigo-600">
            {formatCurrency(summary.totalAmount, i18n.language === 'ko' ? 'KRW' : 'USD', i18n.language)}
          </p>
        </div>
      </div>

      {/* 역할별 요약 */}
      {Object.keys(summary.byRole).length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h3 className="text-lg font-medium text-gray-900">역할별 요약</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(summary.byRole).map(([role, data]) => (
                <div key={role} className="border rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">{role}</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">인원:</span>
                      <span className="font-medium">{data.count}명</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">시간:</span>
                      <span className="font-medium">{data.hours.toFixed(1)}시간</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">금액:</span>
                      <span className="font-medium text-indigo-600">
                        {formatCurrency(data.amount, i18n.language === 'ko' ? 'KRW' : 'USD', i18n.language)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 스태프별 상세 내역 */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-medium text-gray-900">스태프별 상세 내역</h3>
        </div>
        
        {payrollData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    스태프
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    역할
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    근무일수
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    근무시간
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    급여유형
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    기본급여
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    초과수당
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    총액
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {payrollData.map((data) => (
                  <tr key={data.staffId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{data.staffName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{data.role}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm text-gray-900">{data.totalDays}일</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm text-gray-900">{data.totalHours.toFixed(1)}시간</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {getSalaryTypeLabel(data.salaryType)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-900">
                        {formatCurrency(data.regularPay, i18n.language === 'ko' ? 'KRW' : 'USD', i18n.language)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm text-gray-900">
                        {data.overtimePay 
                          ? formatCurrency(data.overtimePay, i18n.language === 'ko' ? 'KRW' : 'USD', i18n.language)
                          : '-'
                        }
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-medium text-indigo-600">
                        {formatCurrency(data.totalAmount, i18n.language === 'ko' ? 'KRW' : 'USD', i18n.language)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center">
            <div className="text-gray-400 text-6xl mb-4">💰</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              정산 내역이 없습니다
            </h3>
            <p className="text-gray-500">
              선택한 기간에 근무 기록이 없습니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PayrollManagementTab;