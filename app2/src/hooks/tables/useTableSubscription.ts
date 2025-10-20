/**
 * useTableSubscription.ts
 *
 * 테이블 실시간 구독 전용 Hook
 * - ALL 모드 지원 (collectionGroup)
 * - 날짜별 필터링 지원
 * - 일반 모드 지원 (특정 토너먼트)
 * - maxSeatsSetting 구독
 */

import {
  collection,
  collectionGroup,
  onSnapshot,
  doc,
  getDocs,
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { useState, useEffect, Dispatch, SetStateAction } from 'react';
import { db } from '../../firebase';
import { logger } from '../../utils/logger';
import { isDefaultTournament } from '../useTournaments';

import { Table } from '../useTables';

/**
 * 테이블 구독 Hook 반환 타입
 */
export interface UseTableSubscriptionReturn {
  tables: Table[];
  setTables: Dispatch<SetStateAction<Table[]>>;
  loading: boolean;
  error: Error | null;
  maxSeatsSetting: number;
}

/**
 * 테이블 실시간 구독 Hook
 *
 * @param userId 사용자 ID
 * @param tournamentId 토너먼트 ID (또는 'ALL')
 * @returns 테이블 상태 및 설정
 */
export const useTableSubscription = (
  userId: string | null,
  tournamentId: string | null
): UseTableSubscriptionReturn => {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [maxSeatsSetting, setMaxSeatsSetting] = useState<number>(9);

  useEffect(() => {
    // userId 또는 tournamentId가 없으면 빈 상태로 유지
    if (!userId || !tournamentId) {
      setLoading(false);
      return;
    }

    // "ALL" 전체 보기 모드 또는 날짜별 기본 토너먼트 모드
    if (tournamentId === 'ALL' || isDefaultTournament(tournamentId)) {
      // collectionGroup으로 모든 토너먼트의 테이블 조회
      const tablesGroupRef = collectionGroup(db, 'tables');

      // 날짜별 기본 토너먼트인 경우 dateKey 추출
      const dateKeyForFilter = isDefaultTournament(tournamentId)
        ? tournamentId.replace('DEFAULT_DATE_', '') // "DEFAULT_DATE_2025-01-20" -> "2025-01-20"
        : null;

      const unsubscribeTables = onSnapshot(
        tablesGroupRef,
        async (snapshot) => {
          const tablesData = snapshot.docs
            .map((doc: QueryDocumentSnapshot<DocumentData>) => {
              const data = doc.data();
              // tournamentId 추출 (path: users/{userId}/tournaments/{tournamentId}/tables/{tableId})
              const pathParts = doc.ref.path.split('/');
              const extractedTournamentId = pathParts[3] || null;

              // 현재 사용자의 테이블만 필터링
              const pathUserId = pathParts[1];
              if (pathUserId !== userId) return null;

              return {
                id: doc.id,
                ...data,
                tournamentId: extractedTournamentId, // 어느 토너먼트 소속인지 저장
              } as Table;
            })
            .filter((table): table is Table => table !== null);

          // 날짜별 전체보기인 경우 해당 날짜의 테이블만 필터링
          let filteredTables = tablesData;
          if (dateKeyForFilter) {
            // 해당 날짜의 토너먼트를 찾기 위해 tournaments 컬렉션 조회 필요
            // 각 테이블의 tournamentId로 tournament 정보를 조회하여 dateKey 확인
            const tournamentsSnapshot = await getDocs(collection(db, `users/${userId}/tournaments`));
            const tournamentDateMap = new Map<string, string>();

            tournamentsSnapshot.docs.forEach(doc => {
              const data = doc.data();
              if (data.dateKey) {
                tournamentDateMap.set(doc.id, data.dateKey);
              }
            });

            // 해당 날짜의 토너먼트에 속한 테이블만 필터링
            filteredTables = tablesData.filter(table => {
              if (!table.tournamentId) return false;
              const tableDateKey = tournamentDateMap.get(table.tournamentId);
              return tableDateKey === dateKeyForFilter;
            });

            logger.info('날짜별 전체보기 필터링 완료', {
              component: 'useTableSubscription',
              data: {
                dateKey: dateKeyForFilter,
                totalTables: tablesData.length,
                filteredTables: filteredTables.length,
              },
            });
          }

          filteredTables.sort((a, b) => a.tableNumber - b.tableNumber);

          setTables(filteredTables);
          setLoading(false);
        },
        (err) => {
          setError(err);
          setLoading(false);
          logger.error('전체 테이블 구독 실패:', err, {
            component: 'useTableSubscription',
          });
        }
      );

      return () => {
        unsubscribeTables();
      };
    }

    // 일반 모드 (특정 토너먼트)
    const settingsDocRef = doc(db, `users/${userId}/tournaments/${tournamentId}/settings`, 'config');
    const unsubscribeSettings = onSnapshot(settingsDocRef, docSnap => {
      if (docSnap.exists() && docSnap.data().maxSeatsPerTable) {
        setMaxSeatsSetting(docSnap.data().maxSeatsPerTable);
      }
    });

    const tablesCollectionRef = collection(db, `users/${userId}/tournaments/${tournamentId}/tables`);
    const unsubscribeTables = onSnapshot(
      tablesCollectionRef,
      snapshot => {
        const tablesData = snapshot.docs
          .map((doc: QueryDocumentSnapshot<DocumentData>) => ({
            id: doc.id,
            ...doc.data(),
          } as Table))
          .sort((a, b) => a.tableNumber - b.tableNumber);
        setTables(tablesData);
        setLoading(false);
      },
      err => {
        setError(err);
        setLoading(false);
        logger.error('테이블 구독 실패:', err, {
          component: 'useTableSubscription',
        });
      }
    );

    return () => {
      unsubscribeSettings();
      unsubscribeTables();
    };
  }, [userId, tournamentId]);

  return {
    tables,
    setTables,
    loading,
    error,
    maxSeatsSetting,
  };
};
