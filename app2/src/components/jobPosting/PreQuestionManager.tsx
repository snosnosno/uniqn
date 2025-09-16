import React from 'react';
import { PreQuestion } from '../../types/jobPosting';
import Button from '../common/Button';
import Input from '../ui/Input';
import { Select } from '../common/Select';
import { EmptyState } from '../common';

interface PreQuestionManagerProps {
  preQuestions: PreQuestion[];
  onPreQuestionChange: (questionIndex: number, field: string, value: any) => void;
  onPreQuestionOptionChange: (questionIndex: number, optionIndex: number, value: string) => void;
  onAddPreQuestion: () => void;
  onRemovePreQuestion: (index: number) => void;
  onAddPreQuestionOption: (questionIndex: number) => void;
  onRemovePreQuestionOption: (questionIndex: number, optionIndex: number) => void;
}

const PreQuestionManager: React.FC<PreQuestionManagerProps> = ({
  preQuestions,
  onPreQuestionChange,
  onPreQuestionOptionChange,
  onAddPreQuestion,
  onRemovePreQuestion,
  onAddPreQuestionOption,
  onRemovePreQuestionOption,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-medium text-gray-700">사전질문</h4>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onAddPreQuestion}
        >
          질문 추가
        </Button>
      </div>

      {preQuestions.map((question, questionIndex) => (
        <div key={question.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">
              질문 {questionIndex + 1}
            </span>
            {preQuestions.length > 1 && (
              <Button
                type="button"
                variant="danger"
                size="xs"
                onClick={() => onRemovePreQuestion(questionIndex)}
              >
                삭제
              </Button>
            )}
          </div>

          {/* 질문 내용 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              질문 내용
            </label>
            <Input
              type="text"
              placeholder="질문을 입력하세요"
              value={question.question}
              onChange={(e) => onPreQuestionChange(questionIndex, 'question', e.target.value)}
              required
            />
          </div>

          {/* 질문 타입 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                질문 타입
              </label>
              <Select
                value={question.type}
                onChange={(value) => onPreQuestionChange(questionIndex, 'type', value)}
                options={[
                  { value: 'text', label: '단답형' },
                  { value: 'textarea', label: '장문형' },
                  { value: 'select', label: '선택형' }
                ]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                필수 여부
              </label>
              <Select
                value={question.required ? 'true' : 'false'}
                onChange={(value) => onPreQuestionChange(questionIndex, 'required', value === 'true')}
                options={[
                  { value: 'true', label: '필수' },
                  { value: 'false', label: '선택' }
                ]}
              />
            </div>
          </div>

          {/* 선택형 옵션들 */}
          {question.type === 'select' && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-gray-700">
                  선택 옵션
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => onAddPreQuestionOption(questionIndex)}
                >
                  + 옵션 추가
                </Button>
              </div>

              {(question.options || []).map((option, optionIndex) => (
                <div key={optionIndex} className="flex space-x-2 items-center">
                  <Input
                    type="text"
                    placeholder={`옵션 ${optionIndex + 1}`}
                    value={option}
                    onChange={(e) => onPreQuestionOptionChange(questionIndex, optionIndex, e.target.value)}
                    className="flex-1"
                  />
                  {(question.options?.length || 0) > 1 && (
                    <Button
                      type="button"
                      variant="danger"
                      size="xs"
                      onClick={() => onRemovePreQuestionOption(questionIndex, optionIndex)}
                    >
                      삭제
                    </Button>
                  )}
                </div>
              ))}

              {(!question.options || question.options.length === 0) && (
                <EmptyState
                  title="선택 옵션을 추가해주세요."
                  action={
                    <Button
                      type="button"
                      variant="primary"
                      size="xs"
                      onClick={() => onAddPreQuestionOption(questionIndex)}
                    >
                      첫 번째 옵션 추가
                    </Button>
                  }
                  className="py-4"
                />
              )}
            </div>
          )}
        </div>
      ))}

      {preQuestions.length === 0 && (
        <EmptyState
          title="사전질문을 추가해주세요."
          action={
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onAddPreQuestion}
            >
              첫 번째 질문 추가
            </Button>
          }
        />
      )}
    </div>
  );
};

export default PreQuestionManager;