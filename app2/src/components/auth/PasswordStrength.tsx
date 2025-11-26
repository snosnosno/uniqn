import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  validatePasswordRealtime,
  getPasswordStrengthColor,
  getPasswordStrengthText,
  PasswordValidationResult,
} from '../../utils/passwordValidator';
import { useTheme } from '../../contexts/ThemeContext';

interface PasswordStrengthProps {
  password: string;
  className?: string;
  showRequirements?: boolean;
}

const PasswordStrength: React.FC<PasswordStrengthProps> = ({
  password,
  className = '',
  showRequirements = true,
}) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();

  const validation = validatePasswordRealtime(password) as PasswordValidationResult;
  const { strength, score, checks } = validation;

  if (!password) {
    return null;
  }

  return (
    <div className={`password-strength ${className}`}>
      {/* 강도 프로그레스 바 */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {t('passwordStrength.title', '비밀번호 강도')}
          </span>
          <span
            className="text-sm font-medium"
            style={{ color: getPasswordStrengthColor(strength || 'weak', isDark) }}
          >
            {getPasswordStrengthText(strength || 'weak')} ({score || 0}%)
          </span>
        </div>

        {/* 프로그레스 바 */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="h-2 rounded-full transition-all duration-300 ease-in-out"
            style={{
              width: `${score || 0}%`,
              backgroundColor: getPasswordStrengthColor(strength || 'weak', isDark),
            }}
          />
        </div>
      </div>

      {/* 요구사항 체크리스트 */}
      {showRequirements && checks && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
            {t('passwordStrength.requirements', '비밀번호 요구사항')}
          </div>

          <div className="space-y-1">
            {/* 길이 체크 */}
            <div className="flex items-center text-sm">
              <div
                className={`w-4 h-4 rounded-full flex items-center justify-center mr-2 ${
                  checks.length ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                {checks.length && (
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
              <span
                className={
                  checks.length
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-500 dark:text-gray-400'
                }
              >
                {t('passwordStrength.length', '8자 이상')}
              </span>
            </div>

            {/* 영문자 체크 */}
            <div className="flex items-center text-sm">
              <div
                className={`w-4 h-4 rounded-full flex items-center justify-center mr-2 ${
                  checks.hasEnglish ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                {checks.hasEnglish && (
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
              <span
                className={
                  checks.hasEnglish
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-500 dark:text-gray-400'
                }
              >
                {t('passwordStrength.english', '영문자 포함')}
              </span>
            </div>

            {/* 숫자 체크 */}
            <div className="flex items-center text-sm">
              <div
                className={`w-4 h-4 rounded-full flex items-center justify-center mr-2 ${
                  checks.hasNumbers ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                {checks.hasNumbers && (
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </div>
              <span
                className={
                  checks.hasNumbers
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-gray-500 dark:text-gray-400'
                }
              >
                {t('passwordStrength.numbers', '숫자 포함')}
              </span>
            </div>

            {/* 특수문자 보너스 (선택사항) */}
            {checks.hasSpecialChars && (
              <div className="flex items-center text-sm">
                <div className="w-4 h-4 rounded-full flex items-center justify-center mr-2 bg-blue-500 dark:bg-blue-600">
                  <svg
                    className="w-3 h-3 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </div>
                <span className="text-blue-600 dark:text-blue-400">
                  {t('passwordStrength.specialChars', '특수문자 포함 (보너스 +10점)')}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PasswordStrength;
