import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaGoogle } from 'react-icons/fa';
import { useNavigate, Link } from 'react-router-dom';

import AuthLayout from '../components/AuthLayout';
import FormField from '../components/FormField';
import Modal from '../components/Modal';
import { useAuth } from '../contexts/AuthContext';
import { callFunctionLazy } from '../utils/firebase-dynamic';

const SignUp: React.FC = () => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('staff'); // 'staff' or 'manager'
  const [gender, setGender] = useState(''); // 'male' or 'female'
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { signInWithGoogle } = useAuth();

  const [modalInfo, setModalInfo] = useState<{ title: string; message: string; isOpen: boolean }>({
    title: '',
    message: '',
    isOpen: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (password.length < 6) {
      setError(t('signUp.passwordLengthError'));
      setIsLoading(false);
      return;
    }

    try {
      await callFunctionLazy('requestRegistration', {
        email,
        password,
        name,
        phone,
        role,
        gender,
      });

      const successMessage = role === 'staff' 
        ? t('signUp.staffSuccessMessage') 
        : t('signUp.managerSuccessMessage');
      
      setModalInfo({
        title: t('signUp.title'),
        message: successMessage,
        isOpen: true,
      });

    } catch (err: any) {
      console.error('Registration request failed:', err);
      if (err.code === 'functions/already-exists') {
        setError(t('signUp.emailInUseError'));
      } else if (err.code === 'functions/invalid-argument') {
        const originalCode = err.details?.originalCode;
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
      navigate('/');
    } catch (err: any) {
      setError(t('googleSignIn.error'));
      console.error('Google Sign-In Error:', err);
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

          <FormField id="name" label={t('signUp.nameLabel')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('signUp.namePlaceholder')} required />
          <FormField id="phone" label={t('signUp.phoneLabel')} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('signUp.phonePlaceholder')} />
          
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('signUp.genderLabel', '성별')}</label>
            <div className="flex items-center mt-2">
                <input type="radio" id="male" name="gender" value="male" checked={gender === 'male'} onChange={() => setGender('male')} className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300" required/>
                <label htmlFor="male" className="ml-2 block text-sm text-gray-900">{t('signUp.genderMale', '남성')}</label>
                <input type="radio" id="female" name="gender" value="female" checked={gender === 'female'} onChange={() => setGender('female')} className="ml-4 focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"/>
                <label htmlFor="female" className="ml-2 block text-sm text-gray-900">{t('signUp.genderFemale', '여성')}</label>
            </div>
          </div>

          <FormField id="email" label={t('signUp.emailLabel')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('signUp.emailPlaceholder')} required />
          <FormField id="password" label={t('signUp.passwordLabel')} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('signUp.passwordPlaceholder')} required />

          {error ? <p className="text-red-500 text-sm text-center">{error}</p> : null}
          
          <button type="submit" disabled={isLoading} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400">
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
