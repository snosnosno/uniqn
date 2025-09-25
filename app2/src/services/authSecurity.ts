import { doc, getDoc, setDoc, updateDoc, serverTimestamp, query, where, collection, getDocs, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '../utils/logger';

// 로그인 시도 인터페이스
export interface LoginAttempt {
  id: string;
  ip: string;
  email?: string;
  timestamp: Timestamp;
  success: boolean;
  userAgent: string;
  attempts: number;
  blockedUntil?: Timestamp;
}

// 보안 설정
export const SECURITY_CONFIG = {
  MAX_LOGIN_ATTEMPTS: 5,          // 최대 로그인 시도 횟수
  LOCKOUT_DURATION: 15 * 60 * 1000, // 15분 (밀리초)
  SESSION_TIMEOUT: 30 * 60 * 1000,  // 30분 (밀리초)
  CLEANUP_INTERVAL: 24 * 60 * 60 * 1000 // 24시간 (밀리초)
} as const;

// IP 주소 가져오기 (브라우저 환경에서는 제한적)
const getClientIP = async (): Promise<string> => {
  try {
    // 실제 환경에서는 서버에서 IP를 전달받아야 함
    // 여기서는 임시로 로컬 식별자 사용
    return 'browser-' + Math.random().toString(36).substr(2, 9);
  } catch (error) {
    logger.error('IP 주소 조회 실패:', error instanceof Error ? error : new Error(String(error)), {
      component: 'AuthSecurity'
    });
    return 'unknown';
  }
};

// User Agent 가져오기
const getUserAgent = (): string => {
  return navigator.userAgent || 'unknown';
};

// 로그인 시도 기록
export const recordLoginAttempt = async (
  email: string,
  success: boolean
): Promise<void> => {
  try {
    const ip = await getClientIP();
    const userAgent = getUserAgent();
    const _attemptId = `${ip}_${Date.now()}`; // 보안 로깅용

    const attemptData: Partial<LoginAttempt> = {
      ip,
      email,
      timestamp: serverTimestamp() as Timestamp,
      success,
      userAgent,
      attempts: 1
    };

    // IP 기반으로 기존 시도 기록 확인
    const attemptsRef = doc(db, 'loginAttempts', ip);
    const attemptDoc = await getDoc(attemptsRef);

    if (attemptDoc.exists()) {
      const existingData = attemptDoc.data() as LoginAttempt;

      if (success) {
        // 로그인 성공 시 시도 기록 초기화
        await deleteDoc(attemptsRef);
        logger.info('로그인 성공으로 시도 기록 초기화', {
          component: 'AuthSecurity',
          data: { ip, email }
        });
      } else {
        // 실패 시 시도 횟수 증가
        const newAttempts = existingData.attempts + 1;
        const shouldBlock = newAttempts >= SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS;

        const updateData: Partial<LoginAttempt> = {
          attempts: newAttempts,
          timestamp: serverTimestamp() as Timestamp,
          email
        };

        if (shouldBlock) {
          const blockedUntil = new Date(Date.now() + SECURITY_CONFIG.LOCKOUT_DURATION);
          updateData.blockedUntil = Timestamp.fromDate(blockedUntil);

          logger.warn('로그인 시도 횟수 초과로 IP 차단', {
            component: 'AuthSecurity',
            data: {
              ip,
              email,
              attempts: newAttempts,
              blockedUntil: blockedUntil.toISOString()
            }
          });
        }

        await updateDoc(attemptsRef, updateData);
      }
    } else {
      // 첫 시도인 경우
      if (!success) {
        await setDoc(attemptsRef, attemptData);
        logger.info('첫 로그인 시도 기록', {
          component: 'AuthSecurity',
          data: { ip, email, success }
        });
      }
    }
  } catch (error) {
    logger.error('로그인 시도 기록 실패:', error instanceof Error ? error : new Error(String(error)), {
      component: 'AuthSecurity'
    });
  }
};

// 로그인 차단 여부 확인
export const isLoginBlocked = async (email?: string): Promise<{
  isBlocked: boolean;
  remainingTime?: number;
  attempts?: number;
}> => {
  try {
    const ip = await getClientIP();
    const attemptsRef = doc(db, 'loginAttempts', ip);
    const attemptDoc = await getDoc(attemptsRef);

    if (!attemptDoc.exists()) {
      return { isBlocked: false };
    }

    const data = attemptDoc.data() as LoginAttempt;

    // 차단 시간이 설정되어 있는지 확인
    if (data.blockedUntil) {
      const now = Date.now();
      const blockedUntilTime = data.blockedUntil.toMillis();

      if (now < blockedUntilTime) {
        // 아직 차단 중
        const remainingTime = blockedUntilTime - now;
        logger.info('로그인 차단 상태 확인', {
          component: 'AuthSecurity',
          data: {
            ip,
            email,
            remainingTime: Math.ceil(remainingTime / 1000),
            attempts: data.attempts
          }
        });

        return {
          isBlocked: true,
          remainingTime,
          attempts: data.attempts
        };
      } else {
        // 차단 시간 만료, 기록 삭제
        await deleteDoc(attemptsRef);
        logger.info('차단 시간 만료로 기록 삭제', {
          component: 'AuthSecurity',
          data: { ip, email }
        });
        return { isBlocked: false };
      }
    }

    // 차단되지 않았지만 시도 기록은 있음
    return {
      isBlocked: false,
      attempts: data.attempts
    };

  } catch (error) {
    logger.error('로그인 차단 여부 확인 실패:', error instanceof Error ? error : new Error(String(error)), {
      component: 'AuthSecurity'
    });
    // 에러 시 안전하게 차단되지 않은 것으로 처리
    return { isBlocked: false };
  }
};

// 수동 차단 해제 (관리자 전용)
export const clearLoginAttempts = async (ip: string): Promise<void> => {
  try {
    const attemptsRef = doc(db, 'loginAttempts', ip);
    await deleteDoc(attemptsRef);

    logger.info('관리자에 의한 로그인 차단 해제', {
      component: 'AuthSecurity',
      data: { ip }
    });
  } catch (error) {
    logger.error('로그인 차단 해제 실패:', error instanceof Error ? error : new Error(String(error)), {
      component: 'AuthSecurity'
    });
    throw error;
  }
};

// 의심스러운 로그인 시도 조회 (관리자 전용)
export const getSuspiciousAttempts = async (): Promise<LoginAttempt[]> => {
  try {
    const attemptsCollection = collection(db, 'loginAttempts');
    const suspiciousQuery = query(
      attemptsCollection,
      where('attempts', '>=', 3)
    );

    const querySnapshot = await getDocs(suspiciousQuery);
    const attempts: LoginAttempt[] = [];

    querySnapshot.forEach((doc) => {
      attempts.push({
        id: doc.id,
        ...doc.data()
      } as LoginAttempt);
    });

    logger.info('의심스러운 로그인 시도 조회', {
      component: 'AuthSecurity',
      data: { count: attempts.length }
    });

    return attempts;
  } catch (error) {
    logger.error('의심스러운 로그인 시도 조회 실패:', error instanceof Error ? error : new Error(String(error)), {
      component: 'AuthSecurity'
    });
    return [];
  }
};

// 오래된 로그인 시도 기록 정리
export const cleanupOldAttempts = async (): Promise<void> => {
  try {
    const attemptsCollection = collection(db, 'loginAttempts');
    const cutoffTime = Timestamp.fromMillis(Date.now() - SECURITY_CONFIG.CLEANUP_INTERVAL);

    const oldAttemptsQuery = query(
      attemptsCollection,
      where('timestamp', '<', cutoffTime)
    );

    const querySnapshot = await getDocs(oldAttemptsQuery);
    const deletePromises: Promise<void>[] = [];

    querySnapshot.forEach((doc) => {
      deletePromises.push(deleteDoc(doc.ref));
    });

    await Promise.all(deletePromises);

    logger.info('오래된 로그인 시도 기록 정리 완료', {
      component: 'AuthSecurity',
      data: { cleaned: deletePromises.length }
    });
  } catch (error) {
    logger.error('오래된 로그인 시도 기록 정리 실패:', error instanceof Error ? error : new Error(String(error)), {
      component: 'AuthSecurity'
    });
  }
};

// 차단 시간을 사람이 읽을 수 있는 형태로 변환
export const formatBlockTime = (remainingTimeMs: number): string => {
  const minutes = Math.ceil(remainingTimeMs / (1000 * 60));
  const seconds = Math.ceil((remainingTimeMs % (1000 * 60)) / 1000);

  if (minutes > 0) {
    return `${minutes}분 ${seconds}초`;
  }
  return `${seconds}초`;
};