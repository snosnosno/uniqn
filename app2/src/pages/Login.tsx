import React, { useState } from "react";
import { useTranslation } from 'react-i18next';
import { FaGoogle } from 'react-icons/fa';
import { useNavigate, Link } from "react-router-dom";

import AuthLayout from '../components/AuthLayout';
import FormField from "../components/FormField";
import { useAuth } from "../contexts/AuthContext";


const Login: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { signIn, signInWithGoogle } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await signIn(email, password);
      navigate("/");
    } catch (err: any) {
      if (err.code === 'auth/user-disabled') {
        setError(t('adminLogin.approvalPending'));
      } else {
        setError(t('adminLogin.errorMessage'));
      }
      console.error(err);
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

  return (
    <AuthLayout title={t('login.title')}>
      <form className="space-y-6" onSubmit={handleLogin}>
        <FormField
          id="email"
          label={t('login.emailLabel')}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('login.emailPlaceholder')}
          required
          autoComplete="email"
        />
        <FormField
          id="password"
          label={t('login.passwordLabel')}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('login.passwordPlaceholder')}
          required
          autoComplete="current-password"
        />
        
        {error ? <p className="text-red-500 text-sm text-center">{error}</p> : null}
        
        <div className="flex items-center justify-end">
          <div className="text-sm">
            <Link to="/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-500">
              {t('login.forgotPassword')}
            </Link>
          </div>
        </div>

        <div>
          <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            {t('login.loginButton')}
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

        <div className="mt-6">
          <button
            onClick={handleGoogleSignIn}
            className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
          >
            <FaGoogle className="h-5 w-5" />
            <span className="ml-2">{t('login.googleSignIn')}</span>
          </button>
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
