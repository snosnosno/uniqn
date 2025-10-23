import React, { useState } from 'react';
import { logger } from '../utils/logger';
import { useTranslation } from 'react-i18next';
import { FaGoogle } from '../components/Icons/ReactIconsReplacement';
import { useNavigate, Link } from 'react-router-dom';

import AuthLayout from '../components/auth/AuthLayout';
import FormField from '../components/FormField';
import Modal from '../components/ui/Modal';
import PasswordStrength from '../components/auth/PasswordStrength';
import ConsentManager from '../components/consent/ConsentManager';
import { useAuth } from '../contexts/AuthContext';
import { callFunctionLazy } from '../utils/firebase-dynamic';
import { validatePassword } from '../utils/passwordValidator';
import type { ConsentCreateInput } from '../types/consent';

const SignUp: React.FC = () => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('staff'); // 'staff' or 'manager'
  const [gender, setGender] = useState(''); // 'male' or 'female'
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [consents, setConsents] = useState<ConsentCreateInput | null>(null);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { signInWithGoogle } = useAuth();

  const [modalInfo, setModalInfo] = useState<{ title: string; message: string; isOpen: boolean }>({
    title: '',
    message: '',
    isOpen: false,
  });

  // 전화번호 포맷팅 함수
  const formatPhoneNumber = (value: string) => {
    // 숫자만 추출
    const numbers = value.replace(/\D/g, '');

    // 길이에 따라 포맷 적용
    if (numbers.length <= 3) {
      return numbers;
    } else if (numbers.length <= 7) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    } else {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // 동의 확인
    if (!consents) {
      setError(t('consent.required.pleaseAgree', '필수 약관에 동의해주세요.'));
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

    try {
      const result = await callFunctionLazy('requestRegistration', {
        email,
        password,
        name,
        phone,
        role,
        gender,
      });

      // 회원가입 성공 후 이메일 인증 발송
      if (result && result.user) {
        try {
          // Firebase Auth 사용자 정보가 있다면 이메일 인증 발송
          logger.info('회원가입 후 이메일 인증 발송 시도', {
            component: 'SignUp',
            data: { email }
          });
        } catch (emailError) {
          logger.error('이메일 인증 발송 실패:', emailError instanceof Error ? emailError : new Error(String(emailError)), { component: 'SignUp' });
          // 이메일 인증 실패는 치명적이지 않으므로 계속 진행
        }
      }

      const successMessage = role === 'staff'
        ? t('signUp.staffSuccessMessage')
        : t('signUp.managerSuccessMessage');

      setModalInfo({
        title: t('signUp.title'),
        message: successMessage + '\n\n' + t('signUp.emailVerificationNote', '가입한 이메일로 인증 메일이 발송됩니다.'),
        isOpen: true,
      });

    } catch (err: unknown) {
      logger.error('Registration request failed:', err instanceof Error ? err : new Error(String(err)), { component: 'SignUp' });
      const error = err as any;
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
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    try {
      await signInWithGoogle();
      navigate('/app');
    } catch (err: unknown) {
      setError(t('googleSignIn.error'));
      logger.error('Google Sign-In Error:', err instanceof Error ? err : new Error(String(err)), { component: 'SignUp' });
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
            <label className="block text-sm font-medium text-gray-700">{t('signUp.roleTitle')}</label>
            <div className="flex items-center mt-2">
              <input type="radio" id="staff" name="role" value="staff" checked={role === 'staff'} onChange={() => setRole('staff')} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"/>
              <label htmlFor="staff" className="ml-2 block text-sm text-gray-900">{t('signUp.roleStaff')}</label>
              <input type="radio" id="manager" name="role" value="manager" checked={role === 'manager'} onChange={() => setRole('manager')} className="ml-4 focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"/>
              <label htmlFor="manager" className="ml-2 block text-sm text-gray-900">{t('signUp.roleManager')}</label>
            </div>
            {role === 'manager' && (
              <p className="text-xs text-gray-500 mt-2 whitespace-pre-line">
                {t('signUp.managerApprovalNotice')}
              </p>
            )}
          </div>

          <FormField id="name" label={t('common.name')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('common.name')} required />
          <FormField
            id="phone"
            label={t('common.phone')}
            type="tel"
            value={phone}
            onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
            placeholder="010-1234-5678"
            maxLength={13}
          />
          
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('signUp.genderLabel', '성별')}</label>
            <div className="flex items-center mt-2">
                <input type="radio" id="male" name="gender" value="male" checked={gender === 'male'} onChange={() => setGender('male')} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300" required/>
                <label htmlFor="male" className="ml-2 block text-sm text-gray-900">{t('signUp.genderMale', '남성')}</label>
                <input type="radio" id="female" name="gender" value="female" checked={gender === 'female'} onChange={() => setGender('female')} className="ml-4 focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"/>
                <label htmlFor="female" className="ml-2 block text-sm text-gray-900">{t('signUp.genderFemale', '여성')}</label>
            </div>
          </div>

          <FormField id="email" label={t('common.emailAddress')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('common.emailAddress')} required />

          <div>
            <FormField id="password" label={t('signUp.passwordLabel')} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('signUp.passwordPlaceholder')} required />
            {/* 비밀번호 강도 표시 */}
            {password && (
              <div className="mt-2">
                <PasswordStrength password={password} />
              </div>
            )}
          </div>

          {/* 동의 관리 */}
          <div className="pt-4 border-t border-gray-200">
            <ConsentManager
              isSignupMode={true}
              onChange={setConsents}
            />
          </div>

          {error ? <p className="text-red-500 text-sm text-center">{error}</p> : null}

          <button type="submit" disabled={isLoading || !consents} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400">
            {isLoading ? t('signUp.signingUpButton') : t('signUp.signUpButton')}
          </button>
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

          <div className="mt-6">
            <button onClick={handleGoogleSignIn} className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
              <FaGoogle className="h-5 w-5" />
              <span className="ml-2">{t('signUp.googleSignUp')}</span>
            </button>
          </div>
        </div>

        <div className="mt-4 text-sm text-center">
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">{t('signUp.backToLogin')}</Link>
        </div>
      </AuthLayout>
      
      <Modal isOpen={modalInfo.isOpen} onClose={handleModalClose} title={modalInfo.title}>
        <p>{modalInfo.message}</p>
        <div className="text-right mt-4">
          <button onClick={handleModalClose} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
            {t('modal.confirm')}
          </button>
        </div>
      </Modal>
    </>
  );
};

export default SignUp;
