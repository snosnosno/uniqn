/**
 * 패널티 서비스
 *
 * 사용자 패널티 CRUD 및 상태 관리
 *
 * Firestore 구조: users/{userId}/penalties/{penaltyId}
 *
 * @version 1.0
 * @since 2025-01-01
 */
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '../utils/logger';
import type { Penalty, PenaltyCreateInput, PenaltyDuration } from '../types/penalty';
import { PENALTY_DURATION_DAYS } from '../types/penalty';

/**
 * 패널티 종료일 계산
 * @param startDate 시작일
 * @param duration 기간
 * @returns 종료일 (영구인 경우 null)
 */
function calculateEndDate(startDate: Date, duration: PenaltyDuration): Timestamp | null {
  const days = PENALTY_DURATION_DAYS[duration];

  if (days === null) {
    // 영구 정지
    return null;
  }

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + days);
  return Timestamp.fromDate(endDate);
}

/**
 * 패널티가 만료되었는지 확인
 * @param penalty 패널티 객체
 * @returns 만료 여부
 */
export function isPenaltyExpired(penalty: Penalty): boolean {
  if (penalty.status === 'cancelled') return false;
  if (penalty.endDate === null) return false; // 영구는 만료되지 않음

  const now = new Date();
  const endDate = penalty.endDate.toDate();
  return now > endDate;
}

/**
 * 새 패널티 생성
 * @param input 패널티 생성 데이터
 * @param createdBy 생성자 ID
 * @returns 생성된 패널티 ID
 */
export async function createPenalty(input: PenaltyCreateInput, createdBy: string): Promise<string> {
  try {
    const startDate = new Date();
    const endDate = calculateEndDate(startDate, input.duration);

    const penaltyData: Omit<Penalty, 'id'> = {
      userId: input.userId,
      type: input.type,
      reason: input.reason,
      details: input.details || '',
      duration: input.duration,
      startDate: Timestamp.fromDate(startDate),
      endDate,
      status: 'active',
      createdBy,
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
    };

    const penaltiesRef = collection(db, 'users', input.userId, 'penalties');
    const docRef = await addDoc(penaltiesRef, penaltyData);

    logger.info('패널티 생성 완료', {
      component: 'penaltyService',
      userId: input.userId,
    });

    return docRef.id;
  } catch (error) {
    logger.error('패널티 생성 실패', error instanceof Error ? error : new Error(String(error)), {
      component: 'penaltyService',
      userId: input.userId,
    });
    throw error;
  }
}

/**
 * 패널티 취소
 * @param userId 사용자 ID
 * @param penaltyId 패널티 ID
 * @param cancelReason 취소 사유
 * @param cancelledBy 취소자 ID
 */
export async function cancelPenalty(
  userId: string,
  penaltyId: string,
  cancelReason: string,
  cancelledBy: string
): Promise<void> {
  try {
    const penaltyRef = doc(db, 'users', userId, 'penalties', penaltyId);

    await updateDoc(penaltyRef, {
      status: 'cancelled',
      cancelReason,
      cancelledBy,
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    logger.info('패널티 취소 완료', {
      component: 'penaltyService',
      userId,
    });
  } catch (error) {
    logger.error('패널티 취소 실패', error instanceof Error ? error : new Error(String(error)), {
      component: 'penaltyService',
      userId,
    });
    throw error;
  }
}

/**
 * 사용자 패널티 컬렉션 참조 생성
 * @param userId 사용자 ID
 * @returns Firestore 쿼리
 */
export function getPenaltiesQuery(userId: string) {
  return query(collection(db, 'users', userId, 'penalties'), orderBy('createdAt', 'desc'));
}

/**
 * 사용자의 활성 로그인 차단 패널티 확인
 * @param userId 사용자 ID
 * @returns 차단 여부
 */
export async function hasActiveLoginBlock(userId: string): Promise<boolean> {
  const penalty = await getActiveLoginBlockPenalty(userId);
  return penalty !== null;
}

/**
 * 사용자의 활성 로그인 차단 패널티 조회 (상세 정보 포함)
 * @param userId 사용자 ID
 * @returns 로그인 차단 패널티 (없으면 null)
 */
export async function getActiveLoginBlockPenalty(userId: string): Promise<Penalty | null> {
  try {
    // 복합 인덱스 없이 단일 필드 쿼리 사용
    const q = query(collection(db, 'users', userId, 'penalties'), where('status', '==', 'active'));

    const snapshot = await getDocs(q);

    // 활성 상태이면서 loginBlock 유형이고 만료되지 않은 차단 찾기
    for (const docSnap of snapshot.docs) {
      const penalty = { id: docSnap.id, ...docSnap.data() } as Penalty;
      if (penalty.type === 'loginBlock' && !isPenaltyExpired(penalty)) {
        logger.info('활성 로그인 차단 발견', {
          component: 'penaltyService',
          data: { userId, penaltyId: penalty.id },
        });
        return penalty;
      }
    }

    return null;
  } catch (error) {
    logger.error(
      '로그인 차단 패널티 조회 실패',
      error instanceof Error ? error : new Error(String(error)),
      { component: 'penaltyService', userId }
    );
    // 에러 발생 시 안전하게 null 반환 (차단하지 않음)
    return null;
  }
}

/**
 * 사용자의 활성 경고 패널티 조회
 * @param userId 사용자 ID
 * @returns 활성 경고 패널티 (없으면 null)
 */
export async function getActiveWarningPenalty(userId: string): Promise<Penalty | null> {
  try {
    // 복합 인덱스 없이 단일 필드 쿼리 사용
    const q = query(collection(db, 'users', userId, 'penalties'), where('status', '==', 'active'));

    const snapshot = await getDocs(q);

    // warning 유형이고 만료되지 않은 경고 중 가장 최근 것 반환
    let latestWarning: Penalty | null = null;
    let latestTime = 0;

    for (const docSnap of snapshot.docs) {
      const penalty = { id: docSnap.id, ...docSnap.data() } as Penalty;
      if (penalty.type === 'warning' && !isPenaltyExpired(penalty)) {
        // Timestamp의 toMillis() 사용 (타입 캐스팅)
        const penaltyTime = (penalty.createdAt as Timestamp)?.toMillis?.() || 0;
        if (penaltyTime > latestTime) {
          latestWarning = penalty;
          latestTime = penaltyTime;
        }
      }
    }

    return latestWarning;
  } catch (error) {
    logger.error(
      '경고 패널티 조회 실패',
      error instanceof Error ? error : new Error(String(error)),
      { component: 'penaltyService', userId }
    );
    return null;
  }
}
