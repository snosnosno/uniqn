import {
  User as FirebaseUser,
  UserCredential,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  setPersistence,
  browserSessionPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { logger } from '../utils/logger';
import { setSentryUser } from '../utils/sentry';
import { secureStorage } from '../utils/secureStorage';
import { getActiveLoginBlockPenalty } from '../services/penaltyService';
import type { Penalty } from '../types/penalty';
import i18n from '../i18n';
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';

import { auth } from '../firebase';

/**
 * 로그인 차단 에러 (패널티 정보 포함)
 */
export class LoginBlockedError extends Error {
  penalty: Penalty;

  constructor(penalty: Penalty) {
    super('LOGIN_BLOCKED');
    this.name = 'LoginBlockedError';
    this.penalty = penalty;
  }
}

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
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<UserCredential>;
  sendPasswordReset: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<UserCredential>;
  signInWithKakao: (kakaoToken: string, userInfo: unknown) => Promise<UserCredential>;
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
            data: { uid: user.uid, email: user.email },
          });

          const idTokenResult = await user.getIdTokenResult(true);
          const userRole = (idTokenResult.claims.role as string) || null;

          logger.info('사용자 role 조회 결과', {
            component: 'AuthContext',
            data: {
              uid: user.uid,
              email: user.email,
              role: userRole,
              allClaims: idTokenResult.claims,
              isAdmin: userRole === 'admin' || userRole === 'employer',
            },
          });

          setRole(userRole);

          // Sentry에 사용자 정보 설정
          const sentryUserData: { id: string; email?: string; username?: string } = {
            id: user.uid,
          };
          if (user.email) sentryUserData.email = user.email;
          if (user.displayName) sentryUserData.username = user.displayName;
          setSentryUser(sentryUserData);
        } catch (error) {
          logger.error(
            'Error fetching user role:',
            error instanceof Error ? error : new Error(String(error)),
            { component: 'AuthContext' }
          );
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

  const signIn = useCallback(
    async (email: string, password: string, rememberMe: boolean = false) => {
      try {
        // 로그인 상태 유지 설정
        const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistence);

        // secureStorage에 암호화하여 저장
        secureStorage.setItem('rememberMe', JSON.stringify(rememberMe));

        logger.info('로그인 persistence 설정 완료', {
          component: 'AuthContext',
          data: {
            rememberMe,
            persistence: rememberMe ? 'local' : 'session',
          },
        });

        const userCredential = await signInWithEmailAndPassword(auth, email, password);

        // 로그인 차단 패널티 확인 (패널티 데이터 포함)
        const blockPenalty = await getActiveLoginBlockPenalty(userCredential.user.uid);
        if (blockPenalty) {
          logger.warn('로그인 차단된 사용자 로그인 시도', {
            component: 'AuthContext',
            data: { uid: userCredential.user.uid, email, penaltyId: blockPenalty.id },
          });

          // 로그아웃 처리
          await auth.signOut();

          // LoginBlockedError 에러 던지기 (패널티 정보 포함)
          throw new LoginBlockedError(blockPenalty);
        }

        return userCredential;
      } catch (error) {
        // LoginBlockedError는 다시 던지기
        if (error instanceof LoginBlockedError) {
          throw error;
        }

        logger.error(
          '로그인 persistence 설정 실패:',
          error instanceof Error ? error : new Error(String(error)),
          { component: 'AuthContext' }
        );
        throw error;
      }
    },
    []
  );

  const sendPasswordReset = useCallback((email: string) => {
    return sendPasswordResetEmail(auth, email);
  }, []);

  const signInWithGoogle = useCallback(() => {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  }, []);

  const signInWithKakao = useCallback(async (kakaoToken: string, userInfo: unknown) => {
    try {
      logger.info('카카오 토큰으로 Firebase Custom Auth 시도', {
        component: 'AuthContext',
        data: {
          kakaoUserId: (userInfo as Record<string, unknown>)?.id,
          hasEmail: !!(userInfo as Record<string, Record<string, unknown>>)?.kakao_account?.email,
        },
      });

      // Firebase Functions을 통해 Custom Token 생성 및 로그인
      const { callFunctionLazy } = await import('../utils/firebase-dynamic');
      const result = await callFunctionLazy<{ customToken?: string }>('authenticateWithKakao', {
        accessToken: kakaoToken,
        userInfo: userInfo,
      });

      if (result.customToken) {
        // Custom Token으로 Firebase Auth 로그인
        const { signInWithCustomToken } = await import('firebase/auth');
        const userCredential = await signInWithCustomToken(auth, result.customToken);

        logger.info('카카오 로그인 성공', {
          component: 'AuthContext',
          data: {
            firebaseUid: userCredential.user.uid,
            email: userCredential.user.email,
          },
        });

        return userCredential;
      } else {
        throw new Error(i18n.t('errors.customTokenFailed'));
      }
    } catch (error) {
      logger.error(
        '카카오 로그인 실패:',
        error instanceof Error ? error : new Error(String(error)),
        { component: 'AuthContext' }
      );
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      // secureStorage 설정 정리 (signIn과 일관성 유지)
      secureStorage.removeItem('rememberMe');

      logger.info('로그아웃 처리 완료', { component: 'AuthContext' });

      return auth.signOut();
    } catch (error) {
      logger.error(
        '로그아웃 처리 실패:',
        error instanceof Error ? error : new Error(String(error)),
        { component: 'AuthContext' }
      );
      throw error;
    }
  }, []);

  const isAdmin = role === 'admin' || role === 'employer';

  const value: AuthContextType = React.useMemo(
    () => ({
      currentUser,
      loading,
      isAdmin,
      role,
      signOut,
      signIn,
      sendPasswordReset,
      signInWithGoogle,
      signInWithKakao,
    }),
    [
      currentUser,
      loading,
      isAdmin,
      role,
      signOut,
      signIn,
      sendPasswordReset,
      signInWithGoogle,
      signInWithKakao,
    ]
  );

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};
