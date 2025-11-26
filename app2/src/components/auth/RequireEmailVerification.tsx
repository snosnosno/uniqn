import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import EmailVerification from './EmailVerification';

interface RequireEmailVerificationProps {
  children: React.ReactNode;
}

const RequireEmailVerification: React.FC<RequireEmailVerificationProps> = ({ children }) => {
  const { currentUser } = useAuth();

  // 사용자가 로그인되어 있고 이메일이 인증되지 않은 경우
  if (currentUser && !currentUser.emailVerified) {
    return (
      <EmailVerification
        onVerified={() => {
          // 인증 완료 후 페이지 새로고침으로 상태 업데이트
          window.location.reload();
        }}
      />
    );
  }

  // 이메일 인증이 완료되었거나 로그인하지 않은 경우 원래 컴포넌트 렌더링
  return <>{children}</>;
};

export default RequireEmailVerification;
