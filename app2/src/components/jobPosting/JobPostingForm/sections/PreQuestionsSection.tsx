/**
 * PreQuestionsSection - 사전 질문 섹션
 *
 * 기존 PreQuestionManager 컴포넌트를 Props Grouping 패턴으로 래핑
 *
 * @see app2/src/types/jobPosting/preQuestionsProps.ts
 * @see app2/src/components/jobPosting/PreQuestionManager.tsx
 *
 * @example
 * ```tsx
 * // 사용 예시
 * const preQuestionsData = {
 *   usesPreQuestions: true,
 *   preQuestions: [
 *     {
 *       id: '1',
 *       question: '경력이 있으신가요?',
 *       type: 'select',
 *       options: ['1년 미만', '1-3년', '3년 이상'],
 *       required: true
 *     }
 *   ]
 * };
 *
 * const preQuestionsHandlers = {
 *   onToggle: (enabled) => setUsesPreQuestions(enabled),
 *   onQuestionChange: (index, field, value) => { ... },
 *   onOptionChange: (questionIndex, optionIndex, value) => { ... },
 *   onAddQuestion: () => { ... },
 *   onRemoveQuestion: (index) => { ... },
 *   onAddOption: (questionIndex) => { ... },
 *   onRemoveOption: (questionIndex, optionIndex) => { ... }
 * };
 *
 * <PreQuestionsSection
 *   data={preQuestionsData}
 *   handlers={preQuestionsHandlers}
 *   validation={{ errors: {}, touched: {} }}
 * />
 * ```
 */

import React from 'react';
import { PreQuestionsSectionProps } from '../../../../types/jobPosting/preQuestionsProps';
import Toggle from '../../../ui/Toggle';
import PreQuestionManager from '../../PreQuestionManager';

/**
 * PreQuestionsSection 컴포넌트 (React.memo 적용)
 *
 * Props Grouping 패턴:
 * - data: 사전 질문 데이터 (usesPreQuestions, preQuestions 배열)
 * - handlers: 이벤트 핸들러 (onToggle, onQuestionChange, onAddQuestion 등)
 * - validation: 검증 에러 (선택)
 *
 * 조건부 렌더링: usesPreQuestions가 true일 때만 PreQuestionManager 표시
 *
 * @component
 * @param {PreQuestionsSectionProps} props - Props Grouping 패턴
 * @param {PreQuestionsData} props.data - 사전 질문 데이터
 * @param {PreQuestionsHandlers} props.handlers - 이벤트 핸들러
 * @param {PreQuestionsValidation} [props.validation] - 검증 상태 (선택)
 * @returns {React.ReactElement} 사전 질문 섹션
 */
const PreQuestionsSection: React.FC<PreQuestionsSectionProps> = React.memo(({
  data,
  handlers,
  validation
}) => {
  return (
    <div className="space-y-4">
      {/* 사전질문 사용 여부 토글 */}
      <div className="flex items-center justify-between">
        <Toggle
          id="usesPreQuestions"
          checked={data.usesPreQuestions}
          onChange={handlers.onToggle}
          label="사전질문 사용하기"
          description="지원자에게 추가 정보를 요청할 수 있습니다"
        />
        {data.usesPreQuestions && (
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
            {data.preQuestions.length}개 질문
          </span>
        )}
      </div>

      {/* 조건부 렌더링: usesPreQuestions가 true일 때만 표시 */}
      {data.usesPreQuestions && (
        <div className="mt-4">
          {/* 기존 PreQuestionManager 컴포넌트 활용 */}
          <PreQuestionManager
            preQuestions={data.preQuestions}
            onPreQuestionChange={(questionIndex: number, field: string, value: any) =>
              handlers.onQuestionChange(questionIndex, field as keyof typeof data.preQuestions[0], value)
            }
            onPreQuestionOptionChange={handlers.onOptionChange}
            onAddPreQuestion={handlers.onAddQuestion}
            onRemovePreQuestion={handlers.onRemoveQuestion}
            onAddPreQuestionOption={handlers.onAddOption}
            onRemovePreQuestionOption={handlers.onRemoveOption}
          />

          {/* 검증 에러 표시 */}
          {validation?.touched && Object.keys(validation.errors).length > 0 && (
            <div className="mt-2 space-y-1">
              {Object.entries(validation.errors).map(([key, error]) =>
                error ? (
                  <p key={key} className="text-sm text-red-600 dark:text-red-400">
                    {error}
                  </p>
                ) : null
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

PreQuestionsSection.displayName = 'PreQuestionsSection';

export default PreQuestionsSection;
