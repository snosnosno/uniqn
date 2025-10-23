import React, { useState, useEffect } from "react";
import { logger } from '../utils/logger';
import { useTranslation } from 'react-i18next';
import { FaGoogle } from '../components/Icons/ReactIconsReplacement';
import { useNavigate, Link } from "react-router-dom";

import AuthLayout from '../components/auth/AuthLayout';
import FormField from "../components/FormField";
// 카카오 로그인 기능 - 나중에 다시 활성화 예정
// import KakaoLoginButton from '../components/auth/KakaoLoginButton';
import { useAuth } from "../contexts/AuthContext";
// import { KakaoUserInfo, KakaoAuthResponse } from '../utils/kakaoSdk';
import { recordLoginAttempt, isLoginBlocked, formatBlockTime } from '../services/authSecurity';


const Login: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [isBlocked, setIsBlocked] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const navigate = useNavigate();
  const { signIn, signInWithGoogle /* , signInWithKakao */ } = useAuth();

  // 컴포넌트 마운트 시 이전 설정 불러오기 및 차단 상태 확인
  useEffect(() => {
    const savedRememberMe = localStorage.getItem('rememberMe');
    if (savedRememberMe) {
      try {
        // boolean 값만 허용 (암호화된 문자열은 무시)
        const parsed = JSON.parse(savedRememberMe);
        if (typeof parsed === 'boolean') {
          setRememberMe(parsed);
          logger.info('로그인 설정 복원 완료', {
            component: 'Login',
            data: { rememberMe: parsed }
          });
        } else {
          // 잘못된 형식의 데이터는 제거
          localStorage.removeItem('rememberMe');
        }
      } catch (error) {
        // JSON 파싱 실패 시 (암호화된 데이터 등) 제거
        logger.debug('로그인 설정 파싱 실패, 초기화합니다', { component: 'Login' });
        localStorage.removeItem('rememberMe');
      }
    }

    // 로그인 차단 상태 확인
    const checkBlockStatus = async () => {
      try {
        const blockStatus = await isLoginBlocked(email);
        if (blockStatus.isBlocked && blockStatus.remainingTime) {
          setIsBlocked(true);
          setAttempts(blockStatus.attempts || 0);
          setError(t('login.blockedMessage', `로그인 시도가 너무 많아 ${formatBlockTime(blockStatus.remainingTime)} 후에 다시 시도할 수 있습니다.`));
        } else {
          setAttempts(blockStatus.attempts || 0);
        }
      } catch (error) {
        logger.error('로그인 차단 상태 확인 실패:', error instanceof Error ? error : new Error(String(error)), { component: 'Login' });
      }
    };

    checkBlockStatus();
  }, [email, t]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // 차단 상태 재확인
    try {
      const blockStatus = await isLoginBlocked(email);
      if (blockStatus.isBlocked && blockStatus.remainingTime) {
        setIsBlocked(true);
        setError(t('login.blockedMessage', `로그인 시도가 너무 많아 ${formatBlockTime(blockStatus.remainingTime)} 후에 다시 시도할 수 있습니다.`));
        return;
      }
    } catch (blockCheckError) {
      logger.error('로그인 차단 상태 재확인 실패:', blockCheckError instanceof Error ? blockCheckError : new Error(String(blockCheckError)), { component: 'Login' });
    }

    try {
      await signIn(email, password, rememberMe);

      // 로그인 성공 시 시도 기록
      await recordLoginAttempt(email, true);

      navigate("/app");
    } catch (err: any) {
      // 로그인 실패 시 시도 기록
      await recordLoginAttempt(email, false);

      if (err.code === 'auth/user-disabled') {
        setError(t('adminLogin.approvalPending'));
      } else {
        setError(t('adminLogin.errorMessage'));
      }

      logger.error('로그인 실패:', err instanceof Error ? err : new Error(String(err)), { component: 'Login' });

      // 차단 상태 업데이트 확인
      try {
        const blockStatus = await isLoginBlocked(email);
        if (blockStatus.isBlocked && blockStatus.remainingTime) {
          setIsBlocked(true);
          setError(t('login.blockedMessage', `로그인 시도가 너무 많아 ${formatBlockTime(blockStatus.remainingTime)} 후에 다시 시도할 수 있습니다.`));
        } else {
          setAttempts(blockStatus.attempts || 0);
        }
      } catch (blockUpdateError) {
        logger.error('차단 상태 업데이트 확인 실패:', blockUpdateError instanceof Error ? blockUpdateError : new Error(String(blockUpdateError)), { component: 'Login' });
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    try {
      await signInWithGoogle();
      navigate('/app');
    } catch (err: any) {
      setError(t('googleSignIn.error'));
      logger.error('Google Sign-In Error:', err instanceof Error ? err : new Error(String(err)), { component: 'Login' });
    }
  };

  // 카카오 로그인 핸들러 - 나중에 다시 활성화 예정
  /*
  const handleKakaoSignIn = async (userInfo: KakaoUserInfo, authResponse: KakaoAuthResponse) => {
    setError('');
    try {
      await signInWithKakao(authResponse.access_token, userInfo);
      navigate('/app');
    } catch (err: any) {
      setError(t('kakaoSignIn.error', '카카오 로그인에 실패했습니다.'));
      logger.error('Kakao Sign-In Error:', err instanceof Error ? err : new Error(String(err)), { component: 'Login' });
    }
  };

  const handleKakaoSignInError = (error: Error) => {
    setError(t('kakaoSignIn.error', '카카오 로그인에 실패했습니다.'));
    logger.error('Kakao Sign-In Error:', error, { component: 'Login' });
  };
  */

  return (
    <AuthLayout title={t('common.login')}>
      <form className="space-y-6" onSubmit={handleLogin}>
        <FormField
          id="email"
          label={t('common.emailAddress')}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('common.emailAddress')}
          required
          autoComplete="email"
        />
        <FormField
          id="password"
          label={t('common.password')}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('common.password')}
          required
          autoComplete="current-password"
        />
        
        {/* 보안 상태 표시 */}
        {attempts > 0 && !isBlocked && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 15.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  {t('login.attemptWarning', `로그인 실패: ${attempts}회. 5회 실패 시 15분간 차단됩니다.`)}
                </p>
              </div>
            </div>
          </div>
        )}

        {error ? <p className="text-red-500 text-sm text-center">{error}</p> : null}

        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              disabled={isBlocked}
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
              {t('login.rememberMe', '로그인 상태 유지')}
            </label>
          </div>
          <div className="text-sm">
            <Link to="/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-500">
              {t('login.forgotPassword')}
            </Link>
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={isBlocked}
            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
              isBlocked
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700'
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
          >
            {isBlocked ? t('login.blockedButton', '차단됨') : t('common.login')}
          </button>
        </div>
      </form>
      
      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">{t('login.orContinueWith')}</span>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <button
            onClick={handleGoogleSignIn}
            disabled={isBlocked}
            className={`w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium ${
              isBlocked
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            <FaGoogle className="h-5 w-5" />
            <span className="ml-2">{t('login.googleSignIn')}</span>
          </button>

          {/* 카카오 로그인 버튼 - 나중에 다시 활성화 예정 */}
          {/*
          <KakaoLoginButton
            onSuccess={handleKakaoSignIn}
            onError={handleKakaoSignInError}
            disabled={isBlocked}
          />
          */}
        </div>
      </div>

      <div className="mt-4 text-sm text-center">
        <Link to="/signup" className="font-medium text-indigo-600 hover:text-indigo-500">
          {t('login.noAccount')}
        </Link>
      </div>
    </AuthLayout>
  );
};

export default Login;
