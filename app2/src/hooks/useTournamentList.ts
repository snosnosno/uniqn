import { useCallback, useMemo } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '../utils/logger';
import i18n from '../i18n';
import { TournamentSettings } from '../stores/tournamentStore';
import { useFirestoreCollection } from './firestore';

export interface Tournament {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'paused' | 'finished';
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  settings: TournamentSettings;
}

/**
 * useTournamentList Hook
 * 사용자의 토너먼트 목록을 관리합니다.
 *
 * @param userId - 현재 사용자 ID
 * @returns 토너먼트 목록, 로딩 상태, 에러, CRUD 작업 함수들
 */
export const useTournamentList = (userId: string | null) => {
  // 컬렉션 경로 생성
  const collectionPath = useMemo(() => {
    if (!userId) return null;
    return `users/${userId}/tournaments`;
  }, [userId]);

  // useFirestoreCollection으로 구독
  const {
    data: tournamentList,
    loading,
    error,
  } = useFirestoreCollection<Omit<Tournament, 'id'>>(collectionPath || '', {
    enabled: collectionPath !== null,
    onSuccess: () => {
      logger.info('토너먼트 목록 로드 완료', {
        component: 'useTournamentList',
        data: { userId, count: tournamentList.length },
      });
    },
    onError: (err) => {
      logger.error('토너먼트 목록 구독 실패:', err, {
        component: 'useTournamentList',
      });
    },
  });

  // Tournament 타입으로 변환
  const tournaments = useMemo(() => {
    return tournamentList.map((doc) => doc as unknown as Tournament);
  }, [tournamentList]);

  /**
   * 새 토너먼트 생성
   */
  const createTournament = useCallback(
    async (name: string, settings?: Partial<TournamentSettings>): Promise<string> => {
      if (!userId) {
        throw new Error(i18n.t('errors.loginRequired'));
      }

      try {
        const tournamentsRef = collection(db, `users/${userId}/tournaments`);

        const defaultSettings: TournamentSettings = {
          name: name,
          startingChips: 30000,
          seatsPerTable: 9,
          blindLevels: [
            { level: 1, sb: 100, bb: 200, duration: 1200 },
            { level: 2, sb: 200, bb: 400, duration: 1200 },
            { level: 3, isBreak: true, sb: 0, bb: 0, duration: 600 },
            { level: 4, sb: 300, bb: 600, ante: 600, duration: 1200 },
            { level: 5, sb: 400, bb: 800, ante: 800, duration: 1200 },
          ],
          ...settings,
        };

        const newTournament = {
          name,
          status: 'pending' as const,
          createdAt: Timestamp.now(),
          settings: defaultSettings,
        };

        const docRef = await addDoc(tournamentsRef, newTournament);

        logger.info('토너먼트 생성 완료', {
          component: 'useTournamentList',
          data: { tournamentId: docRef.id, name },
        });

        return docRef.id;
      } catch (err) {
        logger.error('토너먼트 생성 실패:', err instanceof Error ? err : new Error(String(err)), {
          component: 'useTournamentList',
        });
        throw err;
      }
    },
    [userId]
  );

  /**
   * 토너먼트 업데이트
   */
  const updateTournament = useCallback(
    async (tournamentId: string, updates: Partial<Omit<Tournament, 'id'>>): Promise<void> => {
      if (!userId) {
        throw new Error(i18n.t('errors.loginRequired'));
      }

      try {
        const tournamentRef = doc(db, `users/${userId}/tournaments`, tournamentId);

        await updateDoc(tournamentRef, {
          ...updates,
          updatedAt: Timestamp.now(),
        });

        logger.info('토너먼트 업데이트 완료', {
          component: 'useTournamentList',
          data: { tournamentId },
        });
      } catch (err) {
        logger.error(
          '토너먼트 업데이트 실패:',
          err instanceof Error ? err : new Error(String(err)),
          {
            component: 'useTournamentList',
          }
        );
        throw err;
      }
    },
    [userId]
  );

  /**
   * 토너먼트 삭제
   */
  const deleteTournament = useCallback(
    async (tournamentId: string): Promise<void> => {
      if (!userId) {
        throw new Error(i18n.t('errors.loginRequired'));
      }

      try {
        const tournamentRef = doc(db, `users/${userId}/tournaments`, tournamentId);
        await deleteDoc(tournamentRef);

        logger.info('토너먼트 삭제 완료', {
          component: 'useTournamentList',
          data: { tournamentId },
        });
      } catch (err) {
        logger.error('토너먼트 삭제 실패:', err instanceof Error ? err : new Error(String(err)), {
          component: 'useTournamentList',
        });
        throw err;
      }
    },
    [userId]
  );

  /**
   * 토너먼트 상태 변경
   */
  const changeTournamentStatus = useCallback(
    async (tournamentId: string, status: Tournament['status']): Promise<void> => {
      return updateTournament(tournamentId, { status });
    },
    [updateTournament]
  );

  return {
    tournaments,
    loading,
    error,
    createTournament,
    updateTournament,
    deleteTournament,
    changeTournamentStatus,
  };
};
