import { collection, onSnapshot, doc, runTransaction, DocumentData, QueryDocumentSnapshot, getDocs, writeBatch, addDoc, updateDoc } from 'firebase/firestore';
import { logger } from '../utils/logger';
import { toast } from '../utils/toast';
import { useState, useEffect, useCallback } from 'react';

import { db } from '../firebase';

import { logAction } from './useLogger';
import { Participant } from './useParticipants';

export interface Table {
  id: string;
  name: string;
  tableNumber: number;
  seats: (string | null)[];
  status?: 'open' | 'closed' | 'standby';
  borderColor?: string;
  position?: { x: number; y: number };
  assignedStaffId?: string | null;
  assignedDealerId?: string | null; // @deprecated - assignedStaffId 사용 권장. 하위 호환성을 위해 유지
}

export interface BalancingResult {
  participantId: string;
  fromTableNumber: number;
  fromSeatIndex: number;
  toTableNumber: number;
  toSeatIndex: number;
}

const tablesCollection = collection(db, 'tables');

const shuffleArray = <T>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = newArray[i]!;
    newArray[i] = newArray[j]!;
    newArray[j] = temp;
  }
  return newArray;
};

export const useTables = (userId: string | null, tournamentId: string | null) => {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [maxSeatsSetting, setMaxSeatsSetting] = useState<number>(9);

  useEffect(() => {
    const settingsDocRef = doc(db, 'tournaments', 'settings');
    const unsubscribeSettings = onSnapshot(settingsDocRef, (docSnap) => {
        if (docSnap.exists() && docSnap.data().maxSeatsPerTable) {
            setMaxSeatsSetting(docSnap.data().maxSeatsPerTable);
        }
    });

    const unsubscribeTables = onSnapshot(tablesCollection,
      (snapshot) => {
        const tablesData = snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
          id: doc.id,
          ...doc.data(),
        } as Table)).sort((a, b) => a.tableNumber - b.tableNumber);
        setTables(tablesData);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => {
        unsubscribeSettings();
        unsubscribeTables();
    };
  }, []);
  
  const updateTableDetails = useCallback(async (tableId: string, data: { name?: string; borderColor?: string }) => {
    const tableRef = doc(db, 'tables', tableId);
    try {
      await updateDoc(tableRef, data);
      logAction('table_details_updated', { tableId, ...data });
      toast.success('테이블 정보가 성공적으로 업데이트되었습니다.');
    } catch (e) {
      logger.error('Error updating table details:', e instanceof Error ? e : new Error(String(e)), { component: 'useTables' });
      setError(e as Error);
      toast.error('테이블 정보 업데이트 중 오류가 발생했습니다.');
    }
  }, []);

  const updateTablePosition = useCallback(async (tableId: string, position: { x: number; y: number }) => {
    const tableRef = doc(db, 'tables', tableId);
    try {
      await updateDoc(tableRef, { position });
    } catch (e) {
      logger.error('Error updating table position:', e instanceof Error ? e : new Error(String(e)), { component: 'useTables' });
      setError(e as Error);
      toast.error('테이블 위치 업데이트 중 오류가 발생했습니다.');
    }
  }, []);

  const updateTableOrder = useCallback(async (tables: Table[]) => {
    const batch = writeBatch(db);
    tables.forEach((table, index) => {
        const tableRef = doc(db, 'tables', table.id);
        batch.update(tableRef, { tableNumber: index });
    });
    try {
        await batch.commit();
        logAction('table_order_updated', { tableCount: tables.length });
    } catch (e) {
        logger.error('Error updating table order:', e instanceof Error ? e : new Error(String(e)), { component: 'useTables' });
        setError(e as Error);
        toast.error('테이블 순서 업데이트 중 오류가 발생했습니다.');
    }
  }, []);

  const openNewTable = useCallback(async () => {
    setLoading(true);
    try {
      const maxTableNumber = tables.reduce((max, table) => Math.max(max, table.tableNumber), 0);
      const newTable = {
        name: `T${maxTableNumber + 1}`,
        tableNumber: maxTableNumber + 1,
        seats: Array(maxSeatsSetting).fill(null),
        status: 'standby' as const,
        position: { x: 10, y: 10 + (tables.length * 40) },
      };
      const docRef = await addDoc(tablesCollection, newTable);
      logAction('table_created_standby', { tableId: docRef.id, tableNumber: newTable.tableNumber, maxSeats: maxSeatsSetting });
    } catch (e) {
      logger.error('Error opening new table:', e instanceof Error ? e : new Error(String(e)), { component: 'useTables' });
      setError(e as Error);
      toast.error('새 테이블 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [tables, maxSeatsSetting]);

  const activateTable = useCallback(async (tableId: string) => {
    const tableRef = doc(db, 'tables', tableId);
    try {
      await updateDoc(tableRef, { status: 'open' });
      logAction('table_activated', { tableId });
    } catch (e) {
      logger.error('Error activating table:', e instanceof Error ? e : new Error(String(e)), { component: 'useTables' });
      setError(e as Error);
      toast.error('테이블 활성화 중 오류가 발생했습니다.');
    }
  }, []);
  
  const closeTable = useCallback(async (tableIdToClose: string): Promise<BalancingResult[]> => {
    setLoading(true);
    try {
      const balancingResult: BalancingResult[] = [];
      const movedParticipantsDetails: any[] = [];

      const transactionResult = await runTransaction(db, async (transaction) => {
        const tablesSnapshot = await getDocs(tablesCollection);
        const allTables: Table[] = tablesSnapshot.docs
          .map(d => ({ id: d.id, ...d.data() } as Table));

        const tableToClose = allTables.find(t => t.id === tableIdToClose);
        if (!tableToClose) {
          logger.error('Table not found for closing', new Error(`Table with id ${tableIdToClose} not found`), { component: 'useTables' });
          toast.error('닫으려는 테이블을 찾을 수 없습니다.');
          return { balancingResult: [], movedParticipantsDetails: [] };
        }

        const participantsToMove = (tableToClose.seats || [])
            .map((pId, index) => ({ pId, fromSeatIndex: index}))
            .filter(item => item.pId !== null) as { pId: string, fromSeatIndex: number }[];

        if (participantsToMove.length === 0) {
            const tableRef = doc(db, 'tables', tableIdToClose);
            transaction.delete(tableRef);
            logAction('table_closed', { tableId: tableIdToClose, tableNumber: tableToClose.tableNumber, movedParticipantsCount: 0 });
            return;
        }

        const openTables = allTables.filter(t => t.id !== tableIdToClose && t.status === 'open');
        if (openTables.length === 0) {
            logger.error('No open tables available for participant relocation', new Error('No open tables'), { component: 'useTables' });
            toast.error('참가자를 이동시킬 수 있는 활성화된 테이블이 없습니다.');
            return { balancingResult: [], movedParticipantsDetails: [] };
        }
        
        const mutableOpenTables = openTables.map(t => ({
          ...t,
          seats: [...(t.seats || Array(maxSeatsSetting).fill(null))],
          playerCount: (t.seats || []).filter(s => s !== null).length,
        }));

        for (const participantToMove of participantsToMove) {
          const minPlayerCount = Math.min(...mutableOpenTables.map(t => t.playerCount));
          const leastPopulatedTables = mutableOpenTables.filter(t => t.playerCount === minPlayerCount);
          
          let targetTable = leastPopulatedTables[Math.floor(Math.random() * leastPopulatedTables.length)];
          if (!targetTable) continue;
          let emptySeatIndexes = targetTable.seats.map((seat, index) => (seat === null ? index : -1)).filter(index => index !== -1);

          if (emptySeatIndexes.length === 0) {
             const alternativeTables = mutableOpenTables.filter(t => t.id !== targetTable?.id && t.seats.some(s => s === null));
             if(alternativeTables.length === 0) {
               logger.error('Balancing failed: No seats available', new Error('No seats available'), { component: 'useTables' });
               toast.error('참가자를 배치할 빈 좌석이 없습니다.');
               return { balancingResult: [], movedParticipantsDetails: [] };
             }
             
             targetTable = alternativeTables[Math.floor(Math.random() * alternativeTables.length)];
             if (!targetTable) continue;
             emptySeatIndexes = targetTable.seats.map((s, i) => s === null ? i : -1).filter(i => i !== -1);
          }
          
          const targetSeatIndex = emptySeatIndexes[Math.floor(Math.random() * emptySeatIndexes.length)];
          if (targetSeatIndex === undefined) continue;

          targetTable.seats[targetSeatIndex] = participantToMove.pId;
          targetTable.playerCount++;
          
          const from = { tableNumber: tableToClose.tableNumber, seatIndex: participantToMove.fromSeatIndex };
          const to = { tableNumber: targetTable.tableNumber, seatIndex: targetSeatIndex };
          
          balancingResult.push({ participantId: participantToMove.pId, fromTableNumber: from.tableNumber, fromSeatIndex: from.seatIndex, toTableNumber: to.tableNumber, toSeatIndex: to.seatIndex });
          movedParticipantsDetails.push({ participantId: participantToMove.pId, from: `${from.tableNumber}-${from.seatIndex+1}`, to: `${to.tableNumber}-${to.seatIndex+1}` });
        }
        
        mutableOpenTables.forEach(t => {
            const tableRef = doc(db, 'tables', t.id);
            transaction.update(tableRef, { seats: t.seats });
        });

        const closedTableRef = doc(db, 'tables', tableIdToClose);
        transaction.delete(closedTableRef);
        
        logAction('table_closed', { 
            tableId: tableIdToClose, 
            tableNumber: tableToClose.tableNumber,
            movedParticipantsCount: participantsToMove.length
        });
        logAction('participants_moved', {
            details: movedParticipantsDetails
        });

        return { balancingResult, movedParticipantsDetails };
      });

      return transactionResult?.balancingResult || [];
    } catch (e) {
      const errorContext = {
        failedAction: 'close_table',
        tableId: tableIdToClose,
        errorMessage: e instanceof Error ? e.message : String(e),
      };
      logAction('action_failed', errorContext);
      logger.error('Error closing table:', e instanceof Error ? e : new Error(String(e)), { component: 'useTables' });
      setError(e as Error);
      toast.error('테이블 닫기 중 오류가 발생했습니다.');
      return [];
    } finally {
      setLoading(false);
    }
  }, [maxSeatsSetting]);
  
  const rebalanceAndAssignAll = useCallback(async (participants: Participant[]) => {
    if (participants.length === 0) {
        toast.warning("배정할 참가자가 없습니다.");
        return;
    }
    setLoading(true);
    try {
      const batch = writeBatch(db);
      const tablesSnapshot = await getDocs(tablesCollection);
      
      const openTables: Table[] = tablesSnapshot.docs
        .map(d => ({id: d.id, ...d.data()} as Table))
        .filter(t => t.status === 'open');

      if (openTables.length === 0) {
        logger.error('No open tables for seat assignment', new Error('No open tables'), { component: 'useTables' });
        toast.error('좌석을 배정할 수 있는 활성화된 테이블이 없습니다.');
        return;
      }

      const totalSeats = openTables.reduce((sum, table) => sum + (table.seats?.length || maxSeatsSetting), 0);
      if (participants.length > totalSeats) {
        logger.error('Too many participants for available seats', new Error(`Participants: ${participants.length}, Seats: ${totalSeats}`), { component: 'useTables' });
        toast.error(`참가자 수(${participants.length}명)가 전체 좌석 수(${totalSeats}석)보다 많아 배정할 수 없습니다.`);
        return;
      }

      const shuffledParticipants = shuffleArray(participants);
      const tablePlayerGroups: { [key: string]: Participant[] } = {};
      openTables.forEach(table => {
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
          }
        });
        
        newTableSeatArrays[table.id] = newSeats;
      }

      for (const tableId in newTableSeatArrays) {
          const tableRef = doc(db, 'tables', tableId);
          batch.update(tableRef, { seats: newTableSeatArrays[tableId] });
      }
      
      await batch.commit();

      logAction('seats_reassigned_with_balancing', { participantsCount: participants.length, tableCount: openTables.length });
    } catch (e) {
      const errorContext = {
        failedAction: 'rebalance_and_assign_all',
        participantsCount: participants.length,
        errorMessage: e instanceof Error ? e.message : String(e),
      };
      logAction('action_failed', errorContext);
      logger.error('좌석 자동 재배정 중 오류가 발생했습니다:', e instanceof Error ? e : new Error(String(e)), { component: 'useTables' });
      toast.error('좌석 자동 배정 중 오류가 발생했습니다.');
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [maxSeatsSetting]);

  const moveSeat = useCallback(async (
    participantId: string,
    from: { tableId: string; seatIndex: number },
    to: { tableId: string; seatIndex: number }
  ) => {
    if (from.tableId === to.tableId && from.seatIndex === to.seatIndex) return;

    try {
        await runTransaction(db, async (transaction) => {
            if (from.tableId === to.tableId) {
                // Same table move
                const tableRef = doc(db, 'tables', from.tableId);
                const tableSnap = await transaction.get(tableRef);
                if (!tableSnap.exists()) {
                  logger.error('Table not found during seat move', new Error('Table not found'), { component: 'useTables' });
                  toast.error('테이블을 찾을 수 없습니다.');
                  return;
                }

                const seats = [...tableSnap.data().seats];
                if (seats[to.seatIndex] !== null) {
                  logger.error('Target seat already occupied', new Error('Seat occupied'), { component: 'useTables' });
                  toast.error('해당 좌석에 이미 참가자가 있습니다.');
                  return;
                }
                
                seats[to.seatIndex] = participantId;
                seats[from.seatIndex] = null;
                
                transaction.update(tableRef, { seats });

            } else {
                // Different table move
                const fromTableRef = doc(db, 'tables', from.tableId);
                const toTableRef = doc(db, 'tables', to.tableId);

                const [fromTableSnap, toTableSnap] = await Promise.all([
                    transaction.get(fromTableRef),
                    transaction.get(toTableRef)
                ]);

                if (!fromTableSnap.exists() || !toTableSnap.exists()) {
                    logger.error('Table information not found during cross-table move', new Error('Table not found'), { component: 'useTables' });
                    toast.error('테이블 정보를 찾을 수 없습니다.');
                    return;
                }
                
                const fromSeats = [...fromTableSnap.data().seats];
                const toSeats = [...toTableSnap.data().seats];

                if (toSeats[to.seatIndex] !== null) {
                  logger.error('Target seat already occupied in cross-table move', new Error('Seat occupied'), { component: 'useTables' });
                  toast.error('해당 좌석에 이미 참가자가 있습니다.');
                  return;
                }

                fromSeats[from.seatIndex] = null;
                toSeats[to.seatIndex] = participantId;
                
                transaction.update(fromTableRef, { seats: fromSeats });
                transaction.update(toTableRef, { seats: toSeats });
            }
        });
        const fromTable = tables.find(t=>t.id === from.tableId);
        const toTable = tables.find(t=>t.id === to.tableId);
        logAction('seat_moved', { participantId, from: `${fromTable?.tableNumber}-${from.seatIndex+1}`, to: `${toTable?.tableNumber}-${to.seatIndex+1}` });

    } catch (e) {
        logger.error('An error occurred while moving the seat:', e instanceof Error ? e : new Error(String(e)), { component: 'useTables' });
        setError(e as Error);
        toast.error('좌석 이동 중 오류가 발생했습니다.');
    }
  }, [tables]);

  const bustOutParticipant = useCallback(async (participantId: string) => {
    try {
      await runTransaction(db, async (transaction) => {
        const participantRef = doc(db, 'participants', participantId);
        transaction.update(participantRef, { status: 'busted' });

        const table = tables.find(t => (t.seats || []).includes(participantId));
        if (table) {
          const tableRef = doc(db, 'tables', table.id);
          const newSeats = (table.seats || []).map(seat => seat === participantId ? null : seat);
          transaction.update(tableRef, { seats: newSeats });
        }
      });
      logAction('participant_busted', { participantId });
    } catch (e) {
      logger.error('탈락 처리 중 오류 발생:', e instanceof Error ? e : new Error(String(e)), { component: 'useTables' });
      setError(e as Error);
      toast.error('참가자 탈락 처리 중 오류가 발생했습니다.');
    }
  }, [tables]);

  const updateTableMaxSeats = useCallback(async (tableId: string, newMaxSeats: number, getParticipantName: (id: string) => string) => {
    try {
      await runTransaction(db, async (transaction) => {
        const tableRef = doc(db, 'tables', tableId);
        const tableSnap = await transaction.get(tableRef);
        if (!tableSnap.exists()) {
          logger.error('Table not found for max seats update', new Error('Table not found'), { component: 'useTables' });
          toast.error('테이블을 찾을 수 없습니다.');
          return;
        }

        const table = tableSnap.data() as Table;
        const currentSeats = table.seats || [];
        const currentMaxSeats = currentSeats.length;

        if (newMaxSeats === currentMaxSeats) return;

        if (newMaxSeats < currentMaxSeats) {
          const seatsToRemove = currentSeats.slice(newMaxSeats);
          const occupiedSeatsToRemove = seatsToRemove.map((pId, i) => ({ pId, seatNum: newMaxSeats + i + 1 })).filter(s => s.pId !== null);

          if (occupiedSeatsToRemove.length > 0) {
            const playerInfo = occupiedSeatsToRemove.map(s => `${s.seatNum}번(${getParticipantName(s.pId!)})`).join(', ');
            logger.error('Cannot reduce seats with occupied positions', new Error('Occupied seats'), { component: 'useTables' });
            toast.error(`좌석 수를 줄이려면 먼저 다음 플레이어를 이동시켜야 합니다: ${playerInfo}`);
            return;
          }
        }

        const newSeats = Array(newMaxSeats).fill(null);
        for(let i=0; i < Math.min(currentMaxSeats, newMaxSeats); i++) {
          newSeats[i] = currentSeats[i];
        }

        transaction.update(tableRef, { seats: newSeats });
      });

      logAction('max_seats_updated', { tableId, newMaxSeats });
    } catch (e) {
      logger.error('최대 좌석 수 변경 중 오류 발생:', e instanceof Error ? e : new Error(String(e)), { component: 'useTables' });
      setError(e as Error);
      toast.error('최대 좌석 수 변경 중 오류가 발생했습니다.');
    }
  }, []);

  const autoBalanceByChips = useCallback(async (participants: Participant[]) => {
    // 활성 참가자만 필터링
    const activeParticipants = participants.filter(p => p.status === 'active');
    if (activeParticipants.length === 0) {
      toast.warning("칩 균형 재배치할 활성 참가자가 없습니다.");
      return;
    }

    setLoading(true);
    try {
      const batch = writeBatch(db);
      const tablesSnapshot = await getDocs(tablesCollection);

      const openTables: Table[] = tablesSnapshot.docs
        .map(d => ({id: d.id, ...d.data()} as Table))
        .filter(t => t.status === 'open')
        .sort((a, b) => a.tableNumber - b.tableNumber);

      if (openTables.length === 0) {
        logger.error('No open tables for chip balance', new Error('No open tables'), { component: 'useTables' });
        toast.error('칩 균형 재배치를 할 수 있는 활성화된 테이블이 없습니다.');
        return;
      }

      const totalSeats = openTables.reduce((sum, table) => sum + (table.seats?.length || maxSeatsSetting), 0);
      if (activeParticipants.length > totalSeats) {
        logger.error('Too many active participants for chip balance', new Error(`Participants: ${activeParticipants.length}, Seats: ${totalSeats}`), { component: 'useTables' });
        toast.error(`활성 참가자 수(${activeParticipants.length}명)가 전체 좌석 수(${totalSeats}석)보다 많아 배정할 수 없습니다.`);
        return;
      }

      // 참가자를 칩 수 기준으로 정렬 (내림차순)
      const sortedParticipants = [...activeParticipants].sort((a, b) => (b.chips || 0) - (a.chips || 0));

      const totalTables = openTables.length;


      // 테이블 상태 초기화
      interface TableState {
        id: string;
        tableNumber: number;
        participants: string[];
        totalChips: number;
        maxSeats: number;
        chipGroups: { top: number; middle: number; bottom: number }; // 각 그룹별 인원수 추적
      }

      const tableStates: TableState[] = openTables.map(table => ({
        id: table.id,
        tableNumber: table.tableNumber,
        participants: [],
        totalChips: 0,
        maxSeats: table.seats?.length || maxSeatsSetting,
        chipGroups: { top: 0, middle: 0, bottom: 0 }
      }));



      // 테이블 인덱스를 랜덤으로 섞기 (예: [0,1,2,3,4] → [2,4,0,3,1])
      const randomTableIndices = shuffleArray(tableStates.map((_, idx) => idx));

      // 전체 참가자를 칩 내림차순으로 정렬 (이미 sortedParticipants에 정렬되어 있음)
      // 스네이크 드래프트로 한 번에 배치 - 자동으로 인원 균형 보장

      let tableIndex = 0;
      let forward = true;

      for (let i = 0; i < sortedParticipants.length; i++) {
        const participant = sortedParticipants[i];
        if (!participant) continue;

        // 랜덤 테이블 순서에 따라 실제 테이블 선택
        const actualTableIndex = randomTableIndices[tableIndex];
        if (actualTableIndex === undefined) continue;

        const table = tableStates[actualTableIndex];
        if (!table) continue;

        table.participants.push(participant.id);
        table.totalChips += participant.chips || 0;

        // 그룹별 카운터 (상위 25%, 중간 50%, 하위 25%)
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


        // 스네이크 이동 로직 (랜덤 순서 배열 내에서 이동)
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
        const table = openTables.find(t => t.id === tableState.id);
        if (!table) continue;

        const seatCount = table.seats?.length || maxSeatsSetting;
        const newSeats: (string | null)[] = Array(seatCount).fill(null);

        // 랜덤하게 좌석 배치
        const availableSeatIndexes = Array.from({ length: seatCount }, (_, i) => i);
        const shuffledIndexes = shuffleArray(availableSeatIndexes);

        tableState.participants.forEach((participantId, i) => {
          if (i < shuffledIndexes.length) {
            const seatIndex = shuffledIndexes[i];
            if (seatIndex !== undefined) {
              newSeats[seatIndex] = participantId;
            }
          }
        });

        const tableRef = doc(db, 'tables', table.id);
        batch.update(tableRef, { seats: newSeats });
      }
      
      await batch.commit();
      
      // Smart Balance 결과 로깅
      const balanceInfo = tableStates.map(state => ({
        tableNumber: state.tableNumber,
        playerCount: state.participants.length,
        totalChips: state.totalChips,
        chipGroups: state.chipGroups,
        avgChipsPerPlayer: state.participants.length > 0 ? Math.round(state.totalChips / state.participants.length) : 0
      }));

      // 결과 통계 계산
      const playerCounts = balanceInfo.map(t => t.playerCount);
      const maxPlayers = Math.max(...playerCounts);
      const minPlayers = Math.min(...playerCounts);

      // Smart Balance 균형 결과 자세히 로깅
      // 균형 검증
      const playerCountDiff = maxPlayers - minPlayers;
      const playerCountBalanced = playerCountDiff <= 1;

      // 사용자 피드백 메시지
      if (!playerCountBalanced) {
        toast.warning(`⚠️ 인원 불균형: 테이블 간 최대 ${playerCountDiff}명 차이가 발생했습니다.`);
      } else {
        toast.success(`✅ 칩 균형 재배치가 완료되었습니다.`);
      }

      logAction('seats_reassigned_with_balancing', {
        participantsCount: activeParticipants.length,
        tableCount: openTables.length
      });
    } catch (e) {
      const errorContext = {
        failedAction: 'auto_balance_by_chips',
        participantsCount: activeParticipants.length,
        errorMessage: e instanceof Error ? e.message : String(e),
      };
      logAction('action_failed', errorContext);
      logger.error('칩 균형 재배치 중 오류 발생:', e instanceof Error ? e : new Error(String(e)), { component: 'useTables' });
      toast.error('칩 균형 재배치 중 오류가 발생했습니다.');
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [maxSeatsSetting]);

  return { tables, setTables, loading, error, maxSeatsSetting, updateTableDetails, openNewTable, activateTable, closeTable, autoAssignSeats: rebalanceAndAssignAll, autoBalanceByChips, moveSeat, bustOutParticipant, updateTablePosition, updateTableOrder, updateTableMaxSeats };
};

export default useTables;
