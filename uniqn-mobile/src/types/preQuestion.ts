/**
 * UNIQN Mobile - 사전질문 타입 정의
 *
 * @description 구인공고 지원 시 추가 질문 및 답변 타입
 *
 * @version 1.0.0
 * @see app2/src/types/jobPosting/base.ts
 */

/**
 * 사전 질문 정의
 *
 * @description 구인공고 지원 시 추가로 물어보는 질문들을 정의합니다.
 */
export interface PreQuestion {
  /** 질문 고유 ID */
  id: string;

  /** 질문 내용 */
  question: string;

  /** 필수 응답 여부 */
  required: boolean;

  /**
   * 질문 타입
   * - text: 단답형 (한 줄)
   * - textarea: 장문형 (여러 줄)
   * - select: 선택형 (드롭다운)
   */
  type: 'text' | 'textarea' | 'select';

  /** 선택형 질문의 옵션들 (select 타입일 때만 사용) */
  options?: string[];
}

/**
 * 사전 질문 답변
 *
 * @description 지원자가 사전 질문에 대한 답변을 저장하는 타입입니다.
 */
export interface PreQuestionAnswer {
  /** 질문 ID (PreQuestion.id와 매칭) */
  questionId: string;

  /** 질문 텍스트 (표시용) */
  question: string;

  /** 답변 내용 */
  answer: string;

  /** 필수 여부 */
  required: boolean;
}

/**
 * 사전 질문 타입 라벨
 */
export const PRE_QUESTION_TYPE_LABELS: Record<PreQuestion['type'], string> = {
  text: '단답형',
  textarea: '장문형',
  select: '선택형',
};

/**
 * 사전질문 초기 답변 생성
 *
 * @param questions - 사전질문 배열
 * @returns 초기화된 답변 배열
 */
export function initializePreQuestionAnswers(questions: PreQuestion[]): PreQuestionAnswer[] {
  return questions.map((q) => ({
    questionId: q.id,
    question: q.question,
    answer: '',
    required: q.required,
  }));
}

/**
 * 필수 질문 답변 검증
 *
 * @param answers - 답변 배열
 * @returns 모든 필수 질문에 답변했는지 여부
 */
export function validateRequiredAnswers(answers: PreQuestionAnswer[]): boolean {
  return answers.every((a) => !a.required || a.answer.trim().length > 0);
}

/**
 * 미응답 필수 질문 찾기
 *
 * @param answers - 답변 배열
 * @returns 미응답 필수 질문 ID 배열
 */
export function findUnansweredRequired(answers: PreQuestionAnswer[]): string[] {
  return answers.filter((a) => a.required && !a.answer.trim()).map((a) => a.questionId);
}

/**
 * 답변 업데이트 헬퍼
 *
 * @param answers - 기존 답변 배열
 * @param questionId - 업데이트할 질문 ID
 * @param answer - 새 답변
 * @returns 업데이트된 답변 배열
 */
export function updateAnswer(
  answers: PreQuestionAnswer[],
  questionId: string,
  answer: string
): PreQuestionAnswer[] {
  return answers.map((a) => (a.questionId === questionId ? { ...a, answer } : a));
}
