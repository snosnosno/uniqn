import {
  User as FirebaseUser,
  signInWithEmailAndPassword,
  // createUserWithEmailAndPassword,
  // signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from 'firebase/auth';
import { logger } from '../utils/logger';
import { setSentryUser } from '../utils/sentry';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// import { doc, getDoc } from 'firebase/firestore';
import { auth } from '../firebase';

// 확장된 User 인터페이스 (Firebase User + 추가 필드)
export interface User extends FirebaseUser {
  region?: string; // 지역 필드 (선택사항)
}

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  isAdmin: boolean;
  role: string | null;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<any>;
  sendPasswordReset: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<any>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          logger.info('사용자 토큰 조회 시작', { 
            component: 'AuthContext',
            data: { uid: user.uid, email: user.email }
          });
          
          const idTokenResult = await user.getIdTokenResult(true);
          const userRole = idTokenResult.claims.role as string || null;
          
          logger.info('사용자 role 조회 결과', { 
            component: 'AuthContext',
            data: { 
              uid: user.uid, 
              email: user.email,
              role: userRole,
              allClaims: idTokenResult.claims,
              isAdmin: userRole === 'admin' || userRole === 'manager'
            }
          });
          
          setRole(userRole);
          
          // Sentry에 사용자 정보 설정
          const sentryUserData: { id: string; email?: string; username?: string } = {
            id: user.uid
          };
          if (user.email) sentryUserData.email = user.email;
          if (user.displayName) sentryUserData.username = user.displayName;
          setSentryUser(sentryUserData);
        } catch (error) {
          logger.error('Error fetching user role:', error instanceof Error ? error : new Error(String(error)), { component: 'AuthContext' });
          setRole(null);
        }
      } else {
        logger.info('사용자 로그아웃', { component: 'AuthContext' });
        setRole(null);
        // 로그아웃 시 Sentry 사용자 정보 제거
        setSentryUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = (email: string, password: string) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const sendPasswordReset = (email: string) => {
    return sendPasswordResetEmail(auth, email);
  };

  const signInWithGoogle = () => {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  };

  const signOut = () => {
    return auth.signOut();
  };
  
  const isAdmin = role === 'admin' || role === 'manager';

  const value: AuthContextType = {
    currentUser,
    loading,
    isAdmin,
    role,
    signOut,
    signIn,
    sendPasswordReset,
    signInWithGoogle,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
