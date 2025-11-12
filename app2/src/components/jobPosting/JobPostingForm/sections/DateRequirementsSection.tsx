/**
 * DateRequirementsSection - 날짜별 요구사항 섹션
 *
 * 기존 DateSpecificRequirementsNew 컴포넌트를 Props Grouping 패턴으로 래핑
 *
 * @see app2/src/types/jobPosting/dateRequirementsProps.ts
 * @see app2/src/components/jobPosting/DateSpecificRequirementsNew.tsx
 *
 * @example
 * ```tsx
 * // 사용 예시
 * const dateRequirementsData = {
 *   dateSpecificRequirements: [
 *     {
 *       date: '2025-11-10',
 *       timeSlots: [
 *         { time: '14:00', roles: [{ role: 'dealer', count: 5 }] }
 *       ]
 *     }
 *   ]
 * };
 *
 * const dateRequirementsHandlers = {
 *   onTimeSlotChange: (dateIndex, timeSlots) => { ... },
 *   onTimeToBeAnnouncedToggle: (dateIndex, enabled) => { ... },
 *   onTentativeDescriptionChange: (dateIndex, description) => { ... },
 *   onRoleChange: (dateIndex, slotIndex, roles) => { ... }
 * };
 *
 * <DateRequirementsSection
 *   data={dateRequirementsData}
 *   handlers={dateRequirementsHandlers}
 *   validation={{ errors: {}, touched: {} }}
 * />
 * ```
 */

import React, { useMemo } from 'react';
import { DateRequirementsSectionProps } from '../../../../types/jobPosting/dateRequirementsProps';
import DateSpecificRequirementsNew from '../../DateSpecificRequirementsNew';

/**
 * DateRequirementsSection 컴포넌트 (React.memo 적용)
 *
 * Props Grouping 패턴:
 * - data: 날짜별 요구사항 데이터 (dateSpecificRequirements 배열 - 최대 50개)
 * - handlers: 이벤트 핸들러 (onTimeSlotChange, onTimeToBeAnnouncedToggle 등)
 * - validation: 검증 에러 (선택)
 *
 * 성능 최적화: useMemo로 대형 배열 (50개 이상) 렌더링 최적화
 *
 * @component
 * @param {DateRequirementsSectionProps} props - Props Grouping 패턴
 * @param {DateRequirementsData} props.data - 날짜별 요구사항 데이터
 * @param {DateRequirementsHandlers} props.handlers - 이벤트 핸들러
 * @param {DateRequirementsValidation} [props.validation] - 검증 상태 (선택)
 * @returns {React.ReactElement} 날짜별 요구사항 입력 섹션
 */
const DateRequirementsSection: React.FC<DateRequirementsSectionProps> = React.memo(({
  data,
  handlers,
  validation
}) => {
  /**
   * 메모이제이션: 대형 배열 렌더링 최적화 (50개 이상 날짜 지원)
   */
  const memoizedRequirements = useMemo(() => {
    return data.dateSpecificRequirements;
  }, [data.dateSpecificRequirements]);

  return (
    <div className="space-y-4">
      <div className="mb-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          날짜별 요구사항 <span className="text-red-500 dark:text-red-400">*</span>
        </label>
      </div>

      {/* 기존 DateSpecificRequirementsNew 컴포넌트 활용 */}
      <DateSpecificRequirementsNew
        requirements={memoizedRequirements}
        onRequirementsChange={handlers.onRequirementsChange}
        onDateSpecificTimeSlotChange={handlers.onTimeSlotChange}
        onDateSpecificTimeToBeAnnouncedToggle={handlers.onTimeToBeAnnouncedToggle}
        onDateSpecificTentativeDescriptionChange={handlers.onTentativeDescriptionChange}
        onDateSpecificRoleChange={handlers.onRoleChange}
      />

      {/* 검증 에러 표시 */}
      {validation?.touched && validation.errors.dateSpecificRequirements && (
        <div className="mt-2">
          <p className="text-sm text-red-600 dark:text-red-400">
            {validation.errors.dateSpecificRequirements}
          </p>
        </div>
      )}
    </div>
  );
});

DateRequirementsSection.displayName = 'DateRequirementsSection';

export default DateRequirementsSection;
