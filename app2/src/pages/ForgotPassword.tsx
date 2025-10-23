import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import AuthLayout from '../components/auth/AuthLayout';
import FormField from '../components/FormField';
import { useAuth } from '../contexts/AuthContext';

import { logger } from '../utils/logger';
const ForgotPassword = () => {
  const { t } = useTranslation();
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      await sendPasswordReset(email);
      setMessage(t('forgotPassword.successMessage'));
    } catch (err: any) {
      setError(t('forgotPassword.errorMessage'));
      logger.error('Error occurred', err instanceof Error ? err : new Error(String(err)), { component: 'ForgotPassword' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title={t('forgotPassword.title')}>
      <form className="space-y-6" onSubmit={handleSubmit}>
        <p className="text-center text-sm text-gray-600">
          {t('forgotPassword.instruction')}
        </p>
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

        {message ? <p className="text-green-600 text-sm text-center bg-green-50 p-3 rounded-md">{message}</p> : null}
        {error ? <p className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-md">{error}</p> : null}

        <div>
          <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400" disabled={loading}>
            {loading ? t('forgotPassword.sendingButton') : t('forgotPassword.sendButton')}
          </button>
        </div>
      </form>
      <div className="mt-4 text-center">
        <Link to="/login" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
          {t('forgotPassword.backToLogin')}
        </Link>
      </div>
    </AuthLayout>
  );
};

export default ForgotPassword;
