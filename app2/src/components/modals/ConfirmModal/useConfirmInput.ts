import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TextInputValidation, UseConfirmInputReturn } from './types';

/**
 * 확인 모달의 텍스트 입력 검증을 관리하는 커스텀 훅
 *
 * @description
 * - 입력값과 확인값의 일치 여부 검증
 * - 대소문자 구분 옵션 지원
 * - 메모이제이션으로 불필요한 재계산 방지
 * - 에러 메시지 국제화 지원
 *
 * @param validation - 텍스트 입력 검증 설정 (없으면 항상 유효)
 * @returns 입력 상태 및 유효성 검사 결과
 *
 * @example
 * ```tsx
 * const { inputValue, setInputValue, isValid, errorMessage, reset } = useConfirmInput({
 *   placeholder: '삭제',
 *   confirmValue: '삭제',
 *   caseSensitive: true,
 * });
 * ```
 */
export const useConfirmInput = (
  validation: TextInputValidation | undefined
): UseConfirmInputReturn => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState('');

  /**
   * 입력값 유효성 검증
   * - validation이 없으면 항상 true
   * - caseSensitive 옵션에 따라 대소문자 구분 처리
   */
  const isValid = useMemo(() => {
    if (!validation) return true;

    const { confirmValue, caseSensitive = true } = validation;

    if (caseSensitive) {
      return inputValue === confirmValue;
    }

    return inputValue.toLowerCase() === confirmValue.toLowerCase();
  }, [inputValue, validation]);

  /**
   * 에러 메시지 생성
   * - 입력값이 있고 유효하지 않을 때만 표시
   * - 국제화 키를 통한 다국어 지원
   */
  const errorMessage = useMemo(() => {
    if (!validation || !inputValue || isValid) return null;

    return t('confirmModal.inputMismatch', {
      value: validation.confirmValue,
      defaultValue: `입력값이 일치하지 않습니다. "${validation.confirmValue}"를 정확히 입력해주세요.`,
    });
  }, [inputValue, isValid, validation, t]);

  /**
   * 입력값 초기화
   * 모달이 열릴 때 또는 닫힐 때 호출
   */
  const reset = useCallback(() => {
    setInputValue('');
  }, []);

  return {
    inputValue,
    setInputValue,
    isValid,
    reset,
    errorMessage,
  };
};

export default useConfirmInput;
