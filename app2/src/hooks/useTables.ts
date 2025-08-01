import { collection, onSnapshot, doc, runTransaction, DocumentData, QueryDocumentSnapshot, getDocs, writeBatch, addDoc, updateDoc } from 'firebase/firestore';
import { logger } from '../utils/logger';
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
  assignedDealerId?: string | null;
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

export const useTables = () => {
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
    } catch (e) {
      logger.error('Error updating table details:', e instanceof Error ? e : new Error(String(e)), { component: 'useTables' });
      setError(e as Error);
      throw e;
    }
  }, []);

  const updateTablePosition = useCallback(async (tableId: string, position: { x: number; y: number }) => {
    const tableRef = doc(db, 'tables', tableId);
    try {
      await updateDoc(tableRef, { position });
    } catch (e) {
      logger.error('Error updating table position:', e instanceof Error ? e : new Error(String(e)), { component: 'useTables' });
      setError(e as Error);
      throw e;
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
        throw e;
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
      throw e;
    }
  }, []);
  
  const closeTable = useCallback(async (tableIdToClose: string): Promise<BalancingResult[]> => {
    setLoading(true);
    try {
      const balancingResult: BalancingResult[] = [];
      const movedParticipantsDetails: any[] = [];

      await runTransaction(db, async (transaction) => {
        const tablesSnapshot = await getDocs(tablesCollection);
        const allTables: Table[] = tablesSnapshot.docs
          .map(d => ({ id: d.id, ...d.data() } as Table));

        const tableToClose = allTables.find(t => t.id === tableIdToClose);
        if (!tableToClose) {
          throw new Error(`Table with id ${tableIdToClose} not found.`);
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
            throw new Error("참가자를 이동시킬 수 있는 활성화된 테이블이 없습니다.");
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
             if(alternativeTables.length === 0) throw new Error(`Balancing failed: No seats available.`);
             
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
      });

      return balancingResult;
    } catch (e) {
      const errorContext = {
        failedAction: 'close_table',
        tableId: tableIdToClose,
        errorMessage: e instanceof Error ? e.message : String(e),
      };
      logAction('action_failed', errorContext);
      logger.error('Error closing table:', e instanceof Error ? e : new Error(String(e)), { component: 'useTables' });
      setError(e as Error);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [maxSeatsSetting]);
  
  const rebalanceAndAssignAll = useCallback(async (participants: Participant[]) => {
    if (participants.length === 0) {
        alert("배정할 참가자가 없습니다.");
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
        throw new Error("좌석을 배정할 수 있는 활성화된 테이블이 없습니다.");
      }

      const totalSeats = openTables.reduce((sum, table) => sum + (table.seats?.length || maxSeatsSetting), 0);
      if (participants.length > totalSeats) {
        throw new Error(`참가자 수(${participants.length})가 전체 좌석 수(${totalSeats})보다 많아 배정할 수 없습니다.`);
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
      logger.debug('좌석 밸런싱 재배정이 성공적으로 완료되었습니다.', { component: 'useTables' });
      logAction('seats_reassigned_with_balancing', { participantsCount: participants.length, tableCount: openTables.length });
    } catch (e) {
      const errorContext = {
        failedAction: 'rebalance_and_assign_all',
        participantsCount: participants.length,
        errorMessage: e instanceof Error ? e.message : String(e),
      };
      logAction('action_failed', errorContext);
      logger.error('좌석 자동 재배정 중 오류가 발생했습니다:', e instanceof Error ? e : new Error(String(e)), { component: 'useTables' });
      alert(`오류 발생: ${e instanceof Error ? e.message : String(e)}`);
      setError(e as Error);
      throw e;
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
                if (!tableSnap.exists()) throw new Error("Table not found.");
                
                const seats = [...tableSnap.data().seats];
                if (seats[to.seatIndex] !== null) {
                  // This case should be prevented by UI (canDrop in Seat.tsx)
                  // but as a safeguard:
                  throw new Error("Target seat is already occupied.");
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
                    throw new Error("Table information could not be found.");
                }
                
                const fromSeats = [...fromTableSnap.data().seats];
                const toSeats = [...toTableSnap.data().seats];

                if (toSeats[to.seatIndex] !== null) {
                  // This case should be prevented by UI (canDrop in Seat.tsx)
                  throw new Error("Target seat is already occupied.");
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
        throw e;
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
    }
  }, [tables]);

  const updateTableMaxSeats = useCallback(async (tableId: string, newMaxSeats: number, getParticipantName: (id: string) => string) => {
    try {
      await runTransaction(db, async (transaction) => {
        const tableRef = doc(db, 'tables', tableId);
        const tableSnap = await transaction.get(tableRef);
        if (!tableSnap.exists()) {
          throw new Error("테이블을 찾을 수 없습니다.");
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
            throw new Error(`좌석 수를 줄이려면 먼저 다음 플레이어를 이동시켜야 합니다: ${playerInfo}`);
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
      throw e; // Rethrow to be caught by the UI
    }
  }, []);

  return { tables, setTables, loading, error, maxSeatsSetting, updateTableDetails, openNewTable, activateTable, closeTable, autoAssignSeats: rebalanceAndAssignAll, moveSeat, bustOutParticipant, updateTablePosition, updateTableOrder, updateTableMaxSeats };
};

export default useTables;
