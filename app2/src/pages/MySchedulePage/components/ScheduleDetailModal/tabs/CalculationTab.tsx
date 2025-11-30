/**
 * CalculationTab Component
 *
 * Feature: 001-schedule-modal-split
 * Created: 2025-11-05
 * Purpose: 급여 계산 탭 - 기본급, 수당, 세금, 총 지급액 상세 표시
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { FaInfoCircle } from '@/components/Icons/ReactIconsReplacement';
import { CalculationTabProps } from '../types';

/**
 * CalculationTab - 급여 계산 상세 표시 컴포넌트
 *
 * @param salaryInfo - 급여 정보 (계산된 데이터)
 * @param workHistory - 근무 내역 리스트 (표시용, 현재 미사용)
 */
const CalculationTab: React.FC<CalculationTabProps> = ({
  salaryInfo,
  workHistory: _workHistory,
}) => {
  const { t } = useTranslation();

  // 급여 유형 라벨
  const getSalaryTypeLabel = (type: string) => t(`salary.type.${type}`, type);

  // 총 수당 계산
  const totalAllowances =
    (salaryInfo.allowances?.meal || 0) +
    (salaryInfo.allowances?.transportation || 0) +
    (salaryInfo.allowances?.accommodation || 0) +
    (salaryInfo.allowances?.bonus || 0) +
    (salaryInfo.allowances?.other || 0);

  // 총 지급액 계산
  const basePay = salaryInfo.totalHours * salaryInfo.baseSalary;
  const totalPay = basePay + totalAllowances;

  return (
    <div className="space-y-6">
      {/* 기본급 계산 */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
          💰 {t('salary.basePay.calculation', '기본급 계산')}
        </h4>
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-300">
                {getSalaryTypeLabel(salaryInfo.salaryType)} ×{' '}
                {salaryInfo.salaryType === 'hourly'
                  ? t('salary.hoursUnit', '{{hours}}시간', {
                      hours: salaryInfo.totalHours.toFixed(1),
                    })
                  : t('salary.daysUnit', '{{days}}일', { days: salaryInfo.totalDays })}
              </span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {t('common.currency', '{{amount}}원', {
                  amount: salaryInfo.baseSalary.toLocaleString('ko-KR'),
                })}{' '}
                ×{' '}
                {salaryInfo.salaryType === 'hourly'
                  ? salaryInfo.totalHours.toFixed(1)
                  : salaryInfo.totalDays}
              </span>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-600 pt-2 flex justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {t('salary.basePay.total', '기본급 합계')}
              </span>
              <span className="text-base font-bold text-gray-900 dark:text-gray-100">
                {t('common.currency', '{{amount}}원', { amount: basePay.toLocaleString('ko-KR') })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 수당 정보 */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
          🎁 {t('salary.allowances.settings', '수당 설정')}
        </h4>

        {/* 일당 계산 과정 표시 */}
        {salaryInfo.allowances?.dailyRates && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {t('salary.allowances.dailyBased', '일당 기반 계산')}
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {t('salary.workDays', '{{days}}일 근무', {
                  days: salaryInfo.allowances.workDays || 1,
                })}
              </span>
            </div>
            {salaryInfo.allowances.dailyRates.meal && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300">
                  {t('salary.allowances.meal', '식비')}:{' '}
                  {t('common.currency', '{{amount}}원', {
                    amount: salaryInfo.allowances.dailyRates.meal.toLocaleString('ko-KR'),
                  })}{' '}
                  ×{' '}
                  {t('salary.daysUnit', '{{days}}일', {
                    days: salaryInfo.allowances.workDays || 1,
                  })}
                </span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">
                  ={' '}
                  {t('common.currency', '{{amount}}원', {
                    amount: (salaryInfo.allowances.meal || 0).toLocaleString('ko-KR'),
                  })}
                </span>
              </div>
            )}
            {salaryInfo.allowances.dailyRates.transportation && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300">
                  {t('salary.allowances.transportation', '교통비')}:{' '}
                  {t('common.currency', '{{amount}}원', {
                    amount: salaryInfo.allowances.dailyRates.transportation.toLocaleString('ko-KR'),
                  })}{' '}
                  ×{' '}
                  {t('salary.daysUnit', '{{days}}일', {
                    days: salaryInfo.allowances.workDays || 1,
                  })}
                </span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">
                  ={' '}
                  {t('common.currency', '{{amount}}원', {
                    amount: (salaryInfo.allowances.transportation || 0).toLocaleString('ko-KR'),
                  })}
                </span>
              </div>
            )}
            {salaryInfo.allowances.dailyRates.accommodation && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300">
                  {t('salary.allowances.accommodation', '숙소비')}:{' '}
                  {t('common.currency', '{{amount}}원', {
                    amount: salaryInfo.allowances.dailyRates.accommodation.toLocaleString('ko-KR'),
                  })}{' '}
                  ×{' '}
                  {t('salary.daysUnit', '{{days}}일', {
                    days: salaryInfo.allowances.workDays || 1,
                  })}
                </span>
                <span className="text-gray-900 dark:text-gray-100 font-medium">
                  ={' '}
                  {t('common.currency', '{{amount}}원', {
                    amount: (salaryInfo.allowances.accommodation || 0).toLocaleString('ko-KR'),
                  })}
                </span>
              </div>
            )}
          </div>
        )}

        {/* 수당 개별 항목 표시 */}
        <div className="space-y-2">
          {salaryInfo.allowances?.meal && salaryInfo.allowances.meal > 0 && (
            <div className="flex justify-between text-sm bg-gray-50 dark:bg-gray-700 rounded p-2">
              <span className="text-gray-600 dark:text-gray-300">
                {t('salary.allowances.meal', '식비')}
              </span>
              <span className="text-gray-900 dark:text-gray-100 font-medium">
                {t('common.currency', '{{amount}}원', {
                  amount: salaryInfo.allowances.meal.toLocaleString('ko-KR'),
                })}
              </span>
            </div>
          )}
          {salaryInfo.allowances?.transportation && salaryInfo.allowances.transportation > 0 && (
            <div className="flex justify-between text-sm bg-gray-50 dark:bg-gray-700 rounded p-2">
              <span className="text-gray-600 dark:text-gray-300">
                {t('salary.allowances.transportation', '교통비')}
              </span>
              <span className="text-gray-900 dark:text-gray-100 font-medium">
                {t('common.currency', '{{amount}}원', {
                  amount: salaryInfo.allowances.transportation.toLocaleString('ko-KR'),
                })}
              </span>
            </div>
          )}
          {salaryInfo.allowances?.accommodation && salaryInfo.allowances.accommodation > 0 && (
            <div className="flex justify-between text-sm bg-gray-50 dark:bg-gray-700 rounded p-2">
              <span className="text-gray-600 dark:text-gray-300">
                {t('salary.allowances.lodging', '숙박비')}
              </span>
              <span className="text-gray-900 dark:text-gray-100 font-medium">
                {t('common.currency', '{{amount}}원', {
                  amount: salaryInfo.allowances.accommodation.toLocaleString('ko-KR'),
                })}
              </span>
            </div>
          )}
          {salaryInfo.allowances?.bonus && salaryInfo.allowances.bonus > 0 && (
            <div className="flex justify-between text-sm bg-gray-50 dark:bg-gray-700 rounded p-2">
              <span className="text-gray-600 dark:text-gray-300">
                {t('salary.allowances.bonus', '보너스')}
              </span>
              <span className="text-gray-900 dark:text-gray-100 font-medium">
                {t('common.currency', '{{amount}}원', {
                  amount: salaryInfo.allowances.bonus.toLocaleString('ko-KR'),
                })}
              </span>
            </div>
          )}
          {salaryInfo.allowances?.other && salaryInfo.allowances.other > 0 && (
            <div className="flex justify-between text-sm bg-gray-50 dark:bg-gray-700 rounded p-2">
              <span className="text-gray-600 dark:text-gray-300">
                {t('salary.allowances.other', '기타 수당')}
              </span>
              <span className="text-gray-900 dark:text-gray-100 font-medium">
                {t('common.currency', '{{amount}}원', {
                  amount: salaryInfo.allowances.other.toLocaleString('ko-KR'),
                })}
              </span>
            </div>
          )}
          {totalAllowances === 0 && (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
              {t('salary.allowances.noAllowances', '설정된 수당이 없습니다.')}
            </div>
          )}
        </div>
      </div>

      {/* 총 계산 */}
      <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-300">
              {t('salary.basePay.label', '기본급')}
            </span>
            <span className="text-gray-900 dark:text-gray-100">
              {t('common.currency', '{{amount}}원', { amount: basePay.toLocaleString('ko-KR') })}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-300">
              {t('salary.allowances.total', '수당 합계')}
            </span>
            <span className="text-gray-900 dark:text-gray-100">
              {t('common.currency', '{{amount}}원', {
                amount: totalAllowances.toLocaleString('ko-KR'),
              })}
            </span>
          </div>
          {salaryInfo.tax !== undefined && salaryInfo.tax > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-300">{t('salary.tax', '세금')}</span>
              <span className="text-red-600 dark:text-red-400">
                -
                {t('common.currency', '{{amount}}원', {
                  amount: salaryInfo.tax.toLocaleString('ko-KR'),
                })}
              </span>
            </div>
          )}
          <div className="border-t border-indigo-200 dark:border-indigo-700 pt-2 flex justify-between">
            <span className="text-base font-medium text-gray-800 dark:text-gray-200">
              {t('salary.totalPay', '총 지급액')}
            </span>
            <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
              {t('common.currency', '{{amount}}원', { amount: totalPay.toLocaleString('ko-KR') })}
            </span>
          </div>
          {salaryInfo.afterTaxAmount !== undefined && salaryInfo.afterTaxAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-base font-medium text-green-700 dark:text-green-300">
                {t('salary.afterTax', '세후 급여')}
              </span>
              <span className="text-lg font-bold text-green-600 dark:text-green-400">
                {t('common.currency', '{{amount}}원', {
                  amount: salaryInfo.afterTaxAmount.toLocaleString('ko-KR'),
                })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 계산 안내 */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <FaInfoCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {t('salary.calculationNotice.title', '급여 계산 안내')}
          </p>
        </div>
        <p className="text-sm text-blue-600 dark:text-blue-400">
          {t(
            'salary.calculationNotice.description',
            '예정 근무 시간을 기준으로 자동 계산된 예상 급여입니다. 실제 지급 금액은 관리자 확인 후 결정됩니다.'
          )}
        </p>
      </div>
    </div>
  );
};

// React.memo로 래핑하여 불필요한 리렌더링 방지
export default React.memo(CalculationTab);
