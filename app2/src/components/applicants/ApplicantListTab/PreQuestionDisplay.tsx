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
    <div className="mt-3 p-2 w-full bg-blue-50 rounded-lg border border-blue-200">
      <h5 className="font-medium text-blue-800 mb-2">질문 답변</h5>
      <div className="space-y-2">
        {applicant.preQuestionAnswers.map((answer, index) => (
          <div key={index} className="text-sm">
            <p className="font-medium text-gray-700">
              Q{index + 1}. {answer.question}
              {answer.required ? <span className="text-red-500 ml-1">*</span> : null}
            </p>
            <p className="text-gray-600 ml-4 mt-1">
              ▶ {answer.answer || <span className="text-gray-400">(답변 없음)</span>}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PreQuestionDisplay;