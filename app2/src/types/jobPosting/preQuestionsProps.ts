/**
 * PreQuestionsSection Props 타입
 *
 * @see app2/src/components/jobPosting/JobPostingForm/sections/PreQuestionsSection.tsx
 */

import { SectionProps } from './sectionProps';
import { PreQuestion } from './base';

/**
 * PreQuestions 섹션 데이터
 */
export interface PreQuestionsData {
  /** 사전질문 사용 여부 */
  usesPreQuestions: boolean;

  /** 사전질문 배열 */
  preQuestions: PreQuestion[];
}

/**
 * PreQuestions 섹션 이벤트 핸들러
 */
export interface PreQuestionsHandlers {
  /**
   * 사전질문 사용 여부 토글 핸들러
   * @param enabled - 사용 여부
   */
  onToggle: (enabled: boolean) => void;

  /**
   * 질문 변경 핸들러
   * @param index - 질문 인덱스
   * @param field - 변경할 필드명 (question, required, type)
   * @param value - 새로운 값 (string | boolean | string[])
   */
  onQuestionChange: (index: number, field: keyof PreQuestion, value: string | boolean | string[]) => void;

  /**
   * 옵션 변경 핸들러 (select 타입 질문)
   * @param questionIndex - 질문 인덱스
   * @param optionIndex - 옵션 인덱스
   * @param value - 새로운 옵션 값
   */
  onOptionChange: (questionIndex: number, optionIndex: number, value: string) => void;

  /**
   * 질문 추가 핸들러
   */
  onAddQuestion: () => void;

  /**
   * 질문 삭제 핸들러
   * @param index - 삭제할 질문 인덱스
   */
  onRemoveQuestion: (index: number) => void;

  /**
   * 옵션 추가 핸들러 (select 타입 질문)
   * @param questionIndex - 질문 인덱스
   */
  onAddOption: (questionIndex: number) => void;

  /**
   * 옵션 삭제 핸들러 (select 타입 질문)
   * @param questionIndex - 질문 인덱스
   * @param optionIndex - 삭제할 옵션 인덱스
   */
  onRemoveOption: (questionIndex: number, optionIndex: number) => void;
}

/**
 * PreQuestions 섹션 검증 에러
 *
 * 질문 인덱스별 에러 메시지
 */
export interface PreQuestionErrors {
  question?: string;
  type?: string;
  options?: string;
  [key: string]: string | undefined;
}

/**
 * PreQuestions 섹션 검증 상태
 */
export interface PreQuestionsValidation {
  /** 에러 메시지 */
  errors: Record<string, string>;

  /** touched 상태 */
  touched: Record<string, boolean>;
}

/**
 * PreQuestionsSection Props
 */
export interface PreQuestionsSectionProps extends SectionProps<
  PreQuestionsData,
  PreQuestionsHandlers,
  PreQuestionsValidation
> {}
