import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useToast } from '../contexts/ToastContext';
import { PreQuestion, PreQuestionAnswer } from '../types/jobPosting';

interface PreQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (answers: PreQuestionAnswer[]) => void;
  questions: PreQuestion[];
  jobPostingId?: string;
}

const PreQuestionModal: React.FC<PreQuestionModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  questions,
  jobPostingId
}) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToast();
  
  // 답변 상태 관리
  const [answers, setAnswers] = useState<{ [questionId: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // localStorage 키 생성
  const getStorageKey = () => {
    return `preQuestionAnswers_${jobPostingId || 'default'}`;
  };

  // 초기화 시 localStorage에서 기존 답변 복원
  useEffect(() => {
    if (isOpen && questions.length > 0) {
      const savedAnswers = localStorage.getItem(getStorageKey());
      if (savedAnswers) {
        try {
          const parsed = JSON.parse(savedAnswers);
          setAnswers(parsed);
        } catch (error) {
          console.error('Failed to parse saved answers:', error);
        }
      }
    }
  }, [isOpen, questions, jobPostingId]);

  // 답변 변경 시 localStorage에 자동 저장
  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      localStorage.setItem(getStorageKey(), JSON.stringify(answers));
    }
  }, [answers, jobPostingId]);

  // 답변 업데이트 핸들러
  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  // 유효성 검사
  const validateAnswers = (): boolean => {
    const requiredQuestions = questions.filter(q => q.required);
    
    for (const question of requiredQuestions) {
      const answer = answers[question.id];
      if (!answer || answer.trim() === '') {
        showError(
          `"${question.question}" ${t('jobBoard.preQuestion.requiredField')}`
        );
        return false;
      }
    }
    
    return true;
  };

  // 제출 핸들러
  const handleSubmit = async () => {
    if (!validateAnswers()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      // PreQuestionAnswer 형식으로 변환 (질문 텍스트도 함께 저장)
      const formattedAnswers: PreQuestionAnswer[] = questions.map(question => ({
        questionId: question.id,
        question: question.question, // 질문 텍스트 추가
        answer: answers[question.id] || '',
        required: question.required // 필수 여부도 추가
      }));

      // 완료 콜백 호출
      onComplete(formattedAnswers);
      
      // localStorage 정리
      localStorage.removeItem(getStorageKey());
      
      showSuccess(t('jobBoard.preQuestion.success'));
      onClose();
      
    } catch (error) {
      console.error('Failed to submit pre-questions:', error);
      showError(t('jobBoard.preQuestion.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 진행률 계산
  const getProgress = (): number => {
    if (questions.length === 0) return 100;
    
    const answeredCount = questions.filter(q => 
      answers[q.id] && answers[q.id]?.trim() !== ''
    ).length;
    
    return Math.round((answeredCount / questions.length) * 100);
  };

  // 모달이 닫혀있으면 렌더링하지 않음
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" 
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex justify-between items-center p-4 border-b">
          <div className="flex-1">
            <h2 className="text-xl font-bold">
              {t('jobBoard.preQuestion.modalTitle')}
            </h2>
            {questions.length > 0 && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>진행률: {getProgress()}%</span>
                  <span>{questions.length}개 질문</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${getProgress()}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 text-2xl ml-4"
          >
            &times;
          </button>
        </div>
        
        {/* 내용 */}
        <div className="p-6 overflow-y-auto flex-1">
          {questions.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              {t('jobBoard.preQuestion.noQuestions')}
            </p>
          ) : (
            <div className="space-y-6">
              {questions.map((question, index) => (
                <div key={question.id} className="space-y-2">
                  {/* 질문 제목 */}
                  <label className="block text-sm font-medium text-gray-900">
                    <span className="text-blue-600 font-semibold">Q{index + 1}.</span>{' '}
                    {question.question}
                    {question.required ? <span className="text-red-500 ml-1">*</span> : null}
                  </label>
                  
                  {/* 질문 타입별 입력 컴포넌트 */}
                  {question.type === 'text' && (
                    <input
                      type="text"
                      value={answers[question.id] || ''}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      placeholder={t('jobBoard.preQuestion.answerPlaceholder')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  )}
                  
                  {question.type === 'textarea' && (
                    <textarea
                      value={answers[question.id] || ''}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      placeholder={t('jobBoard.preQuestion.answerPlaceholder')}
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  )}
                  
                  {question.type === 'select' && question.options ? <select
                      value={answers[question.id] || ''}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">
                        {t('jobBoard.preQuestion.selectOption')}
                      </option>
                      {question.options.map((option, optionIndex) => (
                        <option key={optionIndex} value={option}>
                          {option}
                        </option>
                      ))}
                    </select> : null}
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* 푸터 */}
        {questions.length > 0 && (
          <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting 
                ? t('jobBoard.preQuestion.submitting')
                : t('jobBoard.preQuestion.submit')
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PreQuestionModal;