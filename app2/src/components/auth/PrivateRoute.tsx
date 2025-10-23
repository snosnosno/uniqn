import React from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';

const PrivateRoute: React.FC = () => {
  const { currentUser, loading } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  if (loading) {
    return <div className="p-6 text-center">{t('common.messages.loading')}</div>;
  }

  return currentUser ? <Outlet /> : <Navigate to="/login" state={{ from: location }} replace />;
};

export default PrivateRoute;
