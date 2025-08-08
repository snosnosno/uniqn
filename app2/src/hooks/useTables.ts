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

  const autoBalanceByChips = useCallback(async (participants: Participant[]) => {
    // 활성 참가자만 필터링
    const activeParticipants = participants.filter(p => p.status === 'active');
    if (activeParticipants.length === 0) {
      alert("칩 균형 재배치할 활성 참가자가 없습니다.");
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
        throw new Error("칩 균형 재배치를 할 수 있는 활성화된 테이블이 없습니다.");
      }

      const totalSeats = openTables.reduce((sum, table) => sum + (table.seats?.length || maxSeatsSetting), 0);
      if (activeParticipants.length > totalSeats) {
        throw new Error(`활성 참가자 수(${activeParticipants.length})가 전체 좌석 수(${totalSeats})보다 많아 배정할 수 없습니다.`);
      }

      // 참가자를 칩 수 기준으로 정렬 (내림차순)
      const sortedParticipants = [...activeParticipants].sort((a, b) => (b.chips || 0) - (a.chips || 0));
      
      // 개선된 균형 알고리즘: 인원수와 칩 모두 균형 맞추기
      interface TableState {
        id: string;
        tableNumber: number;
        participants: string[];
        totalChips: number;
        maxSeats: number;
        targetCount?: number; // 목표 인원수 (라운드 로빈용)
      }
      
      const tableStates: TableState[] = openTables.map(table => ({
        id: table.id,
        tableNumber: table.tableNumber,
        participants: [],
        totalChips: 0,
        maxSeats: table.seats?.length || maxSeatsSetting
      }));

      // 전체 칩의 총합 계산
      const totalChips = sortedParticipants.reduce((sum, p) => sum + (p.chips || 0), 0);
      
      
      // Phase 1: 목표 칩에 최대한 가깝게 만드는 그리디 배치 (인원수 최대 1명 차이 유지)
      const totalPlayers = sortedParticipants.length;
      const totalTables = tableStates.length;
      const basePlayersPerTable = Math.floor(totalPlayers / totalTables);
      const tablesWithExtraPlayer = totalPlayers % totalTables;
      const targetChipsPerTable = Math.floor(totalChips / totalTables);
      
      // 각 테이블의 목표 인원수 설정
      tableStates.forEach((table, index) => {
        const targetCount = index < tablesWithExtraPlayer ? basePlayersPerTable + 1 : basePlayersPerTable;
        table.targetCount = Math.min(targetCount, table.maxSeats);
      });
      
      // 남은 참가자 풀 (아직 배치되지 않은 참가자들)
      const remainingParticipants = [...sortedParticipants];
      
      // 각 테이블에 대해 목표 칩에 가장 가까운 조합 찾기
      for (const table of tableStates) {
        if (!table.targetCount) continue;
        
        while (table.participants.length < table.targetCount && remainingParticipants.length > 0) {
          // 현재 테이블의 목표 칩과 남은 인원수 계산
          const remainingSeats = table.targetCount - table.participants.length;
          const targetRemainingChips = targetChipsPerTable - table.totalChips;
          const avgChipsPerSeat = remainingSeats > 0 ? targetRemainingChips / remainingSeats : 0;
          
          // 목표 평균에 가장 가까운 참가자 찾기
          let bestParticipantIndex = -1;
          let bestDifference = Infinity;
          
          for (let i = 0; i < remainingParticipants.length; i++) {
            const participant = remainingParticipants[i];
            if (!participant) continue;
            
            const chipDiff = Math.abs((participant.chips || 0) - avgChipsPerSeat);
            
            // 마지막 자리일 때는 목표 총합에 가장 가까운 참가자 선택
            if (remainingSeats === 1) {
              const finalDiff = Math.abs(table.totalChips + (participant.chips || 0) - targetChipsPerTable);
              if (finalDiff < bestDifference) {
                bestDifference = finalDiff;
                bestParticipantIndex = i;
              }
            } else {
              // 평균에 가까운 참가자 선택
              if (chipDiff < bestDifference) {
                bestDifference = chipDiff;
                bestParticipantIndex = i;
              }
            }
          }
          
          // 가장 적합한 참가자를 테이블에 배치
          if (bestParticipantIndex >= 0) {
            const participant = remainingParticipants.splice(bestParticipantIndex, 1)[0];
            if (participant) {
              table.participants.push(participant.id);
              table.totalChips += participant.chips || 0;
            }
          } else {
            // 적합한 참가자를 찾지 못한 경우 첫 번째 참가자 배치
            const participant = remainingParticipants.shift();
            if (participant) {
              table.participants.push(participant.id);
              table.totalChips += participant.chips || 0;
            }
          }
        }
      }
      
      // 인원수 차이 검증
      const currentPlayerCounts = tableStates.map(t => t.participants.length);
      const maxPlayerCount = Math.max(...currentPlayerCounts);
      const minPlayerCount = Math.min(...currentPlayerCounts);
      
      if (maxPlayerCount - minPlayerCount > 1) {
        logger.warn(`인원수 균형 실패: 최대 ${maxPlayerCount}명, 최소 ${minPlayerCount}명 (차이: ${maxPlayerCount - minPlayerCount})`, {
          component: 'useTables'
        });
      }

      // Phase 2: 적극적인 칩 균형 최적화 (인원수 차이 1명 제약 유지하면서)
      let iterations = 0;
      const maxIterations = 300; // 더 많은 반복 허용
      
      while (iterations < maxIterations) {
        const chipTotals = tableStates.map(t => t.totalChips);
        const avg = chipTotals.reduce((a, b) => a + b, 0) / chipTotals.length;
        const maxChips = Math.max(...chipTotals);
        const minChips = Math.min(...chipTotals);
        const chipRange = maxChips - minChips;
        
        // 칩 차이가 평균의 1% 미만 또는 200칩 미만이면 종료
        if (chipRange < avg * 0.01 || chipRange < 200) {
          break;
        }
        
        // 최적의 교환 찾기
        let bestOperation: { 
          type: 'swap' | 'move';
          fromTable: TableState; 
          toTable: TableState; 
          fromParticipantId: string;
          toParticipantId?: string;
        } | null = null;
        let bestImprovement = 0;
        
        // 전체 평균과의 차이 계산
        const avgChipsPerTable = totalChips / totalTables;
        
        // 1. 같은 인원수 테이블 간 교환 (Swap)
        for (let i = 0; i < tableStates.length; i++) {
          for (let j = i + 1; j < tableStates.length; j++) {
            const table1 = tableStates[i];
            const table2 = tableStates[j];
            
            if (!table1 || !table2) continue;
            
            // 같은 인원수일 때만 교환 가능
            if (table1.participants.length !== table2.participants.length) continue;
            
            const chipDiff = Math.abs(table1.totalChips - table2.totalChips);
            if (chipDiff < 100) continue; // 100칩 이상 차이날 때만 교환
            
            const [richTable, poorTable] = table1.totalChips > table2.totalChips 
              ? [table1, table2] 
              : [table2, table1];
            
            for (const richParticipantId of richTable.participants) {
              const richParticipant = activeParticipants.find(p => p.id === richParticipantId);
              if (!richParticipant) continue;
              
              for (const poorParticipantId of poorTable.participants) {
                const poorParticipant = activeParticipants.find(p => p.id === poorParticipantId);
                if (!poorParticipant) continue;
                
                const chipDifference = (richParticipant.chips || 0) - (poorParticipant.chips || 0);
                if (chipDifference <= 0) continue;
                
                // 교환 후 평균과의 차이 개선 정도 계산
                const newRichTotal = richTable.totalChips - (richParticipant.chips || 0) + (poorParticipant.chips || 0);
                const newPoorTotal = poorTable.totalChips - (poorParticipant.chips || 0) + (richParticipant.chips || 0);
                
                const currentDeviation = Math.abs(richTable.totalChips - avgChipsPerTable) + Math.abs(poorTable.totalChips - avgChipsPerTable);
                const newDeviation = Math.abs(newRichTotal - avgChipsPerTable) + Math.abs(newPoorTotal - avgChipsPerTable);
                const improvement = currentDeviation - newDeviation;
                
                if (improvement > bestImprovement) {
                  bestImprovement = improvement;
                  bestOperation = {
                    type: 'swap',
                    fromTable: richTable,
                    toTable: poorTable,
                    fromParticipantId: richParticipantId,
                    toParticipantId: poorParticipantId
                  };
                }
              }
            }
          }
        }
        
        // 2. 인원수가 다른 테이블 간 단방향 이동 (Move) - 제한적으로 허용
        // 인원이 많은 테이블에서 적은 테이블로만 이동 가능
        for (let i = 0; i < tableStates.length; i++) {
          for (let j = 0; j < tableStates.length; j++) {
            if (i === j) continue;
            
            const fromTable = tableStates[i];
            const toTable = tableStates[j];
            
            if (!fromTable || !toTable) continue;
            
            // 인원수 제약 체크: from이 to보다 1명 많아야 함
            if (fromTable.participants.length !== toTable.participants.length + 1) continue;
            
            // 칩이 많은 테이블에서 적은 테이블로 이동하는 것이 유리한 경우
            if (fromTable.totalChips <= toTable.totalChips) continue;
            
            // 이동할 참가자 찾기 (이동 후 두 테이블의 칩이 평균에 가까워지는 참가자)
            for (const participantId of fromTable.participants) {
              const participant = activeParticipants.find(p => p.id === participantId);
              if (!participant) continue;
              
              const participantChips = participant.chips || 0;
              
              // 이동 후 칩 총합
              const newFromTotal = fromTable.totalChips - participantChips;
              const newToTotal = toTable.totalChips + participantChips;
              
              // 이동 후 평균과의 차이 개선 정도
              const currentDeviation = Math.abs(fromTable.totalChips - avgChipsPerTable) + Math.abs(toTable.totalChips - avgChipsPerTable);
              const newDeviation = Math.abs(newFromTotal - avgChipsPerTable) + Math.abs(newToTotal - avgChipsPerTable);
              const improvement = currentDeviation - newDeviation;
              
              if (improvement > bestImprovement * 0.9) { // Move도 거의 동등하게 고려
                bestImprovement = improvement;
                bestOperation = {
                  type: 'move',
                  fromTable,
                  toTable,
                  fromParticipantId: participantId
                };
              }
            }
          }
        }
        
        // 최적의 작업 실행 (아주 작은 개선도 허용)
        if (bestOperation && bestImprovement > 10) {
          const operation = bestOperation; // TypeScript null check를 위한 변수
          
          if (operation.type === 'swap' && operation.toParticipantId) {
            // Swap 실행
            const fromParticipant = activeParticipants.find(p => p.id === operation.fromParticipantId);
            const toParticipant = activeParticipants.find(p => p.id === operation.toParticipantId);
            
            if (fromParticipant && toParticipant) {
              operation.fromTable.participants = operation.fromTable.participants.filter(id => id !== operation.fromParticipantId);
              operation.fromTable.participants.push(operation.toParticipantId);
              operation.fromTable.totalChips = operation.fromTable.totalChips - (fromParticipant.chips || 0) + (toParticipant.chips || 0);
              
              operation.toTable.participants = operation.toTable.participants.filter(id => id !== operation.toParticipantId);
              operation.toTable.participants.push(operation.fromParticipantId);
              operation.toTable.totalChips = operation.toTable.totalChips - (toParticipant.chips || 0) + (fromParticipant.chips || 0);
            }
          } else if (operation.type === 'move') {
            // Move 실행
            const participant = activeParticipants.find(p => p.id === operation.fromParticipantId);
            
            if (participant) {
              operation.fromTable.participants = operation.fromTable.participants.filter(id => id !== operation.fromParticipantId);
              operation.fromTable.totalChips -= participant.chips || 0;
              
              operation.toTable.participants.push(operation.fromParticipantId);
              operation.toTable.totalChips += participant.chips || 0;
            }
          }
        } else {
          break; // 더 이상 의미있는 개선이 없음
        }
        
        iterations++;
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
      
      // 칩 균형 결과 로깅
      const balanceInfo = tableStates.map(state => ({
        tableNumber: state.tableNumber,
        playerCount: state.participants.length,
        totalChips: state.totalChips
      }));
      
      // 결과 통계 계산
      const chipValues = balanceInfo.map(t => t.totalChips);
      const playerCounts = balanceInfo.map(t => t.playerCount);
      const avgChips = chipValues.reduce((a, b) => a + b, 0) / chipValues.length;
      const maxChips = Math.max(...chipValues);
      const minChips = Math.min(...chipValues);
      const chipRange = maxChips - minChips;
      const maxPlayers = Math.max(...playerCounts);
      const minPlayers = Math.min(...playerCounts);
      
      // 균형 결과 자세히 로깅
      const chipPercentDiff = avgChips > 0 ? (chipRange / avgChips * 100).toFixed(1) : '0';
      logger.info(`칩 균형 재배치 완료`, { 
        component: 'useTables'
      });
      logger.info(`- 칩 평균: ${avgChips.toLocaleString()}칩`, { 
        component: 'useTables'
      });
      logger.info(`- 칩 범위: ${minChips.toLocaleString()}~${maxChips.toLocaleString()} (차이: ${chipRange.toLocaleString()}칩, ${chipPercentDiff}%)`, { 
        component: 'useTables'
      });
      logger.info(`- 인원 분포: ${minPlayers}~${maxPlayers}명 (차이: ${maxPlayers - minPlayers}명)`, { 
        component: 'useTables'
      });
      
      // 각 테이블별 상세 정보
      balanceInfo.forEach(info => {
        const diffFromAvg = info.totalChips - avgChips;
        const percentDiff = avgChips > 0 ? (diffFromAvg / avgChips * 100).toFixed(1) : '0';
        const sign = diffFromAvg >= 0 ? '+' : '';
        logger.debug(`  테이블 ${info.tableNumber}: ${info.playerCount}명, ${info.totalChips.toLocaleString()}칩 (평균대비 ${sign}${diffFromAvg.toLocaleString()}칩, ${sign}${percentDiff}%)`, {
          component: 'useTables'
        });
      });
      
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
      alert(`오류 발생: ${e instanceof Error ? e.message : String(e)}`);
      setError(e as Error);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [maxSeatsSetting]);

  return { tables, setTables, loading, error, maxSeatsSetting, updateTableDetails, openNewTable, activateTable, closeTable, autoAssignSeats: rebalanceAndAssignAll, autoBalanceByChips, moveSeat, bustOutParticipant, updateTablePosition, updateTableOrder, updateTableMaxSeats };
};

export default useTables;
