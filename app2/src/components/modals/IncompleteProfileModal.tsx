import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface IncompleteProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  missingFieldLabels: string[];
}

/**
 * 프로필 미완성 안내 모달
 * 구인공고 지원 시 필수 프로필 필드가 없을 때 표시
 */
const IncompleteProfileModal: React.FC<IncompleteProfileModalProps> = ({
  isOpen,
  onClose,
  missingFieldLabels,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleGoToProfile = () => {
    onClose();
    navigate('/app/profile');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 animate-fade-in">
        {/* 헤더 */}
        <div className="flex items-center justify-center mb-4">
          <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
            <svg
              className="w-10 h-10 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>

        {/* 제목 */}
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 text-center mb-3">
          {t('profile.completeProfile', '프로필을 완성해주세요')}
        </h3>

        {/* 메시지 */}
        <div className="text-center mb-6">
          <p className="text-gray-600 dark:text-gray-300 mb-3">
            {t(
              'profile.requiredFieldsMessage',
              '구인공고에 지원하려면 프로필 필수 정보를 먼저 입력해야 합니다.'
            )}
          </p>

          {/* 필수 필드 목록 */}
          <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-4">
            <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
              {t('profile.enterFieldsBelow', '아래 정보를 입력해주세요:')}
            </p>
            <ul className="text-left text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
              {missingFieldLabels.map((label) => (
                <li key={label} className="flex items-center">
                  <svg
                    className="w-4 h-4 mr-2 text-yellow-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            {t('common.cancel', '취소')}
          </button>
          <button
            onClick={handleGoToProfile}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 dark:bg-blue-700 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
          >
            {t('profile.goToProfile', '프로필 작성하기')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncompleteProfileModal;
