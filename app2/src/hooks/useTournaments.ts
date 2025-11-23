import { useState, useMemo } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, Timestamp, getDoc, setDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { logger } from '../utils/logger';
import { withFirebaseErrorHandling } from '../utils/firebaseUtils';
import { getTournamentColor, UNASSIGNED_COLOR } from '../utils/tournamentColors';
import { normalizeDate } from '../utils/dateUtils';
import { useFirestoreCollection } from './firestore';

// 기본 토너먼트 ID 접두사 (날짜별 전체보기용)
export const DEFAULT_TOURNAMENT_PREFIX = 'DEFAULT_DATE_';

/**
 * 날짜별 기본 토너먼트 ID 생성
 * @param dateKey - YYYY-MM-DD 형식의 날짜
 * @returns 날짜별 기본 토너먼트 ID (예: DEFAULT_DATE_2025-01-20)
 */
export const getDefaultTournamentId = (dateKey: string): string => {
  return `${DEFAULT_TOURNAMENT_PREFIX}${dateKey}`;
};

/**
 * 기본 토너먼트 ID인지 확인
 * @param tournamentId - 확인할 토너먼트 ID
 * @returns 기본 토너먼트 여부
 */
export const isDefaultTournament = (tournamentId: string): boolean => {
  return tournamentId.startsWith(DEFAULT_TOURNAMENT_PREFIX);
};

export interface Tournament {
  id: string;
  name: string;
  date: string;
  dateKey: string; // YYYY-MM-DD 형식의 날짜 키 (날짜별 그룹화용)
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
      // 로그 제거 - Context에서 한 번만 출력
    },
    onError: (err) => {
      logger.error('토너먼트 목록 구독 실패', err, {
        component: 'useTournaments',
      });
    },
  });

  // Tournament 타입으로 변환 + 자동 색상 할당
  const tournaments = useMemo(() => {
    return tournamentList.map((doc, index) => {
      const tournament = doc as unknown as Tournament;
      return {
        ...tournament,
        color: tournament.color || getTournamentColor(index),
      };
    });
  }, [tournamentList]);

  const createTournament = async (tournamentData: Omit<Tournament, 'id' | 'createdAt' | 'updatedAt' | 'dateKey'>) => {
    if (!userId) {
      throw new Error('사용자 ID가 필요합니다.');
    }

    return withFirebaseErrorHandling(async () => {
      const tournamentsPath = `users/${userId}/tournaments`;
      const now = Timestamp.now();

      // 색상이 지정되지 않았으면 자동 할당
      const color = tournamentData.color || getTournamentColor(tournaments.length);

      // date 필드에서 dateKey 자동 생성 (YYYY-MM-DD 형식)
      const dateKey = normalizeDate(tournamentData.date);

      const docRef = await addDoc(collection(db, tournamentsPath), {
        ...tournamentData,
        dateKey,
        color,
        createdAt: now,
        updatedAt: now,
      });

      logger.info('토너먼트 생성 완료', {
        component: 'useTournaments',
        data: { tournamentId: docRef.id, name: tournamentData.name, dateKey, color },
      });

      return docRef;
    }, 'createTournament');
  };

  const updateTournament = async (tournamentId: string, data: Partial<Omit<Tournament, 'id' | 'createdAt' | 'updatedAt' | 'dateKey'>>) => {
    if (!userId) {
      throw new Error('사용자 ID가 필요합니다.');
    }

    return withFirebaseErrorHandling(async () => {
      const tournamentDoc = doc(db, `users/${userId}/tournaments`, tournamentId);

      // date가 변경되면 dateKey도 자동 업데이트
      const updateData: Record<string, any> = {
        ...data,
        updatedAt: Timestamp.now(),
      };

      if (data.date) {
        updateData.dateKey = normalizeDate(data.date);
      }

      await updateDoc(tournamentDoc, updateData);

      logger.info('토너먼트 수정 완료', {
        component: 'useTournaments',
        data: { tournamentId, ...updateData },
      });
    }, 'updateTournament');
  };

  const deleteTournament = async (tournamentId: string) => {
    if (!userId) {
      throw new Error('사용자 ID가 필요합니다.');
    }

    return withFirebaseErrorHandling(async () => {
      // 삭제할 토너먼트 정보 가져오기
      const tournamentDoc = doc(db, `users/${userId}/tournaments`, tournamentId);
      const tournamentSnap = await getDoc(tournamentDoc);

      if (!tournamentSnap.exists()) {
        throw new Error('토너먼트를 찾을 수 없습니다.');
      }

      const tournamentData = tournamentSnap.data();
      const dateKey = tournamentData.dateKey;

      // 토너먼트 삭제
      await deleteDoc(tournamentDoc);

      logger.info('토너먼트 삭제 완료', {
        component: 'useTournaments',
        data: { tournamentId, dateKey },
      });

      // 해당 날짜에 다른 토너먼트가 있는지 확인
      if (dateKey) {
        const tournamentsSnapshot = await getDocs(collection(db, `users/${userId}/tournaments`));
        const otherTournamentsForDate = tournamentsSnapshot.docs.filter(doc => {
          const data = doc.data();
          return data.dateKey === dateKey && !isDefaultTournament(doc.id);
        });

        // 해당 날짜에 다른 토너먼트가 없으면 기본 토너먼트와 테이블 삭제
        if (otherTournamentsForDate.length === 0) {
          const defaultTournamentId = getDefaultTournamentId(dateKey);
          const defaultTournamentDoc = doc(db, `users/${userId}/tournaments`, defaultTournamentId);
          const defaultTournamentSnap = await getDoc(defaultTournamentDoc);

          if (defaultTournamentSnap.exists()) {
            // 기본 토너먼트의 테이블들도 삭제
            const tablesSnapshot = await getDocs(collection(db, `users/${userId}/tournaments/${defaultTournamentId}/tables`));

            if (tablesSnapshot.docs.length > 0) {
              const batch = writeBatch(db);
              tablesSnapshot.docs.forEach(tableDoc => {
                batch.delete(tableDoc.ref);
              });
              await batch.commit();

              logger.info('기본 토너먼트 테이블 삭제 완료', {
                component: 'useTournaments',
                data: { defaultTournamentId, tableCount: tablesSnapshot.docs.length }
              });
            }

            // 기본 토너먼트 삭제
            await deleteDoc(defaultTournamentDoc);

            logger.info('기본 토너먼트 자동 삭제 완료', {
              component: 'useTournaments',
              data: { defaultTournamentId, dateKey, reason: '해당 날짜의 마지막 토너먼트 삭제' }
            });
          }
        }
      }
    }, 'deleteTournament');
  };

  /**
   * 날짜별 기본 토너먼트 확인 및 생성
   * 해당 날짜의 기본 토너먼트(전체보기용)가 없으면 자동 생성
   *
   * @param dateKey - YYYY-MM-DD 형식의 날짜
   * @returns 생성 또는 확인된 기본 토너먼트 ID
   */
  const ensureDefaultTournamentForDate = async (dateKey: string) => {
    if (!userId) {
      throw new Error('사용자 ID가 필요합니다.');
    }

    return withFirebaseErrorHandling(async () => {
      const defaultTournamentId = getDefaultTournamentId(dateKey);
      const defaultTournamentDoc = doc(db, `users/${userId}/tournaments`, defaultTournamentId);
      const docSnap = await getDoc(defaultTournamentDoc);

      if (!docSnap.exists()) {
        const now = Timestamp.now();
        await setDoc(defaultTournamentDoc, {
          name: '전체',
          date: dateKey,
          dateKey: dateKey,
          location: '',
          status: 'upcoming' as const,
          color: UNASSIGNED_COLOR,
          createdAt: now,
          updatedAt: now,
        });

        logger.info('날짜별 기본 토너먼트 생성 완료', {
          component: 'useTournaments',
          data: { tournamentId: defaultTournamentId, dateKey },
        });
      }

      return defaultTournamentId;
    }, 'ensureDefaultTournamentForDate');
  };

  return {
    tournaments,
    loading,
    error,
    createTournament,
    updateTournament,
    deleteTournament,
    ensureDefaultTournamentForDate,
  };
};

export default useTournaments;
