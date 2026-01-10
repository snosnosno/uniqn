import React, { useState, useEffect } from 'react';
import { logger } from '../utils/logger';
import { useTranslation } from 'react-i18next';
import { FaGoogle } from '../components/Icons/ReactIconsReplacement';
import { useNavigate, Link } from 'react-router-dom';
import { FirebaseError } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

import AuthLayout from '../components/auth/AuthLayout';
import FormField from '../components/FormField';
import LoginBlockedModal from '../components/modals/LoginBlockedModal';
import { useAuth, LoginBlockedError } from '../contexts/AuthContext';
import type { Penalty } from '../types/penalty';
import { secureStorage } from '../utils/secureStorage';

const Login: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [blockedPenalty, setBlockedPenalty] = useState<Penalty | null>(null);
  const [showLoginBlockedModal, setShowLoginBlockedModal] = useState(false);
  const navigate = useNavigate();
  const { signIn, signInWithGoogle /* , signInWithKakao */ } = useAuth();

  // 🔍 디버깅: 환경 변수 확인 (개발 환경에서만)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Firebase API Key (first 10 chars):', {
        component: 'Login',
        data: {
          apiKey: process.env.REACT_APP_FIREBASE_API_KEY?.slice(0, 10) + '...',
          projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
        },
      });
    }
  }, []);

  // 컴포넌트 마운트 시 이전 설정 불러오기
  useEffect(() => {
    const savedRememberMe = secureStorage.getItem('rememberMe');
    if (savedRememberMe) {
      try {
        const parsed = JSON.parse(savedRememberMe);
        if (typeof parsed === 'boolean') {
          setRememberMe(parsed);
          logger.info('로그인 설정 복원 완료', {
            component: 'Login',
            data: { rememberMe: parsed },
          });
        } else {
          secureStorage.removeItem('rememberMe');
        }
      } catch (error) {
        logger.debug('로그인 설정 파싱 실패, 초기화합니다', { component: 'Login' });
        secureStorage.removeItem('rememberMe');
      }
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const userCredential = await signIn(email, password, rememberMe);

      // 약관 동의 여부 확인 (Google 로그인과 동일하게)
      const db = getFirestore();
      const consentRef = doc(db, 'users', userCredential.user.uid, 'consents', 'current');
      const consentDoc = await getDoc(consentRef);

      if (!consentDoc.exists()) {
        // 동의 내역이 없으면 약관 동의 페이지로 이동
        logger.info('동의 내역 없음, 약관 동의 페이지로 이동', {
          component: 'Login',
          data: { userId: userCredential.user.uid },
        });
        navigate('/consent', { state: { from: '/app' } });
        return;
      }

      navigate('/app');
    } catch (err: unknown) {
      // 패널티 로그인 차단 - 모달로 상세 정보 표시
      if (err instanceof LoginBlockedError) {
        setBlockedPenalty(err.penalty);
        setShowLoginBlockedModal(true);
        logger.warn('패널티 차단된 사용자 로그인 시도', {
          component: 'Login',
          data: { email, penaltyId: err.penalty.id },
        });
        return;
      }

      // FirebaseError 타입 체크
      if (err instanceof FirebaseError) {
        switch (err.code) {
          case 'auth/user-disabled':
            setError(
              t('adminLogin.approvalPending', '계정이 비활성화되었습니다. 관리자에게 문의하세요.')
            );
            break;
          case 'auth/invalid-credential':
          case 'auth/wrong-password':
          case 'auth/user-not-found':
            setError(t('adminLogin.errorMessage', '이메일 또는 비밀번호가 올바르지 않습니다.'));
            break;
          case 'auth/too-many-requests':
            setError(
              t('login.tooManyRequests', '너무 많은 시도가 있었습니다. 잠시 후 다시 시도해주세요.')
            );
            break;
          case 'auth/network-request-failed':
            setError(t('login.networkError', '네트워크 연결을 확인해주세요.'));
            break;
          default:
            setError(t('adminLogin.errorMessage', '로그인에 실패했습니다.'));
        }
        logger.error('로그인 실패 (Firebase):', err, {
          component: 'Login',
          data: { code: err.code, email },
        });
      } else {
        setError(t('adminLogin.errorMessage', '로그인에 실패했습니다.'));
        logger.error(
          '로그인 실패 (Unknown):',
          err instanceof Error ? err : new Error(String(err)),
          { component: 'Login' }
        );
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    try {
      const userCredential = await signInWithGoogle();

      // 동의 여부 확인
      const db = getFirestore();
      const consentRef = doc(db, 'users', userCredential.user.uid, 'consents', 'current');
      const consentDoc = await getDoc(consentRef);

      if (!consentDoc.exists()) {
        // 동의 내역이 없으면 약관 동의 페이지로 이동
        logger.info('동의 내역 없음, 약관 동의 페이지로 이동', {
          component: 'Login',
          data: { userId: userCredential.user.uid },
        });
        navigate('/consent', { state: { from: '/app' } });
        return;
      }

      navigate('/app');
    } catch (err: unknown) {
      // FirebaseError 타입 체크
      if (err instanceof FirebaseError) {
        switch (err.code) {
          case 'auth/popup-blocked':
            setError(
              t('googleSignIn.popupBlocked', '팝업이 차단되었습니다. 브라우저 설정을 확인해주세요.')
            );
            break;
          case 'auth/popup-closed-by-user':
            setError(t('googleSignIn.popupClosed', '로그인이 취소되었습니다.'));
            break;
          case 'auth/network-request-failed':
            setError(t('login.networkError', '네트워크 연결을 확인해주세요.'));
            break;
          case 'auth/cancelled-popup-request':
            // 여러 팝업 요청 시 발생, 무시
            break;
          default:
            setError(t('googleSignIn.error', '구글 로그인에 실패했습니다.'));
        }
        logger.error('Google Sign-In Error (Firebase):', err, {
          component: 'Login',
          data: { code: err.code },
        });
      } else {
        setError(t('googleSignIn.error', '구글 로그인에 실패했습니다.'));
        logger.error(
          'Google Sign-In Error (Unknown):',
          err instanceof Error ? err : new Error(String(err)),
          { component: 'Login' }
        );
      }
    }
  };

  // 카카오 로그인 핸들러 - 나중에 다시 활성화 예정
  /*
  const handleKakaoSignIn = async (userInfo: KakaoUserInfo, authResponse: KakaoAuthResponse) => {
    setError('');
    try {
      await signInWithKakao(authResponse.access_token, userInfo);
      navigate('/app');
    } catch (err: unknown) {
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

        {error && (
          <div
            className="text-red-500 dark:text-red-400 text-sm text-center"
            role="alert"
            aria-live="assertive"
          >
            {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700"
            />
            <label
              htmlFor="remember-me"
              className="ml-2 block text-sm text-gray-900 dark:text-gray-100"
            >
              {t('login.rememberMe', '로그인 상태 유지')}
            </label>
          </div>
          <div className="text-sm">
            <Link
              to="/forgot-password"
              className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"
            >
              {t('login.forgotPassword')}
            </Link>
          </div>
        </div>

        <div>
          <button
            type="submit"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-700 hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {t('common.login')}
          </button>
        </div>
      </form>

      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300 dark:border-gray-600" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
              {t('login.orContinueWith')}
            </span>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <button
            onClick={handleGoogleSignIn}
            className="w-full inline-flex justify-center py-2 px-4 border rounded-md shadow-sm text-sm font-medium bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <FaGoogle className="h-5 w-5" />
            <span className="ml-2">{t('login.googleSignIn')}</span>
          </button>

          {/* 카카오 로그인 버튼 - 나중에 다시 활성화 예정 */}
          {/*
          <KakaoLoginButton
            onSuccess={handleKakaoSignIn}
            onError={handleKakaoSignInError}
          />
          */}
        </div>
      </div>

      <div className="mt-4 text-sm text-center">
        <Link
          to="/signup"
          className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"
        >
          {t('login.noAccount')}
        </Link>
      </div>

      {/* 로그인 차단 모달 */}
      {blockedPenalty && (
        <LoginBlockedModal
          isOpen={showLoginBlockedModal}
          onClose={() => setShowLoginBlockedModal(false)}
          penalty={blockedPenalty}
        />
      )}
    </AuthLayout>
  );
};

export default Login;
