import React, { useState } from 'react';
import { logger } from '../utils/logger';
import { useTranslation } from 'react-i18next';
import { FaGoogle } from '../components/Icons/ReactIconsReplacement';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import { useNavigate, Link } from 'react-router-dom';

import AuthLayout from '../components/auth/AuthLayout';
import FormField from '../components/FormField';
import Modal from '../components/ui/Modal';
import PasswordStrength from '../components/auth/PasswordStrength';
import ConsentManager from '../components/consent/ConsentManager';
import { useAuth } from '../contexts/AuthContext';
import { callFunctionLazy } from '../utils/firebase-dynamic';
import { validatePassword } from '../utils/passwordValidator';
import { validatePhone, formatPhoneNumber } from '../utils/phoneValidator';
import { validateEmail, validateEmailRealtime } from '../utils/emailValidator';
import type { ConsentCreateInput } from '../types/consent';
import { FirebaseError } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, sendEmailVerification } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const SignUp: React.FC = () => {
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const role = 'employer'; // 모든 사용자는 employer 역할로 가입
  const [gender, setGender] = useState(''); // 'male' or 'female'
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [consents, setConsents] = useState<ConsentCreateInput | null>(null);

  // 실시간 유효성 검사 에러
  const [nameError, setNameError] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  const navigate = useNavigate();
  const { t } = useTranslation();
  const { signInWithGoogle } = useAuth();

  const [modalInfo, setModalInfo] = useState<{ title: string; message: string; isOpen: boolean }>({
    title: '',
    message: '',
    isOpen: false,
  });

  // 실시간 유효성 검사 핸들러
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);

    if (value.length === 0) {
      setNameError('');
    } else if (value.length < 2) {
      setNameError(t('signUp.validation.nameTooShort', '이름은 최소 2자 이상이어야 합니다.'));
    } else if (value.length > 20) {
      setNameError(t('signUp.validation.nameTooLong', '이름은 최대 20자까지 입력 가능합니다.'));
    } else {
      setNameError('');
    }
  };

  const handleNicknameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNickname(value);

    if (value.length === 0) {
      setNicknameError('');
    } else if (value.length < 2) {
      setNicknameError(
        t('signUp.validation.nicknameTooShort', '닉네임은 최소 2자 이상이어야 합니다.')
      );
    } else if (value.length > 15) {
      setNicknameError(
        t('signUp.validation.nicknameTooLong', '닉네임은 최대 15자까지 입력 가능합니다.')
      );
    } else {
      setNicknameError('');
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);

    const validation = validatePhone(formatted);
    if (formatted.replace(/\D/g, '').length > 0 && !validation.isValid) {
      setPhoneError(validation.errors[0] || '');
    } else {
      setPhoneError('');
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);

    // 이메일 형식 실시간 검증 (emailValidator 유틸리티 사용)
    if (value.length > 0) {
      const validation = validateEmailRealtime(value);
      if (!validation.isValid) {
        setEmailError(
          validation.errors?.[0] ||
            t('signUp.validation.invalidEmail', '올바른 이메일 형식이 아닙니다.')
        );
      } else {
        setEmailError('');
      }
    } else {
      setEmailError('');
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);

    if (value.length > 0) {
      const validation = validatePassword(value);
      if (!validation.isValid) {
        setPasswordError(validation.errors[0] || '');
      } else {
        setPasswordError('');
      }
    } else {
      setPasswordError('');
    }

    // 비밀번호 확인 필드가 있으면 재검증
    if (confirmPassword.length > 0 && value !== confirmPassword) {
      setConfirmPasswordError(
        t('signUp.validation.passwordMismatch', '비밀번호가 일치하지 않습니다.')
      );
    } else if (confirmPassword.length > 0) {
      setConfirmPasswordError('');
    }
  };

  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setConfirmPassword(value);

    if (value.length > 0 && value !== password) {
      setConfirmPasswordError(
        t('signUp.validation.passwordMismatch', '비밀번호가 일치하지 않습니다.')
      );
    } else {
      setConfirmPasswordError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // 이름 검증
    if (name.length < 2) {
      setError(t('signUp.validation.nameTooShort', '이름은 최소 2자 이상이어야 합니다.'));
      setIsLoading(false);
      return;
    }

    if (name.length > 20) {
      setError(t('signUp.validation.nameTooLong', '이름은 최대 20자까지 입력 가능합니다.'));
      setIsLoading(false);
      return;
    }

    // 전화번호 검증
    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.isValid) {
      setError(phoneValidation.errors.join(' '));
      setIsLoading(false);
      return;
    }

    // 이메일 검증 (RFC 5322 표준 준수)
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      setError(emailValidation.errors.join(' '));
      setIsLoading(false);
      return;
    }

    // 성별 검증
    if (!gender) {
      setError(t('signUp.validation.genderRequired', '성별을 선택해주세요.'));
      setIsLoading(false);
      return;
    }

    // 비밀번호 유효성 검사
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setError(passwordValidation.errors.join(' '));
      setIsLoading(false);
      return;
    }

    // 비밀번호 확인
    if (password !== confirmPassword) {
      setError(t('signUp.validation.passwordMismatch', '비밀번호가 일치하지 않습니다.'));
      setIsLoading(false);
      return;
    }

    // 동의 확인
    if (!consents) {
      setError(t('consent.requiredDetails.pleaseAgree', '필수 약관에 동의해주세요.'));
      setIsLoading(false);
      return;
    }

    try {
      await callFunctionLazy('requestRegistration', {
        email,
        password,
        name,
        nickname,
        phone,
        role,
        gender,
        consents, // 동의 정보 추가
      });

      // 이메일 인증 메일 발송
      try {
        const auth = getAuth();
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);

        logger.info('이메일 인증 발송 성공', {
          component: 'SignUp',
          data: { email },
        });

        // 로그아웃 (이메일 인증 완료 후 다시 로그인하도록)
        await auth.signOut();
      } catch (emailError) {
        logger.error(
          '이메일 인증 발송 실패',
          emailError instanceof Error ? emailError : new Error(String(emailError)),
          {
            component: 'SignUp',
            data: { email },
          }
        );
        // 이메일 발송 실패해도 회원가입은 성공했으므로 계속 진행
      }

      // 회원가입 성공 메시지
      setModalInfo({
        title: t('signUp.title'),
        message:
          t('signUp.successMessage', '회원가입이 완료되었습니다.') +
          '\n\n' +
          t('signUp.emailVerificationNote', '가입한 이메일로 인증 메일이 발송됩니다.') +
          '\n\n' +
          t(
            'signUp.emailVerificationInstruction',
            '이메일을 확인하여 인증을 완료한 후 로그인해주세요.'
          ),
        isOpen: true,
      });

      logger.info('회원가입 성공', {
        component: 'SignUp',
        data: { email, role },
      });
    } catch (err: unknown) {
      logger.error(
        'Registration request failed:',
        err instanceof Error ? err : new Error(String(err)),
        { component: 'SignUp' }
      );

      // TypeScript 타입 안전성 확보
      if (err instanceof FirebaseError) {
        if (err.code === 'functions/already-exists') {
          setError(t('signUp.emailInUseError'));
        } else if (err.code === 'functions/invalid-argument') {
          const originalCode = (err as { details?: { originalCode?: string } }).details
            ?.originalCode;
          if (originalCode === 'auth/invalid-email') {
            setError(t('signUp.invalidEmailError'));
          } else if (originalCode === 'auth/weak-password') {
            setError(t('signUp.weakPasswordError'));
          } else {
            setError(t('signUp.errorMessage'));
          }
        } else {
          setError(t('signUp.errorMessage'));
        }
      } else if (err && typeof err === 'object' && 'code' in err) {
        const error = err as { code: string; details?: { originalCode?: string } };
        if (error.code === 'functions/already-exists') {
          setError(t('signUp.emailInUseError'));
        } else if (error.code === 'functions/invalid-argument') {
          const originalCode = error.details?.originalCode;
          if (originalCode === 'auth/invalid-email') {
            setError(t('signUp.invalidEmailError'));
          } else if (originalCode === 'auth/weak-password') {
            setError(t('signUp.weakPasswordError'));
          } else {
            setError(t('signUp.errorMessage'));
          }
        } else {
          setError(t('signUp.errorMessage'));
        }
      } else {
        setError(t('signUp.errorMessage'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsLoading(true);

    try {
      const userCredential = await signInWithGoogle();
      const user = userCredential.user;

      logger.info('Google 로그인 성공', {
        component: 'SignUp',
        data: { email: user.email },
      });

      // 동의 여부 확인
      const db = getFirestore();
      const consentRef = doc(db, 'users', user.uid, 'consents', 'current');
      const consentDoc = await getDoc(consentRef);

      if (!consentDoc.exists()) {
        // 동의 내역이 없으면 약관 동의 페이지로 이동
        logger.info('동의 내역 없음, 약관 동의 페이지로 이동', {
          component: 'SignUp',
          data: { userId: user.uid },
        });
        navigate('/consent', { state: { from: '/app' } });
      } else {
        // 동의 내역이 있으면 프로필 완성 확인
        navigate('/app/profile?incomplete=true');
      }
    } catch (err: unknown) {
      setError(t('googleSignIn.error'));
      logger.error('Google Sign-In Error:', err instanceof Error ? err : new Error(String(err)), {
        component: 'SignUp',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleModalClose = () => {
    setModalInfo({ ...modalInfo, isOpen: false });
    navigate('/login');
  };

  return (
    <>
      <AuthLayout title={t('signUp.title')}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <FormField
              id="name"
              label={t('common.name')}
              value={name}
              onChange={handleNameChange}
              placeholder={t('common.name')}
              required
            />
            {nameError && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
                {nameError}
              </p>
            )}
          </div>

          <div>
            <FormField
              id="nickname"
              label={t('signUp.nickname', '닉네임')}
              value={nickname}
              onChange={handleNicknameChange}
              placeholder={t('signUp.nicknamePlaceholder', '닉네임을 입력하세요')}
              maxLength={15}
            />
            {nicknameError && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
                {nicknameError}
              </p>
            )}
          </div>

          <div>
            <FormField
              id="phone"
              label={t('common.phone')}
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="010-1234-5678"
              maxLength={13}
              required
            />
            {phoneError && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
                {phoneError}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('signUp.genderLabel', '성별')}
            </label>
            <div
              className="flex items-center mt-2"
              role="radiogroup"
              aria-label={t('signUp.genderLabel', '성별')}
            >
              <input
                type="radio"
                id="male"
                name="gender"
                value="male"
                checked={gender === 'male'}
                onChange={() => setGender('male')}
                className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                required
                aria-label={t('signUp.genderMale', '남성')}
              />
              <label htmlFor="male" className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
                {t('signUp.genderMale', '남성')}
              </label>
              <input
                type="radio"
                id="female"
                name="gender"
                value="female"
                checked={gender === 'female'}
                onChange={() => setGender('female')}
                className="ml-4 focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                aria-label={t('signUp.genderFemale', '여성')}
              />
              <label
                htmlFor="female"
                className="ml-2 block text-sm text-gray-900 dark:text-gray-100"
              >
                {t('signUp.genderFemale', '여성')}
              </label>
            </div>
          </div>

          <div>
            <FormField
              id="email"
              label={`${t('common.emailAddress')} (${t('signUp.emailVerificationRequired', '이메일 인증 필요')})`}
              type="email"
              value={email}
              onChange={handleEmailChange}
              placeholder={t('common.emailAddress')}
              required
            />
            {emailError && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
                {emailError}
              </p>
            )}
          </div>

          <div>
            <FormField
              id="password"
              label={t('common.password')}
              type="password"
              value={password}
              onChange={handlePasswordChange}
              placeholder={t('signUp.passwordPlaceholder')}
              required
            />
            {passwordError && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
                {passwordError}
              </p>
            )}
            {/* 비밀번호 강도 표시 */}
            {password && (
              <div className="mt-2">
                <PasswordStrength password={password} />
              </div>
            )}
          </div>

          <div>
            <FormField
              id="confirmPassword"
              label={t('signUp.confirmPassword', '비밀번호 확인')}
              type="password"
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
              placeholder={t('signUp.confirmPasswordPlaceholder', '비밀번호를 다시 입력하세요')}
              required
            />
            {confirmPasswordError && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
                {confirmPasswordError}
              </p>
            )}
          </div>

          {/* 동의 관리 */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <ConsentManager isSignupMode={true} onChange={setConsents} />
          </div>

          {error ? (
            <p className="text-red-500 dark:text-red-400 text-sm text-center" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isLoading || !consents}
            className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-700 hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 disabled:bg-indigo-400 dark:disabled:bg-indigo-600 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <ArrowPathIcon className="animate-spin h-5 w-5 mr-2" />
                {t('signUp.signingUpButton')}
              </>
            ) : (
              t('signUp.signUpButton')
            )}
          </button>
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

          <div className="mt-6">
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full inline-flex justify-center items-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <ArrowPathIcon className="animate-spin h-5 w-5 mr-2" />
              ) : (
                <FaGoogle className="h-5 w-5" />
              )}
              <span className="ml-2">{t('signUp.googleSignUp')}</span>
            </button>
          </div>
        </div>

        <div className="mt-4 text-sm text-center">
          <Link
            to="/login"
            className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300"
          >
            {t('signUp.backToLogin')}
          </Link>
        </div>
      </AuthLayout>

      <Modal isOpen={modalInfo.isOpen} onClose={handleModalClose} title={modalInfo.title}>
        <p className="text-gray-900 dark:text-gray-100">{modalInfo.message}</p>
        <div className="text-right mt-4">
          <button
            onClick={handleModalClose}
            className="bg-indigo-600 dark:bg-indigo-700 text-white px-4 py-2 rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-600"
          >
            {t('common.confirm')}
          </button>
        </div>
      </Modal>
    </>
  );
};

export default SignUp;
