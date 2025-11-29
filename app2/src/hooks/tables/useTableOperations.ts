/**
 * useTableOperations.ts
 *
 * 테이블 CRUD 작업 Hook
 * - 테이블 생성, 수정, 삭제, 활성화, 닫기
 * - participantMover를 사용하여 중복 제거
 */

import { useCallback, useState } from 'react';
import {
  collection,
  doc,
  updateDoc,
  addDoc,
  writeBatch,
  getDocs,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { logger } from '../../utils/logger';
import { toast } from '../../utils/toast';
import { logAction } from '../useLogger';
import i18n from '../../i18n/config';

import { Table, BalancingResult } from '../useTables';
import { moveParticipantsToOpenTables } from './utils/participantMover';
import { getActualTournamentId } from './utils/tableHelpers';

/**
 * 테이블 작업 Hook 반환 타입
 */
export interface UseTableOperationsReturn {
  loading: boolean;
  error: Error | null;
  updateTableDetails: (
    tableId: string,
    data: { name?: string; borderColor?: string }
  ) => Promise<void>;
  updateTablePosition: (tableId: string, position: { x: number; y: number }) => Promise<void>;
  updateTableOrder: (tables: Table[]) => Promise<void>;
  openNewTable: () => Promise<void>;
  openNewTableInTournament: (targetTournamentId: string) => Promise<void>;
  activateTable: (tableId: string) => Promise<void>;
  closeTable: (tableId: string) => Promise<BalancingResult[]>;
  deleteTable: (tableId: string) => Promise<BalancingResult[]>;
  updateTableMaxSeats: (
    tableId: string,
    newMaxSeats: number,
    getParticipantName: (id: string) => string
  ) => Promise<void>;
  assignTableToTournament: (tableIds: string[], targetTournamentId: string) => Promise<void>;
}

/**
 * 테이블 CRUD 작업 Hook
 *
 * @param userId 사용자 ID
 * @param tournamentId 토너먼트 ID
 * @param tables 현재 테이블 목록
 * @param maxSeatsSetting 최대 좌석 수 설정
 * @returns 테이블 작업 함수들
 */
export const useTableOperations = (
  userId: string | null,
  tournamentId: string | null,
  tables: Table[],
  maxSeatsSetting: number
): UseTableOperationsReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateTableDetails = useCallback(
    async (tableId: string, data: { name?: string; borderColor?: string }) => {
      if (!userId || !tournamentId) return;
      const tableRef = doc(db, `users/${userId}/tournaments/${tournamentId}/tables`, tableId);
      try {
        await updateDoc(tableRef, data);
        logAction('table_details_updated', { tableId, ...data });
        toast.success(i18n.t('toast.tables.updateSuccess'));
      } catch (e) {
        logger.error(
          'Error updating table details:',
          e instanceof Error ? e : new Error(String(e)),
          {
            component: 'useTableOperations',
          }
        );
        setError(e as Error);
        toast.error(i18n.t('toast.tables.updateError'));
      }
    },
    [userId, tournamentId]
  );

  const updateTablePosition = useCallback(
    async (tableId: string, position: { x: number; y: number }) => {
      if (!userId || !tournamentId) return;
      const tableRef = doc(db, `users/${userId}/tournaments/${tournamentId}/tables`, tableId);
      try {
        await updateDoc(tableRef, { position });
      } catch (e) {
        logger.error(
          'Error updating table position:',
          e instanceof Error ? e : new Error(String(e)),
          {
            component: 'useTableOperations',
          }
        );
        setError(e as Error);
        toast.error(i18n.t('toast.tables.positionUpdateError'));
      }
    },
    [userId, tournamentId]
  );

  const updateTableOrder = useCallback(
    async (tables: Table[]) => {
      if (!userId || !tournamentId) return;
      const batch = writeBatch(db);
      tables.forEach((table, index) => {
        const tableRef = doc(db, `users/${userId}/tournaments/${tournamentId}/tables`, table.id);
        batch.update(tableRef, { tableNumber: index });
      });
      try {
        await batch.commit();
        logAction('table_order_updated', { tableCount: tables.length });
      } catch (e) {
        logger.error('Error updating table order:', e instanceof Error ? e : new Error(String(e)), {
          component: 'useTableOperations',
        });
        setError(e as Error);
        toast.error(i18n.t('toast.tables.orderUpdateError'));
      }
    },
    [userId, tournamentId]
  );

  const openNewTable = useCallback(async () => {
    if (!userId || !tournamentId) return;
    setLoading(true);
    try {
      // 토너먼트 정보 조회 (색상 정보 포함)
      const tournamentSnap = await getDocs(collection(db, `users/${userId}/tournaments`));
      const tournamentData = tournamentSnap.docs.find((d) => d.id === tournamentId)?.data();

      const maxTableNumber = tables.reduce((max, table) => Math.max(max, table.tableNumber), 0);
      const newTable = {
        name: `T${maxTableNumber + 1}`,
        tableNumber: maxTableNumber + 1,
        seats: Array(maxSeatsSetting).fill(null),
        status: 'standby' as const,
        position: { x: 10, y: 10 + tables.length * 40 },
        tournamentId: tournamentId, // 소속 토너먼트 명시
        tournamentColor: tournamentData?.color || null, // 토너먼트 색상 설정
      };
      const tablesCollectionRef = collection(
        db,
        `users/${userId}/tournaments/${tournamentId}/tables`
      );
      const docRef = await addDoc(tablesCollectionRef, newTable);
      logAction('table_created_standby', {
        tableId: docRef.id,
        tableNumber: newTable.tableNumber,
        maxSeats: maxSeatsSetting,
      });
    } catch (e) {
      logger.error('Error opening new table:', e instanceof Error ? e : new Error(String(e)), {
        component: 'useTableOperations',
      });
      setError(e as Error);
      toast.error(i18n.t('toast.tables.createError'));
    } finally {
      setLoading(false);
    }
  }, [userId, tournamentId, tables, maxSeatsSetting]);

  const openNewTableInTournament = useCallback(
    async (targetTournamentId: string) => {
      if (!userId || !targetTournamentId || targetTournamentId === 'ALL') {
        toast.error(i18n.t('toast.tables.selectTournament'));
        return;
      }

      setLoading(true);
      try {
        // 토너먼트 정보 조회 (색상 정보 포함)
        const tournamentSnap = await getDocs(collection(db, `users/${userId}/tournaments`));
        const tournamentData = tournamentSnap.docs.find((d) => d.id === targetTournamentId)?.data();

        // 해당 토너먼트의 기존 테이블 조회
        const targetTablesRef = collection(
          db,
          `users/${userId}/tournaments/${targetTournamentId}/tables`
        );
        const targetTablesSnapshot = await getDocs(targetTablesRef);

        const existingTables = targetTablesSnapshot.docs.map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            }) as Table
        );

        const maxTableNumber = existingTables.reduce(
          (max, table) => Math.max(max, table.tableNumber),
          0
        );

        const newTable = {
          name: `T${maxTableNumber + 1}`,
          tableNumber: maxTableNumber + 1,
          seats: Array(9).fill(null), // 기본 9석
          status: 'standby' as const,
          position: { x: 10, y: 10 + existingTables.length * 40 },
          tournamentId: targetTournamentId, // 소속 토너먼트 명시
          tournamentColor: tournamentData?.color || null, // 토너먼트 색상 설정
        };

        await addDoc(targetTablesRef, newTable);

        toast.success(i18n.t('toast.tables.createSuccess'));
        logAction('table_created_standby', {
          tournamentId: targetTournamentId,
          tableNumber: newTable.tableNumber,
          maxSeats: 9,
        });
      } catch (e) {
        logger.error(
          'Error opening new table in tournament:',
          e instanceof Error ? e : new Error(String(e)),
          { component: 'useTableOperations' }
        );
        setError(e as Error);
        toast.error(i18n.t('toast.tables.createError'));
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  const activateTable = useCallback(
    async (tableId: string) => {
      if (!userId || !tournamentId) return;

      try {
        // 테이블 정보를 먼저 찾아서 실제 tournamentId 사용
        const table = tables.find((t) => t.id === tableId);
        if (!table) {
          toast.error(i18n.t('toast.tables.notFound'));
          return;
        }

        const actualTournamentId = getActualTournamentId(table, tournamentId);
        const tableRef = doc(
          db,
          `users/${userId}/tournaments/${actualTournamentId}/tables`,
          tableId
        );
        await updateDoc(tableRef, { status: 'open' });
        logAction('table_activated', { tableId });
      } catch (e) {
        logger.error('Error activating table:', e instanceof Error ? e : new Error(String(e)), {
          component: 'useTableOperations',
        });
        setError(e as Error);
        toast.error(i18n.t('toast.tables.activateError'));
      }
    },
    [userId, tournamentId, tables]
  );

  const closeTable = useCallback(
    async (tableIdToClose: string): Promise<BalancingResult[]> => {
      if (!userId || !tournamentId) return [];

      // 닫으려는 테이블 찾기
      const tableToClose = tables.find((t) => t.id === tableIdToClose);
      if (!tableToClose) {
        toast.error(i18n.t('toast.tables.closeNotFound'));
        return [];
      }

      // 참가자가 있는지 확인
      const hasParticipants = (tableToClose.seats || []).some((seat) => seat !== null);

      if (hasParticipants) {
        // 같은 토너먼트의 다른 열린 테이블 확인
        const actualTournamentId = tableToClose.tournamentId || tournamentId;
        const otherOpenTables = tables.filter(
          (t) =>
            t.id !== tableIdToClose &&
            t.status === 'open' &&
            (actualTournamentId === 'ALL' || t.tournamentId === actualTournamentId)
        );

        if (otherOpenTables.length === 0) {
          toast.error(i18n.t('toast.tables.noOpenTablesForMove'));
          return [];
        }
      }

      setLoading(true);
      try {
        const results = await moveParticipantsToOpenTables(
          tableIdToClose,
          userId,
          tournamentId,
          maxSeatsSetting,
          'close'
        );
        return results;
      } finally {
        setLoading(false);
      }
    },
    [userId, tournamentId, maxSeatsSetting, tables]
  );

  const deleteTable = useCallback(
    async (tableIdToDelete: string): Promise<BalancingResult[]> => {
      if (!userId || !tournamentId) return [];

      // 삭제하려는 테이블 찾기
      const tableToDelete = tables.find((t) => t.id === tableIdToDelete);
      if (!tableToDelete) {
        toast.error(i18n.t('toast.tables.deleteNotFound'));
        return [];
      }

      // 참가자가 있는지 확인
      const hasParticipants = (tableToDelete.seats || []).some((seat) => seat !== null);

      if (hasParticipants) {
        // 같은 토너먼트의 다른 열린 테이블 확인
        const actualTournamentId = tableToDelete.tournamentId || tournamentId;
        const otherOpenTables = tables.filter(
          (t) =>
            t.id !== tableIdToDelete &&
            t.status === 'open' &&
            (actualTournamentId === 'ALL' || t.tournamentId === actualTournamentId)
        );

        if (otherOpenTables.length === 0) {
          toast.error(i18n.t('toast.tables.noOpenTablesForMove'));
          return [];
        }
      }

      setLoading(true);
      try {
        const results = await moveParticipantsToOpenTables(
          tableIdToDelete,
          userId,
          tournamentId,
          maxSeatsSetting,
          'delete'
        );
        return results;
      } finally {
        setLoading(false);
      }
    },
    [userId, tournamentId, maxSeatsSetting, tables]
  );

  const updateTableMaxSeats = useCallback(
    async (tableId: string, newMaxSeats: number, getParticipantName: (id: string) => string) => {
      if (!userId || !tournamentId) return;
      try {
        await runTransaction(db, async (transaction) => {
          // 테이블의 실제 tournamentId 찾기
          const table = tables.find((t) => t.id === tableId);
          if (!table) {
            toast.error(i18n.t('toast.tables.notFound'));
            return;
          }

          const actualTournamentId = getActualTournamentId(table, tournamentId);
          const tableRef = doc(
            db,
            `users/${userId}/tournaments/${actualTournamentId}/tables`,
            tableId
          );
          const tableSnap = await transaction.get(tableRef);
          if (!tableSnap.exists()) {
            logger.error('Table not found for max seats update', new Error('Table not found'), {
              component: 'useTableOperations',
            });
            toast.error(i18n.t('toast.tables.notFound'));
            return;
          }

          const tableData = tableSnap.data() as Table;
          const currentSeats = tableData.seats || [];
          const currentMaxSeats = currentSeats.length;

          if (newMaxSeats === currentMaxSeats) return;

          if (newMaxSeats < currentMaxSeats) {
            const seatsToRemove = currentSeats.slice(newMaxSeats);
            const occupiedSeatsToRemove = seatsToRemove
              .map((pId, i) => ({ pId, seatNum: newMaxSeats + i + 1 }))
              .filter((s) => s.pId !== null);

            if (occupiedSeatsToRemove.length > 0) {
              const playerInfo = occupiedSeatsToRemove
                .map((s) => `${s.seatNum}번(${getParticipantName(s.pId!)})`)
                .join(', ');
              logger.error(
                'Cannot reduce seats with occupied positions',
                new Error('Occupied seats'),
                {
                  component: 'useTableOperations',
                }
              );
              toast.error(i18n.t('toast.tables.movePlayersFirst', { players: playerInfo }));
              return;
            }
          }

          const newSeats = Array(newMaxSeats).fill(null);
          for (let i = 0; i < Math.min(currentMaxSeats, newMaxSeats); i++) {
            newSeats[i] = currentSeats[i];
          }

          transaction.update(tableRef, { seats: newSeats });
        });

        logAction('max_seats_updated', { tableId, newMaxSeats });
      } catch (e) {
        logger.error(
          '최대 좌석 수 변경 중 오류 발생:',
          e instanceof Error ? e : new Error(String(e)),
          {
            component: 'useTableOperations',
          }
        );
        setError(e as Error);
        toast.error(i18n.t('toast.tables.maxSeatsError'));
      }
    },
    [userId, tournamentId, tables]
  );

  const assignTableToTournament = useCallback(
    async (tableIds: string[], targetTournamentId: string) => {
      if (!userId) {
        toast.error(i18n.t('toast.tables.userIdRequired'));
        return;
      }

      if (!targetTournamentId || targetTournamentId === 'ALL') {
        toast.error(i18n.t('toast.tables.selectTournament'));
        return;
      }

      setLoading(true);
      try {
        // 목적지 토너먼트 정보 조회 (색상 정보 포함)
        const tournamentSnap = await getDocs(collection(db, `users/${userId}/tournaments`));
        const targetTournamentData = tournamentSnap.docs
          .find((d) => d.id === targetTournamentId)
          ?.data();

        const batch = writeBatch(db);

        for (const tableId of tableIds) {
          // 현재 테이블의 tournamentId 찾기
          const table = tables.find((t) => t.id === tableId);
          if (!table) continue;

          const currentTournamentId = table.tournamentId || tournamentId;
          if (!currentTournamentId || currentTournamentId === 'ALL') continue;

          // 원본 테이블 문서 참조
          const sourceTableRef = doc(
            db,
            `users/${userId}/tournaments/${currentTournamentId}/tables`,
            tableId
          );

          // 목적지 테이블 문서 참조 (같은 ID 사용)
          const targetTableRef = doc(
            db,
            `users/${userId}/tournaments/${targetTournamentId}/tables`,
            tableId
          );

          // 테이블 데이터 복사 (tournamentId와 tournamentColor 업데이트하여)
          batch.set(targetTableRef, {
            ...table,
            tournamentId: targetTournamentId,
            tournamentColor: targetTournamentData?.color || null,
          });

          // 원본 테이블 삭제
          batch.delete(sourceTableRef);
        }

        await batch.commit();

        toast.success(i18n.t('toast.tables.assignedCount', { count: tableIds.length }));
        logAction('tables_assigned_to_tournament', {
          tableCount: tableIds.length,
          targetTournamentId,
        });
      } catch (e) {
        logger.error('테이블 배정 중 오류 발생:', e instanceof Error ? e : new Error(String(e)), {
          component: 'useTableOperations',
        });
        toast.error(i18n.t('toast.tables.assignError'));
        setError(e as Error);
      } finally {
        setLoading(false);
      }
    },
    [userId, tournamentId, tables]
  );

  return {
    loading,
    error,
    updateTableDetails,
    updateTablePosition,
    updateTableOrder,
    openNewTable,
    openNewTableInTournament,
    activateTable,
    closeTable,
    deleteTable,
    updateTableMaxSeats,
    assignTableToTournament,
  };
};
