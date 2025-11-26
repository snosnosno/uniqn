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
import { SalarySectionProps } from '@/types/jobPosting/salaryProps';
import Input from '@/components/ui/Input';
import { Select } from '@/components/common/Select';
import Toggle from '@/components/ui/Toggle';
import RoleSalaryManager from './RoleSalaryManager';
// 향후 칩 비용 계산 기능에서 사용 예정
// import { calculateChipCost, formatChipCost } from '@/utils/jobPosting/chipCalculator';

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
const SalarySection: React.FC<SalarySectionProps> = React.memo(({ data, handlers, validation }) => {
  return (
    <div className="space-y-4">
      {/* 역할별 급여 사용 토글 */}
      <Toggle
        id="useRoleSalary"
        checked={data.useRoleSalary || false}
        onChange={handlers.onRoleSalaryToggle}
        label="역할별 급여 설정"
        description="역할(딜러, 플로어 등)에 따라 다른 급여를 설정합니다"
      />

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
                  { value: 'other', label: '기타' },
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
        </div>
      )}

      {/* 복리후생 정보 - 역할별 급여 설정과 독립적으로 표시 */}
      {data.benefits && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            복리후생 (제공되는 정보만 입력)
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 보장시간 */}
            <div className="flex items-center space-x-2">
              <Toggle
                id="benefit-guaranteedHours"
                checked={data.benefits.guaranteedHours !== undefined}
                onChange={(checked) => handlers.onBenefitToggle('guaranteedHours', checked)}
                label="보장시간"
                size="sm"
              />
              {data.benefits.guaranteedHours !== undefined && (
                <Input
                  type="text"
                  value={data.benefits.guaranteedHours}
                  onChange={(e) => handlers.onBenefitChange('guaranteedHours', e.target.value)}
                  placeholder="예시: 6시간"
                  maxLength={25}
                  className="flex-1"
                />
              )}
            </div>

            {/* 복장 */}
            <div className="flex items-center space-x-2">
              <Toggle
                id="benefit-clothing"
                checked={data.benefits.clothing !== undefined}
                onChange={(checked) => handlers.onBenefitToggle('clothing', checked)}
                label="복장"
                size="sm"
              />
              {data.benefits.clothing !== undefined && (
                <Input
                  type="text"
                  value={data.benefits.clothing}
                  onChange={(e) => handlers.onBenefitChange('clothing', e.target.value)}
                  placeholder="예시: 검은셔츠,슬랙스,운동화"
                  maxLength={25}
                  className="flex-1"
                />
              )}
            </div>

            {/* 식사 */}
            <div className="flex items-center space-x-2">
              <Toggle
                id="benefit-meal"
                checked={data.benefits.meal !== undefined}
                onChange={(checked) => handlers.onBenefitToggle('meal', checked)}
                label="식사"
                size="sm"
              />
              {data.benefits.meal !== undefined && (
                <Input
                  type="text"
                  value={data.benefits.meal}
                  onChange={(e) => handlers.onBenefitChange('meal', e.target.value)}
                  placeholder="식사 정보 입력"
                  maxLength={25}
                  className="flex-1"
                />
              )}
            </div>

            {/* 교통비 (일당) */}
            <div className="flex items-center space-x-2">
              <Toggle
                id="benefit-transportation"
                checked={data.benefits.transportation !== undefined}
                onChange={(checked) => handlers.onBenefitToggle('transportation', checked)}
                label="교통비 (일당)"
                size="sm"
              />
              {data.benefits.transportation !== undefined && (
                <>
                  <Input
                    type="text"
                    value={data.benefits.transportation}
                    onChange={(e) => handlers.onBenefitChange('transportation', e.target.value)}
                    placeholder="일당 5,000원"
                    maxLength={25}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">원/일</span>
                </>
              )}
            </div>

            {/* 식비 (일당) */}
            <div className="flex items-center space-x-2">
              <Toggle
                id="benefit-mealAllowance"
                checked={data.benefits.mealAllowance !== undefined}
                onChange={(checked) => handlers.onBenefitToggle('mealAllowance', checked)}
                label="식비 (일당)"
                size="sm"
              />
              {data.benefits.mealAllowance !== undefined && (
                <>
                  <Input
                    type="text"
                    value={data.benefits.mealAllowance}
                    onChange={(e) => handlers.onBenefitChange('mealAllowance', e.target.value)}
                    placeholder="일당 10,000원"
                    maxLength={25}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">원/일</span>
                </>
              )}
            </div>

            {/* 숙소 (일당) */}
            <div className="flex items-center space-x-2">
              <Toggle
                id="benefit-accommodation"
                checked={data.benefits.accommodation !== undefined}
                onChange={(checked) => handlers.onBenefitToggle('accommodation', checked)}
                label="숙소 (일당)"
                size="sm"
              />
              {data.benefits.accommodation !== undefined && (
                <>
                  <Input
                    type="text"
                    value={data.benefits.accommodation}
                    onChange={(e) => handlers.onBenefitChange('accommodation', e.target.value)}
                    placeholder="일당 15,000원"
                    maxLength={25}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">원/일</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

SalarySection.displayName = 'SalarySection';

export default SalarySection;
