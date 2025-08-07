import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSimplePayroll } from '../hooks/useSimplePayroll';
import { formatCurrency, formatDate } from '../i18n-helpers';
import SimplePayrollCalculator from '../components/SimplePayrollCalculator';

const SimplePayrollPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { currentUser, isAdmin } = useAuth();
  const { userId } = useParams<{ userId: string }>();
  
  const [selectedPeriod, setSelectedPeriod] = useState({
    start: new Date(new Date().setDate(1)).toISOString().split('T')[0], // 이번달 1일
    end: new Date().toISOString().split('T')[0], // 오늘
  });

  // 접근 권한 확인
  const targetUserId = userId || currentUser?.uid;
  const isOwnPayroll = !userId || (currentUser?.uid === userId);
  const canViewPayroll = isOwnPayroll || isAdmin;

  // 정산 데이터 조회 (조건부 props 처리)
  const payrollProps: any = {
    startDate: selectedPeriod.start,
    endDate: selectedPeriod.end,
    realtime: true,
  };
  if (targetUserId) {
    payrollProps.staffId = targetUserId;
  }

  const {
    payrollData,
    summary,
    loading,
    error,
    exportToCSV,
    refetch,
  } = useSimplePayroll(payrollProps);

  // 로그인되지 않은 경우
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // 접근 권한이 없는 경우
  if (!canViewPayroll) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <h1 className="text-2xl font-bold text-red-800 mb-2">
              접근 권한이 없습니다.
            </h1>
            <p className="text-red-600">
              본인의 급여내역만 조회할 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">급여 데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <h1 className="text-2xl font-bold text-red-800 mb-2">오류</h1>
            <p className="text-red-600">{error.message}</p>
            <button
              onClick={refetch}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              다시 시도
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                급여 내역 (간편 조회)
              </h1>
              {!isOwnPayroll && (
                <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mt-2">
                  관리자 조회
                </span>
              )}
            </div>
            <div className="mt-4 md:mt-0 flex space-x-2">
              <button
                onClick={exportToCSV}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                disabled={payrollData.length === 0}
              >
                CSV 내보내기
              </button>
              <button
                onClick={() => window.history.back()}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
              >
                뒤로 가기
              </button>
            </div>
          </div>
        </div>

        {/* 기간 선택 */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="flex flex-col md:flex-row md:items-end space-y-4 md:space-y-0 md:space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                시작일
              </label>
              <input
                type="date"
                value={selectedPeriod.start}
                onChange={(e) => setSelectedPeriod(prev => ({ ...prev, start: e.target.value }))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                종료일
              </label>
              <input
                type="date"
                value={selectedPeriod.end}
                onChange={(e) => setSelectedPeriod(prev => ({ ...prev, end: e.target.value }))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <button
              onClick={refetch}
              className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            >
              조회
            </button>
          </div>
        </div>

        {/* 간단 계산기 */}
        <div className="mb-6">
          <SimplePayrollCalculator />
        </div>

        {/* 급여 통계 */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">근무 일수</h3>
              <p className="text-2xl font-bold text-gray-900">{payrollData.length}일</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">총 근무 시간</h3>
              <p className="text-2xl font-bold text-gray-900">{summary.totalHours.toFixed(1)}h</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">평균 근무 시간</h3>
              <p className="text-2xl font-bold text-gray-900">
                {payrollData.length > 0 ? (summary.totalHours / payrollData.length).toFixed(1) : 0}h
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500">총 급여</h3>
              <p className="text-2xl font-bold text-indigo-600">
                {formatCurrency(summary.totalPay, i18n.language === 'ko' ? 'KRW' : 'USD', i18n.language)}
              </p>
            </div>
          </div>
        )}

        {/* 급여 내역 테이블 */}
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-bold mb-4 text-gray-800">
            상세 내역
          </h2>
          
          {payrollData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      날짜
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      직원명
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      근무시간
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      시급
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      일급
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payrollData.map((p, index) => (
                    <tr key={`${p.date}-${p.staffId}-${index}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDate(new Date(p.date), i18n.language)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{p.staffName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{p.workHours.toFixed(2)}h</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatCurrency(p.hourlyRate, i18n.language === 'ko' ? 'KRW' : 'USD', i18n.language)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-indigo-600">
                          {formatCurrency(p.dailyPay, i18n.language === 'ko' ? 'KRW' : 'USD', i18n.language)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">💰</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                급여 내역이 없습니다
              </h3>
              <p className="text-gray-500">
                선택한 기간에 근무 기록이 없습니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimplePayrollPage;