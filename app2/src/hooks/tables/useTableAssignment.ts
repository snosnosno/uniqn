/**
 * useTableAssignment.ts
 *
 * 참가자 배정 전용 Hook
 * - 자동 재배치 (랜덤)
 * - 대기 참가자 배정
 * - 칩 균형 재배치
 * - 개별 좌석 이동
 * - 참가자 탈락 처리
 */

import { useCallback, useState } from 'react';
import { collection, getDocs, doc, runTransaction, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import { logger } from '../../utils/logger';
import { toast } from '../../utils/toast';
import { logAction } from '../useLogger';
import i18n from '../../i18n/config';

import { Table } from '../useTables';
import { Participant } from '../useParticipants';
import { shuffleArray, getActualTournamentId } from './utils/tableHelpers';

/**
 * 배정 결과 인터페이스
 */
export interface AssignmentResult {
  participantId: string;
  participantName: string;
  fromTableNumber?: number;
  fromSeatNumber?: number;
  toTableNumber: number;
  toSeatNumber: number;
}

/**
 * 테이블 배정 Hook 반환 타입
 */
export interface UseTableAssignmentReturn {
  loading: boolean;
  error: Error | null;
  rebalanceAndAssignAll: (participants: Participant[]) => Promise<AssignmentResult[]>;
  assignWaitingParticipants: (participants: Participant[]) => Promise<AssignmentResult[]>;
  autoBalanceByChips: (participants: Participant[]) => Promise<AssignmentResult[]>;
  moveSeat: (
    participantId: string,
    from: { tableId: string; seatIndex: number },
    to: { tableId: string; seatIndex: number }
  ) => Promise<void>;
  bustOutParticipant: (participantId: string) => Promise<void>;
}

/**
 * 참가자 배정 Hook
 *
 * @param userId 사용자 ID
 * @param tournamentId 토너먼트 ID
 * @param tables 현재 테이블 목록
 * @param maxSeatsSetting 최대 좌석 수 설정
 * @returns 배정 작업 함수들
 */
export const useTableAssignment = (
  userId: string | null,
  tournamentId: string | null,
  tables: Table[],
  maxSeatsSetting: number
): UseTableAssignmentReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const rebalanceAndAssignAll = useCallback(
    async (participants: Participant[]): Promise<AssignmentResult[]> => {
      if (!userId || !tournamentId) return [];
      if (participants.length === 0) {
        toast.warning(i18n.t('toast.assignment.noParticipants'));
        return [];
      }
      setLoading(true);
      try {
        const batch = writeBatch(db);
        const tablesCollectionRef = collection(
          db,
          `users/${userId}/tournaments/${tournamentId}/tables`
        );
        const tablesSnapshot = await getDocs(tablesCollectionRef);

        const openTables: Table[] = tablesSnapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Table)
          .filter((t) => t.status === 'open');

        if (openTables.length === 0) {
          logger.error('No open tables for seat assignment', new Error('No open tables'), {
            component: 'useTableAssignment',
          });
          toast.error(i18n.t('toast.assignment.noActiveTablesForSeat'));
          return [];
        }

        const totalSeats = openTables.reduce(
          (sum, table) => sum + (table.seats?.length || maxSeatsSetting),
          0
        );
        if (participants.length > totalSeats) {
          logger.error(
            'Too many participants for available seats',
            new Error(`Participants: ${participants.length}, Seats: ${totalSeats}`),
            {
              component: 'useTableAssignment',
            }
          );
          toast.error(
            i18n.t('toast.assignment.tooManyParticipants', {
              count: participants.length,
              seats: totalSeats,
            })
          );
          return [];
        }

        const shuffledParticipants = shuffleArray(participants);
        const tablePlayerGroups: { [key: string]: Participant[] } = {};
        openTables.forEach((table) => {
          tablePlayerGroups[table.id] = [];
        });

        shuffledParticipants.forEach((participant, index) => {
          const tableIndex = index % openTables.length;
          const targetTable = openTables[tableIndex];
          if (!targetTable) return;
          const targetTableId = targetTable.id;
          const playerGroup = tablePlayerGroups[targetTableId];
          if (playerGroup) {
            playerGroup.push(participant);
          }
        });

        const newTableSeatArrays: { [key: string]: (string | null)[] } = {};
        const participantUpdates: { [key: string]: { tableNumber: number; seatNumber: number } } =
          {};
        const assignmentResults: AssignmentResult[] = [];

        for (const table of openTables) {
          const playersForThisTable = tablePlayerGroups[table.id];
          const seatCount = table.seats?.length || maxSeatsSetting;
          const newSeats: (string | null)[] = Array(seatCount).fill(null);

          const seatIndexes = Array.from({ length: seatCount }, (_, i) => i);
          const shuffledSeatIndexes = shuffleArray(seatIndexes);

          playersForThisTable?.forEach((player, index) => {
            const seatIndex = shuffledSeatIndexes[index];
            if (seatIndex !== undefined) {
              newSeats[seatIndex] = player.id;
              participantUpdates[player.id] = {
                tableNumber: table.tableNumber,
                seatNumber: seatIndex + 1,
              };
              const result: AssignmentResult = {
                participantId: player.id,
                participantName: player.name,
                toTableNumber: table.tableNumber,
                toSeatNumber: seatIndex + 1,
              };
              if (player.tableNumber !== undefined) result.fromTableNumber = player.tableNumber;
              if (player.seatNumber !== undefined) result.fromSeatNumber = player.seatNumber;
              assignmentResults.push(result);
            }
          });

          newTableSeatArrays[table.id] = newSeats;
        }

        // 테이블 좌석 배열 업데이트
        for (const tableId in newTableSeatArrays) {
          const tableRef = doc(db, `users/${userId}/tournaments/${tournamentId}/tables`, tableId);
          batch.update(tableRef, { seats: newTableSeatArrays[tableId] });
        }

        // 참가자 위치 정보 업데이트
        for (const participantId in participantUpdates) {
          const updateData = participantUpdates[participantId];
          if (updateData) {
            const participantRef = doc(
              db,
              `users/${userId}/tournaments/${tournamentId}/participants`,
              participantId
            );
            batch.update(participantRef, updateData);
          }
        }

        await batch.commit();

        logAction('seats_reassigned_with_balancing', {
          participantsCount: participants.length,
          tableCount: openTables.length,
        });
        return assignmentResults;
      } catch (e) {
        const errorContext = {
          failedAction: 'rebalance_and_assign_all',
          participantsCount: participants.length,
          errorMessage: e instanceof Error ? e.message : String(e),
        };
        logAction('action_failed', errorContext);
        logger.error(
          '좌석 자동 재배정 중 오류가 발생했습니다:',
          e instanceof Error ? e : new Error(String(e)),
          {
            component: 'useTableAssignment',
          }
        );
        toast.error(i18n.t('toast.assignment.autoAssignError'));
        setError(e as Error);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [userId, tournamentId, maxSeatsSetting]
  );

  const assignWaitingParticipants = useCallback(
    async (participants: Participant[]): Promise<AssignmentResult[]> => {
      if (!userId || !tournamentId) return [];
      if (participants.length === 0) {
        toast.warning(i18n.t('toast.assignment.noParticipants'));
        return [];
      }
      setLoading(true);
      try {
        const batch = writeBatch(db);
        const tablesCollectionRef = collection(
          db,
          `users/${userId}/tournaments/${tournamentId}/tables`
        );
        const tablesSnapshot = await getDocs(tablesCollectionRef);

        const openTables: Table[] = tablesSnapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Table)
          .filter((t) => t.status === 'open');

        if (openTables.length === 0) {
          logger.error('No open tables for seat assignment', new Error('No open tables'), {
            component: 'useTableAssignment',
          });
          toast.error(i18n.t('toast.assignment.noActiveTablesForSeat'));
          return [];
        }

        // 각 테이블의 현재 인원수 계산
        const mutableTables = openTables.map((table) => ({
          ...table,
          seats: [...(table.seats || Array(maxSeatsSetting).fill(null))],
          playerCount: (table.seats || []).filter((s) => s !== null).length,
        }));

        // 빈 자리 총합 확인
        const totalEmptySeats = mutableTables.reduce(
          (sum, table) => sum + table.seats.filter((s) => s === null).length,
          0
        );

        if (participants.length > totalEmptySeats) {
          logger.error(
            'Too many participants for available seats',
            new Error(`Participants: ${participants.length}, Seats: ${totalEmptySeats}`),
            {
              component: 'useTableAssignment',
            }
          );
          toast.error(
            i18n.t('toast.assignment.tooManyForEmptySeats', {
              count: participants.length,
              seats: totalEmptySeats,
            })
          );
          return [];
        }

        const participantUpdates: { [key: string]: { tableNumber: number; seatNumber: number } } =
          {};
        const assignmentResults: AssignmentResult[] = [];

        // 각 참가자를 가장 인원이 적은 테이블에 배정
        for (const participant of participants) {
          const minPlayerCount = Math.min(...mutableTables.map((t) => t.playerCount));
          const leastPopulatedTables = mutableTables.filter(
            (t) => t.playerCount === minPlayerCount
          );

          const targetTable =
            leastPopulatedTables[Math.floor(Math.random() * leastPopulatedTables.length)];
          if (!targetTable) continue;

          const emptySeatIndexes = targetTable.seats
            .map((seat, index) => (seat === null ? index : -1))
            .filter((index) => index !== -1);

          if (emptySeatIndexes.length === 0) {
            logger.error('No empty seats available', new Error('No empty seats'), {
              component: 'useTableAssignment',
            });
            toast.error(i18n.t('toast.assignment.noEmptySeats'));
            continue;
          }

          const targetSeatIndex =
            emptySeatIndexes[Math.floor(Math.random() * emptySeatIndexes.length)];
          if (targetSeatIndex === undefined) continue;

          targetTable.seats[targetSeatIndex] = participant.id;
          targetTable.playerCount++;

          participantUpdates[participant.id] = {
            tableNumber: targetTable.tableNumber,
            seatNumber: targetSeatIndex + 1,
          };

          assignmentResults.push({
            participantId: participant.id,
            participantName: participant.name,
            toTableNumber: targetTable.tableNumber,
            toSeatNumber: targetSeatIndex + 1,
          });
        }

        // 테이블 좌석 배열 업데이트
        for (const table of mutableTables) {
          const tableRef = doc(db, `users/${userId}/tournaments/${tournamentId}/tables`, table.id);
          batch.update(tableRef, { seats: table.seats });
        }

        // 참가자 위치 정보 업데이트
        for (const participantId in participantUpdates) {
          const updateData = participantUpdates[participantId];
          if (updateData) {
            const participantRef = doc(
              db,
              `users/${userId}/tournaments/${tournamentId}/participants`,
              participantId
            );
            batch.update(participantRef, updateData);
          }
        }

        await batch.commit();

        logAction('seats_reassigned_with_balancing', {
          participantsCount: participants.length,
          tableCount: openTables.length,
        });
        return assignmentResults;
      } catch (e) {
        const errorContext = {
          failedAction: 'assign_waiting_participants',
          participantsCount: participants.length,
          errorMessage: e instanceof Error ? e.message : String(e),
        };
        logAction('action_failed', errorContext);
        logger.error(
          '대기 참가자 배정 중 오류가 발생했습니다:',
          e instanceof Error ? e : new Error(String(e)),
          {
            component: 'useTableAssignment',
          }
        );
        toast.error(i18n.t('toast.assignment.waitingAssignError'));
        setError(e as Error);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [userId, tournamentId, maxSeatsSetting]
  );

  const autoBalanceByChips = useCallback(
    async (participants: Participant[]): Promise<AssignmentResult[]> => {
      if (!userId || !tournamentId) return [];
      const activeParticipants = participants.filter((p) => p.status === 'active');
      if (activeParticipants.length === 0) {
        toast.warning(i18n.t('toast.assignment.noActiveForBalance'));
        return [];
      }

      setLoading(true);
      try {
        const batch = writeBatch(db);
        const tablesCollectionRef = collection(
          db,
          `users/${userId}/tournaments/${tournamentId}/tables`
        );
        const tablesSnapshot = await getDocs(tablesCollectionRef);

        const openTables: Table[] = tablesSnapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Table)
          .filter((t) => t.status === 'open')
          .sort((a, b) => a.tableNumber - b.tableNumber);

        if (openTables.length === 0) {
          logger.error('No open tables for chip balance', new Error('No open tables'), {
            component: 'useTableAssignment',
          });
          toast.error(i18n.t('toast.assignment.noActiveTablesForBalance'));
          return [];
        }

        const totalSeats = openTables.reduce(
          (sum, table) => sum + (table.seats?.length || maxSeatsSetting),
          0
        );
        if (activeParticipants.length > totalSeats) {
          logger.error(
            'Too many active participants for chip balance',
            new Error(`Participants: ${activeParticipants.length}, Seats: ${totalSeats}`),
            {
              component: 'useTableAssignment',
            }
          );
          toast.error(
            i18n.t('toast.assignment.tooManyParticipants', {
              count: activeParticipants.length,
              seats: totalSeats,
            })
          );
          return [];
        }

        // 참가자를 칩 수 기준으로 정렬 (내림차순)
        const sortedParticipants = [...activeParticipants].sort(
          (a, b) => (b.chips || 0) - (a.chips || 0)
        );

        const totalTables = openTables.length;

        const assignmentResults: AssignmentResult[] = [];
        const participantUpdates: { [key: string]: { tableNumber: number; seatNumber: number } } =
          {};

        // 테이블 상태 초기화
        interface TableState {
          id: string;
          tableNumber: number;
          participants: Participant[];
          totalChips: number;
          maxSeats: number;
          chipGroups: { top: number; middle: number; bottom: number };
        }

        const tableStates: TableState[] = openTables.map((table) => ({
          id: table.id,
          tableNumber: table.tableNumber,
          participants: [],
          totalChips: 0,
          maxSeats: table.seats?.length || maxSeatsSetting,
          chipGroups: { top: 0, middle: 0, bottom: 0 },
        }));

        // 테이블 인덱스를 랜덤으로 섞기
        const randomTableIndices = shuffleArray(tableStates.map((_, idx) => idx));

        // 스네이크 드래프트로 배치
        let tableIndex = 0;
        let forward = true;

        for (let i = 0; i < sortedParticipants.length; i++) {
          const participant = sortedParticipants[i];
          if (!participant) continue;

          const actualTableIndex = randomTableIndices[tableIndex];
          if (actualTableIndex === undefined) continue;

          const table = tableStates[actualTableIndex];
          if (!table) continue;

          table.participants.push(participant);
          table.totalChips += participant.chips || 0;

          // 그룹별 카운터
          const participantIndex = i;
          const totalCount = sortedParticipants.length;
          const top25Index = Math.ceil(totalCount * 0.25);
          const bottom25Index = Math.floor(totalCount * 0.75);

          if (participantIndex < top25Index) {
            table.chipGroups.top++;
          } else if (participantIndex >= bottom25Index) {
            table.chipGroups.bottom++;
          } else {
            table.chipGroups.middle++;
          }

          // 스네이크 이동
          if (forward) {
            tableIndex++;
            if (tableIndex >= totalTables) {
              tableIndex = totalTables - 1;
              forward = false;
            }
          } else {
            tableIndex--;
            if (tableIndex < 0) {
              tableIndex = 0;
              forward = true;
            }
          }
        }

        // 각 테이블의 좌석 배치
        for (const tableState of tableStates) {
          const table = openTables.find((t) => t.id === tableState.id);
          if (!table) continue;

          const seatCount = table.seats?.length || maxSeatsSetting;
          const newSeats: (string | null)[] = Array(seatCount).fill(null);

          const availableSeatIndexes = Array.from({ length: seatCount }, (_, i) => i);
          const shuffledIndexes = shuffleArray(availableSeatIndexes);

          tableState.participants.forEach((participant, i) => {
            if (i < shuffledIndexes.length) {
              const seatIndex = shuffledIndexes[i];
              if (seatIndex !== undefined) {
                newSeats[seatIndex] = participant.id;
                participantUpdates[participant.id] = {
                  tableNumber: table.tableNumber,
                  seatNumber: seatIndex + 1,
                };
                const result: AssignmentResult = {
                  participantId: participant.id,
                  participantName: participant.name,
                  toTableNumber: table.tableNumber,
                  toSeatNumber: seatIndex + 1,
                };
                if (participant.tableNumber !== undefined)
                  result.fromTableNumber = participant.tableNumber;
                if (participant.seatNumber !== undefined)
                  result.fromSeatNumber = participant.seatNumber;
                assignmentResults.push(result);
              }
            }
          });

          const tableRef = doc(db, `users/${userId}/tournaments/${tournamentId}/tables`, table.id);
          batch.update(tableRef, { seats: newSeats });
        }

        // 참가자 위치 정보 업데이트
        for (const participantId in participantUpdates) {
          const updateData = participantUpdates[participantId];
          if (updateData) {
            const participantRef = doc(
              db,
              `users/${userId}/tournaments/${tournamentId}/participants`,
              participantId
            );
            batch.update(participantRef, updateData);
          }
        }

        await batch.commit();

        // 균형 검증
        const playerCounts = tableStates.map((t) => t.participants.length);
        const maxPlayers = Math.max(...playerCounts);
        const minPlayers = Math.min(...playerCounts);
        const playerCountDiff = maxPlayers - minPlayers;
        const playerCountBalanced = playerCountDiff <= 1;

        if (!playerCountBalanced) {
          toast.warning(i18n.t('toast.assignment.imbalanceWarning', { diff: playerCountDiff }));
        } else {
          toast.success(i18n.t('toast.assignment.balanceComplete'));
        }

        logAction('seats_reassigned_with_balancing', {
          participantsCount: activeParticipants.length,
          tableCount: openTables.length,
        });
        return assignmentResults;
      } catch (e) {
        const errorContext = {
          failedAction: 'auto_balance_by_chips',
          participantsCount: participants.filter((p) => p.status === 'active').length,
          errorMessage: e instanceof Error ? e.message : String(e),
        };
        logAction('action_failed', errorContext);
        logger.error(
          '칩 균형 재배치 중 오류 발생:',
          e instanceof Error ? e : new Error(String(e)),
          {
            component: 'useTableAssignment',
          }
        );
        toast.error(i18n.t('toast.assignment.balanceError'));
        setError(e as Error);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [userId, tournamentId, maxSeatsSetting]
  );

  const moveSeat = useCallback(
    async (
      participantId: string,
      from: { tableId: string; seatIndex: number },
      to: { tableId: string; seatIndex: number }
    ) => {
      if (!userId || !tournamentId) return;
      if (from.tableId === to.tableId && from.seatIndex === to.seatIndex) return;

      try {
        await runTransaction(db, async (transaction) => {
          const fromTable = tables.find((t) => t.id === from.tableId);
          const toTable = tables.find((t) => t.id === to.tableId);

          if (!fromTable || !toTable) {
            toast.error(i18n.t('toast.tables.notFound'));
            return;
          }

          const fromTournamentId = getActualTournamentId(fromTable, tournamentId);
          const toTournamentId = getActualTournamentId(toTable, tournamentId);

          if (from.tableId === to.tableId) {
            // Same table move
            const tableRef = doc(
              db,
              `users/${userId}/tournaments/${fromTournamentId}/tables`,
              from.tableId
            );
            const tableSnap = await transaction.get(tableRef);
            if (!tableSnap.exists()) {
              logger.error('Table not found during seat move', new Error('Table not found'), {
                component: 'useTableAssignment',
              });
              toast.error(i18n.t('toast.tables.notFound'));
              return;
            }

            const seats = [...tableSnap.data().seats];
            if (seats[to.seatIndex] !== null) {
              logger.error('Target seat already occupied', new Error('Seat occupied'), {
                component: 'useTableAssignment',
              });
              toast.error(i18n.t('toast.tables.seatOccupied'));
              return;
            }

            seats[to.seatIndex] = participantId;
            seats[from.seatIndex] = null;

            transaction.update(tableRef, { seats });
          } else {
            // Different table move
            const fromTableRef = doc(
              db,
              `users/${userId}/tournaments/${fromTournamentId}/tables`,
              from.tableId
            );
            const toTableRef = doc(
              db,
              `users/${userId}/tournaments/${toTournamentId}/tables`,
              to.tableId
            );

            const [fromTableSnap, toTableSnap] = await Promise.all([
              transaction.get(fromTableRef),
              transaction.get(toTableRef),
            ]);

            if (!fromTableSnap.exists() || !toTableSnap.exists()) {
              logger.error(
                'Table information not found during cross-table move',
                new Error('Table not found'),
                {
                  component: 'useTableAssignment',
                }
              );
              toast.error(i18n.t('toast.tables.infoNotFound'));
              return;
            }

            const fromSeats = [...fromTableSnap.data().seats];
            const toSeats = [...toTableSnap.data().seats];

            if (toSeats[to.seatIndex] !== null) {
              logger.error(
                'Target seat already occupied in cross-table move',
                new Error('Seat occupied'),
                {
                  component: 'useTableAssignment',
                }
              );
              toast.error(i18n.t('toast.tables.seatOccupied'));
              return;
            }

            fromSeats[from.seatIndex] = null;
            toSeats[to.seatIndex] = participantId;

            transaction.update(fromTableRef, { seats: fromSeats });
            transaction.update(toTableRef, { seats: toSeats });
          }
        });
        const fromTable = tables.find((t) => t.id === from.tableId);
        const toTable = tables.find((t) => t.id === to.tableId);
        logAction('seat_moved', {
          participantId,
          from: `${fromTable?.tableNumber}-${from.seatIndex + 1}`,
          to: `${toTable?.tableNumber}-${to.seatIndex + 1}`,
        });
      } catch (e) {
        logger.error(
          'An error occurred while moving the seat:',
          e instanceof Error ? e : new Error(String(e)),
          {
            component: 'useTableAssignment',
          }
        );
        setError(e as Error);
        toast.error(i18n.t('toast.assignment.seatMoveError'));
      }
    },
    [userId, tournamentId, tables]
  );

  const bustOutParticipant = useCallback(
    async (participantId: string) => {
      if (!userId || !tournamentId) return;
      try {
        await runTransaction(db, async (transaction) => {
          const table = tables.find((t) => (t.seats || []).includes(participantId));
          if (!table) return;

          const actualTournamentId = getActualTournamentId(table, tournamentId);

          const participantRef = doc(
            db,
            `users/${userId}/tournaments/${actualTournamentId}/participants`,
            participantId
          );
          transaction.update(participantRef, { status: 'busted' });

          const tableRef = doc(
            db,
            `users/${userId}/tournaments/${actualTournamentId}/tables`,
            table.id
          );
          const newSeats = (table.seats || []).map((seat) =>
            seat === participantId ? null : seat
          );
          transaction.update(tableRef, { seats: newSeats });
        });
        logAction('participant_busted', { participantId });
      } catch (e) {
        logger.error('탈락 처리 중 오류 발생:', e instanceof Error ? e : new Error(String(e)), {
          component: 'useTableAssignment',
        });
        setError(e as Error);
        toast.error(i18n.t('toast.assignment.eliminationError'));
      }
    },
    [userId, tournamentId, tables]
  );

  return {
    loading,
    error,
    rebalanceAndAssignAll,
    assignWaitingParticipants,
    autoBalanceByChips,
    moveSeat,
    bustOutParticipant,
  };
};
