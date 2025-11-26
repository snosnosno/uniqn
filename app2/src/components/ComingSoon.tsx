import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * ComingSoon 컴포넌트 Props
 */
interface ComingSoonProps {
  /**
   * 준비 중인 기능 이름
   * @example "토너먼트 관리"
   */
  feature?: string;

  /**
   * 추가 설명 메시지
   * @example "더 나은 경험을 위해 준비 중입니다."
   */
  description?: string;

  /**
   * 예상 출시 시기 (선택사항)
   * @example "2025년 2분기"
   */
  estimatedRelease?: string;

  /**
   * 되돌아갈 경로 (기본값: 이전 페이지)
   */
  backPath?: string;

  /**
   * 되돌아가기 버튼 텍스트 (기본값: "돌아가기")
   */
  backButtonText?: string;

  /**
   * 아이콘 이모지 (기본값: "🚧")
   */
  icon?: string;
}

/**
 * 준비 중인 기능 안내 컴포넌트
 *
 * Feature Flag로 비활성화된 기능에 접근했을 때 표시되는 페이지입니다.
 * 사용자에게 친화적인 안내 메시지와 함께 이전 페이지로 돌아갈 수 있는 버튼을 제공합니다.
 *
 * @example
 * // 기본 사용
 * <ComingSoon feature="토너먼트 관리" />
 *
 * @example
 * // 상세 정보 포함
 * <ComingSoon
 *   feature="토너먼트 관리"
 *   description="더 나은 경험을 위해 준비 중입니다."
 *   estimatedRelease="2025년 2분기"
 *   backPath="/app/profile"
 *   icon="🏆"
 * />
 */
const ComingSoon: React.FC<ComingSoonProps> = ({
  feature = '이 기능',
  description = '추후 다시 공개될 예정입니다.',
  estimatedRelease,
  backPath,
  backButtonText = '돌아가기',
  icon = '🚧',
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (backPath) {
      navigate(backPath);
    } else {
      navigate(-1); // 이전 페이지로 이동
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="text-center max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 space-y-6">
        {/* 아이콘 */}
        <div className="text-7xl mb-4 animate-bounce">{icon}</div>

        {/* 제목 */}
        <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">준비 중입니다</h2>

        {/* 기능 이름 */}
        <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-4 py-2 rounded-lg inline-block">
          <p className="text-lg font-semibold">{feature}</p>
        </div>

        {/* 설명 */}
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{description}</p>

        {/* 예상 출시 시기 */}
        {estimatedRelease && (
          <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">예상 출시</p>
            <p className="text-base font-medium text-gray-700 dark:text-gray-200">
              {estimatedRelease}
            </p>
          </div>
        )}

        {/* 구분선 */}
        <div className="border-t border-gray-200 dark:border-gray-700 my-6"></div>

        {/* 안내 메시지 */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-600 p-4 rounded">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-400 dark:text-yellow-500"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                현재 업데이트 작업이 진행 중입니다.
                <br />더 나은 서비스를 위해 최선을 다하고 있습니다.
              </p>
            </div>
          </div>
        </div>

        {/* 버튼 그룹 */}
        <div className="space-y-3 pt-4">
          {/* 돌아가기 버튼 */}
          <button
            onClick={handleBack}
            className="w-full px-6 py-3 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors shadow-md hover:shadow-lg font-medium"
          >
            {backButtonText}
          </button>

          {/* 홈으로 가기 버튼 */}
          <button
            onClick={() => navigate('/')}
            className="w-full px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            홈으로 가기
          </button>
        </div>

        {/* 푸터 */}
        <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            문의사항이 있으시면 고객센터로 연락해주세요.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ComingSoon;
