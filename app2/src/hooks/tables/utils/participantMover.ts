/**
 * participantMover.ts
 *
 * closeTable과 deleteTable의 공통 로직 통합
 * - 참가자 이동 로직 중복 제거 (298줄 → 200줄)
 * - 트랜잭션 기반 안전한 참가자 재배치
 */

import {
  collection,
  collectionGroup,
  getDocs,
  doc,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../../../firebase';
import { logger } from '../../../utils/logger';
import { toast } from '../../../utils/toast';
import { logAction } from '../../useLogger';

import { Table, BalancingResult } from '../../useTables';
import { getActualTournamentId } from './tableHelpers';

/**
 * 참가자 이동 상세 정보
 */
interface MoveDetail {
  participantId: string;
  from: string; // "테이블번호-좌석번호" 형식
  to: string; // "테이블번호-좌석번호" 형식
}

/**
 * 참가자를 다른 테이블로 이동시킵니다 (closeTable, deleteTable 공통 로직)
 *
 * @param tableIdToProcess 닫거나 삭제할 테이블 ID
 * @param userId 사용자 ID
 * @param tournamentId 토너먼트 ID (또는 'ALL')
 * @param maxSeatsSetting 최대 좌석 수 설정
 * @param mode 'close' (테이블 닫기) 또는 'delete' (테이블 삭제)
 * @returns 참가자 이동 결과 배열
 */
export async function moveParticipantsToOpenTables(
  tableIdToProcess: string,
  userId: string,
  tournamentId: string,
  maxSeatsSetting: number,
  mode: 'close' | 'delete'
): Promise<BalancingResult[]> {
  const balancingResult: BalancingResult[] = [];
  const movedParticipantsDetails: MoveDetail[] = [];

  try {
    const transactionResult = await runTransaction(db, async (transaction) => {
      // 1. 처리할 테이블의 실제 위치 찾기
      let tableToProcess: Table | undefined;
      let actualTournamentId: string | undefined;

      if (tournamentId === 'ALL') {
        // 전체 모드: collectionGroup으로 모든 테이블 조회
        const tablesGroupRef = collectionGroup(db, 'tables');
        const tablesSnapshot = await getDocs(tablesGroupRef);
        const foundDoc = tablesSnapshot.docs.find(d => d.id === tableIdToProcess);

        if (foundDoc) {
          const pathParts = foundDoc.ref.path.split('/');
          actualTournamentId = pathParts[3] || undefined;
          tableToProcess = {
            id: foundDoc.id,
            ...foundDoc.data(),
            tournamentId: actualTournamentId
          } as Table;
        }
      } else {
        // 일반 모드: 먼저 현재 토너먼트에서 찾기
        const tablesCollectionRef = collection(db, `users/${userId}/tournaments/${tournamentId}/tables`);
        const tablesSnapshot = await getDocs(tablesCollectionRef);
        const foundDoc = tablesSnapshot.docs.find(d => d.id === tableIdToProcess);

        if (foundDoc) {
          actualTournamentId = tournamentId;
          tableToProcess = {
            id: foundDoc.id,
            ...foundDoc.data(),
            tournamentId: tournamentId
          } as Table;
        } else {
          // 현재 토너먼트에 없으면 collectionGroup으로 전체 검색
          const tablesGroupRef = collectionGroup(db, 'tables');
          const allTablesSnapshot = await getDocs(tablesGroupRef);
          const foundInAll = allTablesSnapshot.docs.find(d => {
            const pathParts = d.ref.path.split('/');
            const pathUserId = pathParts[1];
            return d.id === tableIdToProcess && pathUserId === userId;
          });

          if (foundInAll) {
            const pathParts = foundInAll.ref.path.split('/');
            actualTournamentId = pathParts[3] || undefined;
            tableToProcess = {
              id: foundInAll.id,
              ...foundInAll.data(),
              tournamentId: actualTournamentId
            } as Table;
          }
        }
      }

      if (!tableToProcess || !actualTournamentId) {
        logger.error(
          `Table not found for ${mode}`,
          new Error(`Table with id ${tableIdToProcess} not found`),
          { component: 'participantMover' }
        );
        toast.error(`${mode === 'close' ? '닫' : '삭제하'}으려는 테이블을 찾을 수 없습니다.`);
        return { balancingResult: [], movedParticipantsDetails: [] };
      }

      // 2. 같은 토너먼트의 다른 테이블들 조회
      const tablesCollectionRef = collection(db, `users/${userId}/tournaments/${actualTournamentId}/tables`);
      const tablesSnapshot = await getDocs(tablesCollectionRef);
      const allTables = tablesSnapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
        tournamentId: actualTournamentId
      } as Table));

      // 3. 이동할 참가자 목록 추출
      const participantsToMove = (tableToProcess.seats || [])
        .map((pId, index) => ({ pId, fromSeatIndex: index }))
        .filter(item => item.pId !== null) as { pId: string; fromSeatIndex: number }[];

      // 4. 참가자 정보 가져오기 (이름 표시용)
      const participantsCollectionRef = collection(
        db,
        `users/${userId}/tournaments/${actualTournamentId}/participants`
      );
      const participantsSnapshot = await getDocs(participantsCollectionRef);
      const participantsMap = new Map(
        participantsSnapshot.docs.map(d => [d.id, { id: d.id, ...d.data() }])
      );

      // 5. 참가자가 없는 경우 - 테이블만 처리
      if (participantsToMove.length === 0) {
        const tableRef = doc(db, `users/${userId}/tournaments/${actualTournamentId}/tables`, tableIdToProcess);

        if (mode === 'close') {
          const emptySeats = Array((tableToProcess.seats || []).length || maxSeatsSetting).fill(null);
          transaction.update(tableRef, { status: 'standby', seats: emptySeats });
          logAction('table_closed', {
            tableId: tableIdToProcess,
            tableNumber: tableToProcess.tableNumber,
            movedParticipantsCount: 0,
          });
        } else {
          transaction.delete(tableRef);
          logAction('table_deleted', {
            tableId: tableIdToProcess,
            tableNumber: tableToProcess.tableNumber,
            movedParticipantsCount: 0,
          });
        }

        return { balancingResult: [], movedParticipantsDetails: [] };
      }

      // 6. 활성화된 다른 테이블 찾기
      const openTables = allTables.filter(
        t => t.id !== tableIdToProcess && t.status === 'open'
      );

      if (openTables.length === 0) {
        logger.error(
          'No open tables available for participant relocation',
          new Error('No open tables'),
          { component: 'participantMover' }
        );
        toast.error('참가자를 이동시킬 수 있는 활성화된 테이블이 없습니다.');
        return { balancingResult: [], movedParticipantsDetails: [] };
      }

      // 7. 가변 테이블 상태 준비 (참가자 수 추적)
      const mutableOpenTables = openTables.map(t => ({
        ...t,
        seats: [...(t.seats || Array(maxSeatsSetting).fill(null))],
        playerCount: (t.seats || []).filter(s => s !== null).length,
      }));

      // 8. 각 참가자를 가장 인원이 적은 테이블에 배정
      for (const participantToMove of participantsToMove) {
        const minPlayerCount = Math.min(...mutableOpenTables.map(t => t.playerCount));
        const leastPopulatedTables = mutableOpenTables.filter(
          t => t.playerCount === minPlayerCount
        );

        // 랜덤 선택
        let targetTable = leastPopulatedTables[Math.floor(Math.random() * leastPopulatedTables.length)];
        if (!targetTable) continue;

        let emptySeatIndexes = targetTable.seats
          .map((seat, index) => (seat === null ? index : -1))
          .filter(index => index !== -1);

        // 빈 자리가 없으면 대체 테이블 찾기
        if (emptySeatIndexes.length === 0) {
          const alternativeTables = mutableOpenTables.filter(
            t => t.id !== targetTable?.id && t.seats.some(s => s === null)
          );

          if (alternativeTables.length === 0) {
            logger.error(
              'Balancing failed: No seats available',
              new Error('No seats available'),
              { component: 'participantMover' }
            );
            toast.error('참가자를 배치할 빈 좌석이 없습니다.');
            return { balancingResult: [], movedParticipantsDetails: [] };
          }

          targetTable = alternativeTables[Math.floor(Math.random() * alternativeTables.length)];
          if (!targetTable) continue;
          emptySeatIndexes = targetTable.seats.map((s, i) => (s === null ? i : -1)).filter(i => i !== -1);
        }

        const targetSeatIndex = emptySeatIndexes[Math.floor(Math.random() * emptySeatIndexes.length)];
        if (targetSeatIndex === undefined) continue;

        // 자리 배정
        targetTable.seats[targetSeatIndex] = participantToMove.pId;
        targetTable.playerCount++;

        // 결과 기록
        const from = {
          tableNumber: tableToProcess.tableNumber,
          seatIndex: participantToMove.fromSeatIndex,
        };
        const to = {
          tableNumber: targetTable.tableNumber,
          seatIndex: targetSeatIndex,
        };

        const participant = participantsMap.get(participantToMove.pId);
        const participantName = participant ? ((participant as { name?: string }).name || '이름 없음') : '이름 없음';

        balancingResult.push({
          participantId: participantToMove.pId,
          participantName,
          fromTableNumber: from.tableNumber,
          fromSeatIndex: from.seatIndex,
          toTableNumber: to.tableNumber,
          toSeatIndex: to.seatIndex,
        });

        movedParticipantsDetails.push({
          participantId: participantToMove.pId,
          from: `${from.tableNumber}-${from.seatIndex + 1}`,
          to: `${to.tableNumber}-${to.seatIndex + 1}`,
        });
      }

      // 9. 변경된 테이블 좌석 배열 업데이트
      mutableOpenTables.forEach(t => {
        const targetTableTournamentId = t.tournamentId || tournamentId;
        const tableRef = doc(db, `users/${userId}/tournaments/${targetTableTournamentId}/tables`, t.id);
        transaction.update(tableRef, { seats: t.seats });
      });

      // 10. 처리할 테이블 닫기 또는 삭제
      const processedTableRef = doc(
        db,
        `users/${userId}/tournaments/${actualTournamentId}/tables`,
        tableIdToProcess
      );

      if (mode === 'close') {
        const emptySeats = Array((tableToProcess.seats || []).length || maxSeatsSetting).fill(null);
        transaction.update(processedTableRef, { status: 'standby', seats: emptySeats });
        logAction('table_closed', {
          tableId: tableIdToProcess,
          tableNumber: tableToProcess.tableNumber,
          movedParticipantsCount: participantsToMove.length,
        });
      } else {
        transaction.delete(processedTableRef);
        logAction('table_deleted', {
          tableId: tableIdToProcess,
          tableNumber: tableToProcess.tableNumber,
          movedParticipantsCount: participantsToMove.length,
        });
      }

      // 이동 로그
      logAction('participants_moved', {
        details: movedParticipantsDetails,
      });

      return { balancingResult, movedParticipantsDetails };
    });

    return transactionResult?.balancingResult || [];
  } catch (e) {
    const errorContext = {
      failedAction: `${mode}_table`,
      tableId: tableIdToProcess,
      errorMessage: e instanceof Error ? e.message : String(e),
    };
    logAction('action_failed', errorContext);
    logger.error(
      `Error ${mode === 'close' ? 'closing' : 'deleting'} table:`,
      e instanceof Error ? e : new Error(String(e)),
      { component: 'participantMover' }
    );
    toast.error(`테이블 ${mode === 'close' ? '닫기' : '삭제'} 중 오류가 발생했습니다.`);
    return [];
  }
}
