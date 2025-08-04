// 급여 요약 모달 컴포넌트
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaTimes, FaFileExport, FaMoneyBillWave, FaClock, FaExclamationTriangle } from './Icons/ReactIconsReplacement';

import { PayrollCalculationData, PayrollSummary } from '../utils/payroll/types';

interface PayrollSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  payrollData: PayrollCalculationData[];
  summary: PayrollSummary | null;
  onExport: () => void;
}

const PayrollSummaryModal: React.FC<PayrollSummaryModalProps> = ({
  isOpen,
  onClose,
  payrollData,
  summary,
  onExport
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatHours = (hours: number): string => {
    return `${hours.toFixed(1)}시간`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-800 flex items-center">
            <FaMoneyBillWave className="w-6 h-6 mr-2 text-green-600" />
            {t('payroll.summary.title', '급여 계산 요약')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
          >
            <FaTimes className="w-6 h-6" />
          </button>
        </div>

        {/* 전체 요약 정보 */}
        {summary ? <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-blue-800 mb-2 flex items-center">
                <FaClock className="w-5 h-5 mr-2" />
                {t('payroll.summary.totalHours', '총 근무시간')}
              </h3>
              <p className="text-2xl font-bold text-blue-600">{formatHours(summary.totalHours)}</p>
              <p className="text-sm text-gray-600">
                {t('payroll.summary.regularHours', '정규')}: {formatHours(summary.regularHours)} | 
                {t('payroll.summary.overtimeHours', '초과')}: {formatHours(summary.overtimeHours)}
              </p>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-green-800 mb-2 flex items-center">
                <FaMoneyBillWave className="w-5 h-5 mr-2" />
                {t('payroll.summary.totalPay', '총 급여')}
              </h3>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalPay)}</p>
              <p className="text-sm text-gray-600">
                {t('payroll.summary.basePay', '기본급')}: {formatCurrency(summary.basePay)}
              </p>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-orange-800 mb-2 flex items-center">
                <FaExclamationTriangle className="w-5 h-5 mr-2" />
                {t('payroll.summary.exceptions', '예외 사항')}
              </h3>
              <p className="text-2xl font-bold text-orange-600">{summary.totalExceptions}</p>
              <p className="text-sm text-gray-600">
                {t('payroll.summary.deductions', '공제액')}: {formatCurrency(summary.totalDeductions)}
              </p>
            </div>
          </div> : null}

        {/* 스태프별 급여 상세 */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">{t('payroll.details.title', '스태프별 급여 상세')}</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-2 text-left">
                    {t('payroll.details.staffName', '스태프명')}
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-center">
                    {t('payroll.details.workHours', '근무시간')}
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-center">
                    {t('payroll.details.overtime', '초과근무')}
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-center">
                    {t('payroll.details.exceptions', '예외사항')}
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-right">
                    {t('payroll.details.totalPay', '총 급여')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {payrollData.map((staff, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="border border-gray-300 px-4 py-2 font-medium">
                      {staff.staffName}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      {formatHours(staff.workTime.regularHours)}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      {formatHours(staff.workTime.overtimeHours)}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center">
                      <div className="flex justify-center items-center space-x-2">
                        {staff.exceptions.late.count > 0 && (
                          <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                            지각 {staff.exceptions.late.count}회
                          </span>
                        )}
                        {staff.exceptions.absence.count > 0 && (
                          <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">
                            결근 {staff.exceptions.absence.count}회
                          </span>
                        )}
                        {staff.exceptions.earlyLeave.count > 0 && (
                          <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded">
                            조퇴 {staff.exceptions.earlyLeave.count}회
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right font-semibold">
                      {formatCurrency(staff.payment.totalPay)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            {t('common.close', '닫기')}
          </button>
          <button
            onClick={onExport}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center"
          >
            <FaFileExport className="w-4 h-4 mr-2" />
            {t('payroll.export', '급여 CSV 내보내기')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PayrollSummaryModal;