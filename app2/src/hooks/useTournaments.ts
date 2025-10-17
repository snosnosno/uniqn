import { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, Timestamp, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '../utils/logger';
import { safeOnSnapshot } from '../utils/firebaseConnectionManager';
import { withFirebaseErrorHandling } from '../utils/firebaseUtils';
import { getTournamentColor, UNASSIGNED_COLOR } from '../utils/tournamentColors';

// 기본 토너먼트 ID (기본 테이블 저장용)
export const DEFAULT_TOURNAMENT_ID = 'DEFAULT_UNASSIGNED';

export interface Tournament {
  id: string;
  name: string;
  date: string;
  location?: string;
  status: 'upcoming' | 'active' | 'completed';
  color?: string; // 토너먼트별 색상 (HEX 코드, 예: #3B82F6)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * useTournaments Hook
 * 특정 사용자의 토너먼트 목록을 관리합니다.
 *
 * @param userId - 현재 사용자 ID
 * @returns 토너먼트 목록, 로딩 상태, 에러, CRUD 작업 함수들
 */
export const useTournaments = (userId: string | null) => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setTournaments([]);
      setLoading(false);
      return;
    }

    const tournamentsPath = `users/${userId}/tournaments`;

    const unsubscribe = safeOnSnapshot<Tournament>(
      tournamentsPath,
      (tournamentsData) => {
        // 색상이 없는 토너먼트에 자동으로 색상 할당
        const tournamentsWithColors = tournamentsData.map((tournament, index) => ({
          ...tournament,
          color: tournament.color || getTournamentColor(index),
        }));

        setTournaments(tournamentsWithColors);
        setLoading(false);
        logger.info('토너먼트 목록 로드 완료', {
          component: 'useTournaments',
          data: { userId, count: tournamentsData.length },
        });
      },
      (err) => {
        setError(err);
        setLoading(false);
        logger.error('토너먼트 목록 구독 실패:', err, { component: 'useTournaments' });
      }
    );

    return () => unsubscribe();
  }, [userId]);

  const createTournament = async (tournamentData: Omit<Tournament, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!userId) {
      throw new Error('사용자 ID가 필요합니다.');
    }

    return withFirebaseErrorHandling(async () => {
      const tournamentsPath = `users/${userId}/tournaments`;
      const now = Timestamp.now();

      // 색상이 지정되지 않았으면 자동 할당
      const color = tournamentData.color || getTournamentColor(tournaments.length);

      const docRef = await addDoc(collection(db, tournamentsPath), {
        ...tournamentData,
        color,
        createdAt: now,
        updatedAt: now,
      });

      logger.info('토너먼트 생성 완료', {
        component: 'useTournaments',
        data: { tournamentId: docRef.id, name: tournamentData.name, color },
      });

      return docRef;
    }, 'createTournament');
  };

  const updateTournament = async (tournamentId: string, data: Partial<Omit<Tournament, 'id' | 'createdAt' | 'updatedAt'>>) => {
    if (!userId) {
      throw new Error('사용자 ID가 필요합니다.');
    }

    return withFirebaseErrorHandling(async () => {
      const tournamentDoc = doc(db, `users/${userId}/tournaments`, tournamentId);
      await updateDoc(tournamentDoc, {
        ...data,
        updatedAt: Timestamp.now(),
      });

      logger.info('토너먼트 수정 완료', {
        component: 'useTournaments',
        data: { tournamentId, ...data },
      });
    }, 'updateTournament');
  };

  const deleteTournament = async (tournamentId: string) => {
    if (!userId) {
      throw new Error('사용자 ID가 필요합니다.');
    }

    return withFirebaseErrorHandling(async () => {
      const tournamentDoc = doc(db, `users/${userId}/tournaments`, tournamentId);
      await deleteDoc(tournamentDoc);

      logger.info('토너먼트 삭제 완료', {
        component: 'useTournaments',
        data: { tournamentId },
      });
    }, 'deleteTournament');
  };

  /**
   * 기본 토너먼트 확인 및 생성
   * 기본 테이블을 저장할 기본 토너먼트가 없으면 자동 생성
   */
  const ensureDefaultTournament = async () => {
    if (!userId) {
      throw new Error('사용자 ID가 필요합니다.');
    }

    return withFirebaseErrorHandling(async () => {
      const defaultTournamentDoc = doc(db, `users/${userId}/tournaments`, DEFAULT_TOURNAMENT_ID);
      const docSnap = await getDoc(defaultTournamentDoc);

      if (!docSnap.exists()) {
        const now = Timestamp.now();
        await setDoc(defaultTournamentDoc, {
          name: '기본 테이블',
          date: new Date().toISOString().split('T')[0] || '',
          location: '',
          status: 'upcoming' as const,
          color: UNASSIGNED_COLOR,
          createdAt: now,
          updatedAt: now,
        });

        logger.info('기본 토너먼트 생성 완료', {
          component: 'useTournaments',
          data: { tournamentId: DEFAULT_TOURNAMENT_ID },
        });
      }

      return DEFAULT_TOURNAMENT_ID;
    }, 'ensureDefaultTournament');
  };

  return {
    tournaments,
    loading,
    error,
    createTournament,
    updateTournament,
    deleteTournament,
    ensureDefaultTournament,
  };
};

export default useTournaments;
