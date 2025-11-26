import React from 'react';
import { Applicant } from './types';

interface PreQuestionDisplayProps {
  applicant: Applicant;
}

/**
 * 지원자의 사전질문 답변을 표시하는 컴포넌트
 */
const PreQuestionDisplay: React.FC<PreQuestionDisplayProps> = ({ applicant }) => {
  if (!applicant.preQuestionAnswers || applicant.preQuestionAnswers.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 p-2 w-full bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
      <div className="space-y-2">
        {applicant.preQuestionAnswers.map((answer, index) => (
          <div key={index} className="text-sm text-gray-900 dark:text-gray-100">
            <p className="font-medium text-gray-700 dark:text-gray-200">
              Q{index + 1}. {answer.question}
              {answer.required ? (
                <span className="text-red-500 dark:text-red-400 ml-1">*</span>
              ) : null}
            </p>
            <p className="text-gray-600 dark:text-gray-300 ml-4 mt-1">
              ▶{' '}
              {answer.answer || (
                <span className="text-gray-400 dark:text-gray-500">(답변 없음)</span>
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PreQuestionDisplay;
