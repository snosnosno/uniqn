/**
 * 테이블 Firebase 쿼리 로직
 */
import { collection, onSnapshot, collectionGroup, query, where, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { Table } from './types';
import { logger } from '../../utils/logger';

export const ALL_TOURNAMENTS = 'ALL';

/**
 * 단일 토너먼트의 테이블 구독
 */
export const subscribeSingleTournamentTables = (
  userId: string,
  tournamentId: string,
  onSuccess: (tables: Table[]) => void,
  onError: (error: Error) => void
) => {
  const tablesCollectionRef = collection(db, `users/${userId}/tournaments/${tournamentId}/tables`);

  return onSnapshot(
    tablesCollectionRef,
    (snapshot) => {
      const tablesData = snapshot.docs
        .map((doc: QueryDocumentSnapshot<DocumentData>) => ({
          id: doc.id,
          ...doc.data(),
        } as Table))
        .sort((a, b) => a.tableNumber - b.tableNumber);

      onSuccess(tablesData);
      logger.info('테이블 목록 로드 완료', {
        component: 'tableQueries',
        data: { userId, tournamentId, count: tablesData.length },
      });
    },
    (err) => {
      logger.error('테이블 구독 실패:', err, { component: 'tableQueries' });
      onError(err);
    }
  );
};

/**
 * 모든 토너먼트의 테이블 구독 (전체 보기)
 */
export const subscribeAllTournamentsTables = (
  userId: string,
  onSuccess: (tables: Table[]) => void,
  onError: (error: Error) => void
) => {
  // collectionGroup으로 모든 토너먼트의 tables 컬렉션 조회
  const tablesQuery = collectionGroup(db, 'tables');

  return onSnapshot(
    tablesQuery,
    (snapshot) => {
      const tablesData = snapshot.docs
        .filter((doc) => {
          // 경로에서 userId 확인하여 필터링
          // 경로 형식: users/{userId}/tournaments/{tournamentId}/tables/{tableId}
          return doc.ref.path.startsWith(`users/${userId}/`);
        })
        .map((doc: QueryDocumentSnapshot<DocumentData>) => {
          const data = doc.data();
          // 문서 경로에서 tournamentId 추출
          const pathParts = doc.ref.path.split('/');
          const extractedTournamentId = pathParts[3]; // tournaments 다음이 tournamentId

          return {
            id: doc.id,
            ...data,
            tournamentId: data.tournamentId || extractedTournamentId, // 저장된 값 우선, 없으면 경로에서 추출
          } as Table;
        })
        .sort((a, b) => a.tableNumber - b.tableNumber);

      onSuccess(tablesData);
      logger.info('전체 테이블 목록 로드 완료', {
        component: 'tableQueries',
        data: { userId, count: tablesData.length },
      });
    },
    (err) => {
      logger.error('전체 테이블 구독 실패:', err, { component: 'tableQueries' });
      onError(err);
    }
  );
};

/**
 * 토너먼트 ID에 따라 적절한 구독 함수 선택
 */
export const subscribeToTables = (
  userId: string | null,
  tournamentId: string | null,
  onSuccess: (tables: Table[]) => void,
  onError: (error: Error) => void
) => {
  if (!userId) {
    onSuccess([]);
    return () => {};
  }

  if (!tournamentId) {
    onSuccess([]);
    return () => {};
  }

  if (tournamentId === ALL_TOURNAMENTS) {
    return subscribeAllTournamentsTables(userId, onSuccess, onError);
  }

  return subscribeSingleTournamentTables(userId, tournamentId, onSuccess, onError);
};
