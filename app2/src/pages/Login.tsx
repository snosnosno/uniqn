import React, { useState, useEffect, useCallback } from "react";
import { logger } from '../utils/logger';
import { useTranslation } from 'react-i18next';
import { FaGoogle } from '../components/Icons/ReactIconsReplacement';
import { useNavigate, Link } from "react-router-dom";
import { FirebaseError } from 'firebase/app';
import { sendEmailVerification } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

import AuthLayout from '../components/auth/AuthLayout';
import FormField from "../components/FormField";
import Modal from '../components/ui/Modal';
// 카카오 로그인 기능 - 나중에 다시 활성화 예정
// import KakaoLoginButton from '../components/auth/KakaoLoginButton';
import { useAuth } from "../contexts/AuthContext";
// import { KakaoUserInfo, KakaoAuthResponse } from '../utils/kakaoSdk';
import { recordLoginAttempt, isLoginBlocked, formatBlockTime } from '../services/authSecurity';
import { secureStorage } from '../utils/secureStorage';
import { toast } from '../utils/toast';


const Login: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [isBlocked, setIsBlocked] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [showEmailVerificationModal, setShowEmailVerificationModal] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const navigate = useNavigate();
  const { signIn, signInWithGoogle, currentUser /* , signInWithKakao */ } = useAuth();

  // 🔍 디버깅: 환경 변수 확인 (개발 환경에서만)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Firebase API Key (first 10 chars):', {
        component: 'Login',
        data: {
          apiKey: process.env.REACT_APP_FIREBASE_API_KEY?.slice(0, 10) + '...',
          projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID
        }
      });
    }
  }, []);

  // 차단 상태 확인 함수 (메모이제이션)
  const checkBlockStatus = useCallback(async () => {
    try {
      const blockStatus = await isLoginBlocked(email);
      if (blockStatus.isBlocked && blockStatus.remainingTime) {
        setIsBlocked(true);
        setAttempts(blockStatus.attempts || 0);
        setError(t('login.blockedMessage', `로그인 시도가 너무 많아 ${formatBlockTime(blockStatus.remainingTime)} 후에 다시 시도할 수 있습니다.`));
      } else {
        setIsBlocked(false);
        setAttempts(blockStatus.attempts || 0);
        setError('');
      }
    } catch (error) {
      logger.error('로그인 차단 상태 확인 실패:', error instanceof Error ? error : new Error(String(error)), { component: 'Login' });
    }
  }, [email, t]);

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
            data: { rememberMe: parsed }
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

  // 이메일 변경 시 차단 상태 확인 (debounce)
  useEffect(() => {
    if (!email) return;

    const timer = setTimeout(() => {
      checkBlockStatus();
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [email, checkBlockStatus]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // 차단 상태 확인 (이미 메모이제이션된 함수 재사용)
    if (isBlocked) {
      setError(t('login.blockedMessage', '로그인이 차단되었습니다.'));
      return;
    }

    try {
      const userCredential = await signIn(email, password, rememberMe);

      // 로그인 성공 시 시도 기록
      await recordLoginAttempt(email, true);

      // 이메일 인증 확인
      if (userCredential?.user && !userCredential.user.emailVerified) {
        setShowEmailVerificationModal(true);
        logger.warn('이메일 미인증 사용자 로그인', {
          component: 'Login',
          data: { email }
        });
        return;
      }

      navigate("/app");
    } catch (err: unknown) {
      // 로그인 실패 시 시도 기록
      await recordLoginAttempt(email, false);

      // FirebaseError 타입 체크
      if (err instanceof FirebaseError) {
        switch (err.code) {
          case 'auth/user-disabled':
            setError(t('adminLogin.approvalPending', '계정이 비활성화되었습니다. 관리자에게 문의하세요.'));
            break;
          case 'auth/invalid-credential':
          case 'auth/wrong-password':
          case 'auth/user-not-found':
            setError(t('adminLogin.errorMessage', '이메일 또는 비밀번호가 올바르지 않습니다.'));
            break;
          case 'auth/too-many-requests':
            setError(t('login.tooManyRequests', '너무 많은 시도가 있었습니다. 잠시 후 다시 시도해주세요.'));
            break;
          case 'auth/network-request-failed':
            setError(t('login.networkError', '네트워크 연결을 확인해주세요.'));
            break;
          default:
            setError(t('adminLogin.errorMessage', '로그인에 실패했습니다.'));
        }
        logger.error('로그인 실패 (Firebase):', err, {
          component: 'Login',
          data: { code: err.code, email }
        });
      } else {
        setError(t('adminLogin.errorMessage', '로그인에 실패했습니다.'));
        logger.error('로그인 실패 (Unknown):', err instanceof Error ? err : new Error(String(err)), { component: 'Login' });
      }

      // 차단 상태 업데이트 (메모이제이션된 함수 재사용)
      await checkBlockStatus();
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    try {
      const userCredential = await signInWithGoogle();

      // 이메일 인증 확인 (구글은 자동 인증이지만 체크)
      if (userCredential?.user && !userCredential.user.emailVerified) {
        setShowEmailVerificationModal(true);
        logger.warn('이메일 미인증 사용자 로그인 (Google)', {
          component: 'Login',
          data: { email: userCredential.user.email }
        });
        return;
      }

      // 동의 여부 확인
      const db = getFirestore();
      const consentRef = doc(db, 'users', userCredential.user.uid, 'consents', 'current');
      const consentDoc = await getDoc(consentRef);

      if (!consentDoc.exists()) {
        // 동의 내역이 없으면 약관 동의 페이지로 이동
        logger.info('동의 내역 없음, 약관 동의 페이지로 이동', {
          component: 'Login',
          data: { userId: userCredential.user.uid }
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
            setError(t('googleSignIn.popupBlocked', '팝업이 차단되었습니다. 브라우저 설정을 확인해주세요.'));
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
          data: { code: err.code }
        });
      } else {
        setError(t('googleSignIn.error', '구글 로그인에 실패했습니다.'));
        logger.error('Google Sign-In Error (Unknown):', err instanceof Error ? err : new Error(String(err)), { component: 'Login' });
      }
    }
  };

  // 이메일 재발송 핸들러
  const handleResendEmailVerification = async () => {
    if (!currentUser) return;

    setIsResendingEmail(true);
    try {
      await sendEmailVerification(currentUser);
      logger.info('이메일 인증 재발송 성공', {
        component: 'Login',
        data: { email: currentUser.email }
      });
      toast.success(t('login.emailVerificationResent', '인증 이메일이 재발송되었습니다.'));
      setShowEmailVerificationModal(false);
    } catch (err: unknown) {
      if (err instanceof FirebaseError) {
        logger.error('이메일 인증 재발송 실패 (Firebase):', err, {
          component: 'Login',
          data: { code: err.code }
        });
        toast.error(t('login.emailVerificationResendFailed', '이메일 재발송에 실패했습니다.'));
      } else {
        logger.error('이메일 인증 재발송 실패 (Unknown):', err instanceof Error ? err : new Error(String(err)), { component: 'Login' });
        toast.error(t('login.emailVerificationResendFailed', '이메일 재발송에 실패했습니다.'));
      }
    } finally {
      setIsResendingEmail(false);
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
          <div
            className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-600 p-4"
            role="alert"
            aria-live="polite"
          >
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400 dark:text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 15.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  {t('login.attemptWarning', `로그인 실패: ${attempts}회. 5회 실패 시 15분간 차단됩니다.`)}
                </p>
              </div>
            </div>
          </div>
        )}

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
              disabled={isBlocked}
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
              {t('login.rememberMe', '로그인 상태 유지')}
            </label>
          </div>
          <div className="text-sm">
            <Link to="/forgot-password" className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300">
              {t('login.forgotPassword')}
            </Link>
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={isBlocked}
            aria-disabled={isBlocked}
            aria-busy={false}
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
            <div className="w-full border-t border-gray-300 dark:border-gray-600" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">{t('login.orContinueWith')}</span>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <button
            onClick={handleGoogleSignIn}
            disabled={isBlocked}
            className={`w-full inline-flex justify-center py-2 px-4 border rounded-md shadow-sm text-sm font-medium ${
              isBlocked
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-300 dark:border-gray-600 cursor-not-allowed'
                : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
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
        <Link to="/signup" className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300">
          {t('login.noAccount')}
        </Link>
      </div>

      {/* 이메일 인증 모달 */}
      <Modal
        isOpen={showEmailVerificationModal}
        onClose={() => setShowEmailVerificationModal(false)}
        title={t('login.emailVerificationRequired', '이메일 인증이 필요합니다')}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t('login.emailVerificationMessage', '계정을 사용하기 위해서는 이메일 인증이 필요합니다. 인증 이메일을 확인해주세요.')}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t('login.emailVerificationCheck', '이메일을 받지 못하셨나요? 스팸 폴더를 확인해주세요.')}
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowEmailVerificationModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              {t('common.close', '닫기')}
            </button>
            <button
              onClick={handleResendEmailVerification}
              disabled={isResendingEmail}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-700 rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isResendingEmail
                ? t('login.emailVerificationResending', '재발송 중...')
                : t('login.emailVerificationResend', '인증 이메일 재발송')}
            </button>
          </div>
        </div>
      </Modal>
    </AuthLayout>
  );
};

export default Login;
