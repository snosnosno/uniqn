import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { logger } from '../../utils/logger';
import { toast } from '../../utils/toast';
import {
  initializeKakaoSDK,
  loginWithKakao,
  getKakaoUserInfo,
  KakaoUserInfo,
  KakaoAuthResponse
} from '../../utils/kakaoSdk';

interface KakaoLoginButtonProps {
  onSuccess: (kakaoUserInfo: KakaoUserInfo, authResponse: KakaoAuthResponse) => void;
  onError: (error: Error) => void;
  className?: string;
  disabled?: boolean;
}

const KakaoLoginButton: React.FC<KakaoLoginButtonProps> = ({
  onSuccess,
  onError,
  className = '',
  disabled = false
}) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  // 카카오 JavaScript 키 (환경변수에서 로드, 없으면 개발용 키 사용)
  const KAKAO_APP_KEY = process.env.REACT_APP_KAKAO_JS_KEY || 'your-kakao-js-key-here';

  const handleKakaoLogin = async () => {
    if (disabled || isLoading) return;

    setIsLoading(true);

    try {
      logger.info('카카오 로그인 시작', { component: 'KakaoLoginButton' });

      // 카카오 SDK 초기화
      await initializeKakaoSDK(KAKAO_APP_KEY);

      // 카카오 로그인
      const authResponse = await loginWithKakao();
      logger.info('카카오 인증 성공', {
        component: 'KakaoLoginButton',
        data: { tokenType: authResponse.token_type }
      });

      // 사용자 정보 가져오기
      const userInfo = await getKakaoUserInfo();
      logger.info('카카오 사용자 정보 조회 성공', {
        component: 'KakaoLoginButton',
        data: {
          userId: userInfo.id,
          hasEmail: !!userInfo.kakao_account?.email,
          hasNickname: !!userInfo.properties?.nickname
        }
      });

      // 성공 콜백 호출
      onSuccess(userInfo, authResponse);

    } catch (error) {
      logger.error('카카오 로그인 실패:', error instanceof Error ? error : new Error(String(error)), {
        component: 'KakaoLoginButton'
      });

      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다';
      toast.error(t('kakaoLogin.error', `카카오 로그인 실패: ${errorMessage}`));
      onError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleKakaoLogin}
      disabled={disabled || isLoading}
      className={`
        w-full inline-flex justify-center items-center py-3 px-4
        border border-gray-300 rounded-md shadow-sm
        text-sm font-medium text-gray-700
        bg-yellow-400 hover:bg-yellow-500
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500
        disabled:bg-gray-300 disabled:cursor-not-allowed
        transition-colors duration-200
        ${className}
      `}
      style={{
        backgroundColor: disabled || isLoading ? '#D1D5DB' : '#FEE500',
        borderColor: disabled || isLoading ? '#D1D5DB' : '#FEE500'
      }}
    >
      {/* 카카오 로고 */}
      <svg
        className="w-5 h-5 mr-2"
        viewBox="0 0 24 24"
        fill="none"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12 3C7.03125 3 3 6.24187 3 10.25C3 12.6031 4.45313 14.6437 6.59375 15.8L5.84375 18.7094C5.8125 18.8281 5.85 18.9531 5.94375 19.0344C6.00937 19.0906 6.09687 19.125 6.1875 19.125C6.24375 19.125 6.30313 19.1094 6.35625 19.075L9.86875 16.9C10.5719 17.0219 11.2812 17.0812 12 17.0812C16.9687 17.0812 21 13.8394 21 9.83125C21 5.82312 16.9687 2.58125 12 2.58125V3Z"
          fill="currentColor"
        />
      </svg>

      <span>
        {isLoading
          ? t('kakaoLogin.loading', '카카오 로그인 중...')
          : t('kakaoLogin.button', '카카오로 로그인')
        }
      </span>
    </button>
  );
};

export default KakaoLoginButton;