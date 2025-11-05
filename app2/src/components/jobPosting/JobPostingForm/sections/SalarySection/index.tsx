/**
 * SalarySection - 급여 정보 섹션
 *
 * 급여 타입, 금액, 복리후생, 역할별 차등 급여 입력 UI
 *
 * @see app2/src/types/jobPosting/salaryProps.ts
 *
 * @example
 * ```tsx
 * // 기본 급여 사용 예시
 * const salaryData = {
 *   salaryType: 'hourly',
 *   salaryAmount: '20000',
 *   benefits: { meal: true, transportation: false, accommodation: false },
 *   useRoleSalary: false,
 *   roleSalaries: {}
 * };
 *
 * const salaryHandlers = {
 *   onSalaryTypeChange: (type) => { ... },
 *   onSalaryAmountChange: (amount) => { ... },
 *   onBenefitToggle: (benefitType, enabled) => { ... },
 *   onBenefitChange: (benefitType, amount) => { ... },
 *   onRoleSalaryToggle: (enabled) => { ... },
 *   onAddRole: (role) => { ... },
 *   onRemoveRole: (roleIndex) => { ... },
 *   onRoleSalaryChange: (roleIndex, type, amount) => { ... }
 * };
 *
 * <SalarySection
 *   data={salaryData}
 *   handlers={salaryHandlers}
 *   validation={{ errors: {}, touched: {} }}
 * />
 * ```
 *
 * @example
 * ```tsx
 * // 역할별 차등 급여 사용 예시
 * const salaryDataWithRoles = {
 *   ...salaryData,
 *   useRoleSalary: true,
 *   roleSalaries: {
 *     dealer: { salaryType: 'hourly', salaryAmount: '20000' },
 *     floorman: { salaryType: 'hourly', salaryAmount: '18000' }
 *   }
 * };
 * ```
 */

import React from 'react';
import { SalarySectionProps } from '../../../../../types/jobPosting/salaryProps';
import Input from '../../../../ui/Input';
import { Select } from '../../../../common/Select';
import RoleSalaryManager from './RoleSalaryManager';
import { calculateChipCost, formatChipCost } from '../../../../../utils/jobPosting/chipCalculator';

/**
 * SalarySection 컴포넌트 (React.memo 적용)
 *
 * Props Grouping 패턴:
 * - data: 급여 정보 데이터 (salaryType, salaryAmount, benefits, useRoleSalary, roleSalaries)
 * - handlers: 이벤트 핸들러 (onSalaryTypeChange, onBenefitToggle, onRoleSalaryToggle 등)
 * - validation: 검증 에러 (선택)
 *
 * 조건부 렌더링: useRoleSalary에 따라 기본 급여 또는 역할별 급여 UI 표시
 *
 * @component
 * @param {SalarySectionProps} props - Props Grouping 패턴
 * @param {SalaryData} props.data - 급여 정보 데이터
 * @param {SalaryHandlers} props.handlers - 이벤트 핸들러
 * @param {SalaryValidation} [props.validation] - 검증 상태 (선택)
 * @returns {React.ReactElement} 급여 정보 입력 섹션
 */
const SalarySection: React.FC<SalarySectionProps> = React.memo(({
  data,
  handlers,
  validation
}) => {
  return (
    <div className="space-y-4">
      {/* 역할별 급여 사용 토글 */}
      <div className="flex items-center">
        <input
          type="checkbox"
          id="useRoleSalary"
          checked={data.useRoleSalary || false}
          onChange={(e) => handlers.onRoleSalaryToggle(e.target.checked)}
          className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
        />
        <label htmlFor="useRoleSalary" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          역할별 급여 설정
        </label>
      </div>

      {/* 역할별 급여 사용 시 RoleSalaryManager 표시 */}
      {data.useRoleSalary ? (
        <div className="mt-4">
          <RoleSalaryManager
            roleSalaries={data.roleSalaries || {}}
            onAddRole={handlers.onAddRole}
            onRemoveRole={handlers.onRemoveRole}
            onRoleSalaryChange={handlers.onRoleSalaryChange}
          />
        </div>
      ) : (
        /* 기본 급여 설정 */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 급여 타입 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                급여 타입 <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <Select
                value={data.salaryType || 'hourly'}
                onChange={(value) => handlers.onSalaryTypeChange(value as any)}
                options={[
                  { value: 'hourly', label: '시급' },
                  { value: 'daily', label: '일급' },
                  { value: 'monthly', label: '월급' },
                  { value: 'negotiable', label: '협의' },
                  { value: 'other', label: '기타' }
                ]}
              />
            </div>

            {/* 급여 금액 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                급여 금액 <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              {data.salaryType === 'negotiable' ? (
                <div className="py-2 px-3 bg-gray-100 dark:bg-gray-700 rounded-md text-gray-600 dark:text-gray-400">
                  급여 협의
                </div>
              ) : (
                <Input
                  type="text"
                  value={data.salaryAmount || ''}
                  onChange={(e) => {
                    const numValue = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0;
                    handlers.onSalaryAmountChange(numValue);
                  }}
                  placeholder="예: 20000"
                  // @ts-ignore - formData type narrowing issue
                  required={data.salaryType !== 'negotiable'}
                />
              )}
              {validation?.errors.salaryAmount && validation?.touched.salaryAmount && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {validation.errors.salaryAmount}
                </p>
              )}
            </div>
          </div>

          {/* 복리후생 정보 */}
          {data.benefits && (
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                복리후생 (선택)
              </h4>
              <div className="space-y-2">
                {/* 식사 제공 */}
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={!!data.benefits.meal}
                    onChange={(e) => handlers.onBenefitToggle('meal', e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">식사 제공</span>
                </label>

                {/* 교통비 지원 */}
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={!!data.benefits.transportation}
                    onChange={(e) => handlers.onBenefitToggle('transportation', e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">교통비 지원</span>
                </label>

                {/* 숙소 제공 */}
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={!!data.benefits.accommodation}
                    onChange={(e) => handlers.onBenefitToggle('accommodation', e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">숙소 제공</span>
                </label>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

SalarySection.displayName = 'SalarySection';

export default SalarySection;
