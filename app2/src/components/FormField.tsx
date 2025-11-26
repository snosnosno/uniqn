import React, { useState } from 'react';
import { FaEye, FaEyeSlash } from './Icons/ReactIconsReplacement';

interface FormFieldProps {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  error?: string | null;
  autoComplete?: string;
  maxLength?: number;
  /** 도움말 텍스트 */
  helpText?: string;
  /** 성공 상태 표시 */
  success?: boolean;
}

/**
 * 접근성이 개선된 폼 필드 컴포넌트
 *
 * 접근성 기능:
 * - aria-invalid: 에러 상태 표시
 * - aria-describedby: 에러/도움말 텍스트 연결
 * - role="alert": 에러 메시지 실시간 알림
 * - 시각적 피드백: 에러/성공 상태 표시
 */
const FormField: React.FC<FormFieldProps> = ({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  error = null,
  autoComplete,
  maxLength,
  helpText,
  success = false,
}) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const isPasswordType = type === 'password';
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;
  const hasError = !!error;

  // aria-describedby에 연결할 ID 목록
  const describedByIds =
    [hasError ? errorId : null, helpText ? helpId : null].filter(Boolean).join(' ') || undefined;

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  // 입력 필드 상태에 따른 스타일
  const getInputStyles = () => {
    const baseStyles =
      'w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 transition-colors';

    if (hasError) {
      return `${baseStyles} border-red-500 dark:border-red-400 focus:ring-red-500 dark:focus:ring-red-400`;
    }
    if (success) {
      return `${baseStyles} border-green-500 dark:border-green-400 focus:ring-green-500 dark:focus:ring-green-400`;
    }
    return `${baseStyles} border-gray-300 dark:border-gray-600 focus:ring-indigo-500 dark:focus:ring-indigo-400`;
  };

  return (
    <div className="mb-4">
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
      >
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={isPasswordType && isPasswordVisible ? 'text' : type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          maxLength={maxLength}
          aria-invalid={hasError}
          aria-describedby={describedByIds}
          aria-required={required}
          className={getInputStyles()}
        />
        {isPasswordType && (
          <button
            type="button"
            onClick={togglePasswordVisibility}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
            aria-label={isPasswordVisible ? '비밀번호 숨기기' : '비밀번호 보기'}
          >
            {isPasswordVisible ? (
              <FaEyeSlash className="w-5 h-5" aria-hidden="true" />
            ) : (
              <FaEye className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
        )}
        {/* 성공 아이콘 */}
        {success && !isPasswordType && (
          <span
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-green-500 dark:text-green-400"
            aria-hidden="true"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        )}
      </div>
      {/* 도움말 텍스트 */}
      {helpText && !hasError && (
        <p id={helpId} className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {helpText}
        </p>
      )}
      {/* 에러 메시지 */}
      {hasError && (
        <p
          id={errorId}
          role="alert"
          className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center"
        >
          <svg
            className="w-4 h-4 mr-1 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
};

export default FormField;
