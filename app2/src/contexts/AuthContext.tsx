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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
          const idTokenResult = await user.getIdTokenResult(true);
          const userRole = idTokenResult.claims.role as string || null;
          setRole(userRole);
        } catch (error) {
          logger.error('Error fetching user role:', error instanceof Error ? error : new Error(String(error)), { component: 'AuthContext' });
          setRole(null);
        }
      } else {
        setRole(null);
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
