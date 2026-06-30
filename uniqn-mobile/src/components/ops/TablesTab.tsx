/**
 * ops 1b — TABLES 탭.
 * 테이블 목록(FlashList) → 테이블 선택 시 좌석 그리드 상세(master/detail).
 * 좌석 액션: 배정(빈 좌석→미착석 참가자) / 이동(점유→같은 테이블 빈 좌석) / 비우기.
 * 테이블 액션: lock(none/locked/feature) / priority / status(open/standby/closed).
 * + 테이블 추가 폼, Redraw 미리보기 모달.
 */
import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { AppFlashList } from '@/components/ui/AppFlashList';
import { SelectBottomSheet } from '@/components/ui';
import {
  useOpsTables,
  useOpsSeats,
  useOpsParticipants,
  useAddTable,
  useSetTableLock,
  useSetTablePriority,
  useCloseTable,
  useAssignSeat,
  useMoveSeat,
  useFreeSeat,
} from '@/hooks/ops';
import type { OpsTable, OpsSeat, OpsTableLockType, OpsTableStatus } from '@/types/ops';
import { AddTableForm, type AddTableInput } from './AddTableForm';
import { SeatGrid } from './SeatGrid';
import { TableRow } from './TableRow';
import { RedrawModal } from './RedrawModal';

const LOCK_LABEL: Record<OpsTableLockType, string> = {
  none: '없음',
  locked: '잠금',
  feature: '피처',
};
const STATUS_BUTTONS: { value: OpsTableStatus; label: string }[] = [
  { value: 'open', label: '오픈' },
  { value: 'standby', label: '대기' },
  { value: 'closed', label: '마감' },
];
const SEATABLE = new Set<string>(['active', 'checked_in']);
const PRIORITY_OPTIONS = [
  { label: '없음', value: 'none' },
  { label: '1', value: '1' },
  { label: '2', value: '2' },
  { label: '3', value: '3' },
  { label: '4', value: '4' },
  { label: '5', value: '5' },
];

interface TablesTabProps {
  tournamentId: string;
}

export function TablesTab({ tournamentId }: TablesTabProps) {
  const { tables, isLoading } = useOpsTables(tournamentId);
  const { seats } = useOpsSeats(tournamentId);
  const { participants } = useOpsParticipants(tournamentId);

  const addTableMut = useAddTable(tournamentId);
  const lockMut = useSetTableLock(tournamentId);
  const priorityMut = useSetTablePriority(tournamentId);
  const statusMut = useCloseTable(tournamentId);
  const assignMut = useAssignSeat(tournamentId);
  const moveMut = useMoveSeat(tournamentId);
  const freeMut = useFreeSeat(tournamentId);

  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showRedraw, setShowRedraw] = useState(false);
  const [showRedrawPicker, setShowRedrawPicker] = useState(false);
  const [redrawMode, setRedrawMode] = useState<'waitlist_fill' | 'random_draw' | 'chip_draft'>(
    'waitlist_fill'
  );
  const [seatMenuSeat, setSeatMenuSeat] = useState<OpsSeat | null>(null);
  const [assignTargetSeat, setAssignTargetSeat] = useState<OpsSeat | null>(null);
  const [moveFromSeat, setMoveFromSeat] = useState<OpsSeat | null>(null);
  const [lockPickerOpen, setLockPickerOpen] = useState(false);
  const [priorityPickerOpen, setPriorityPickerOpen] = useState(false);

  const selectedTable = tables.find((t) => t.id === selectedTableId) ?? null;

  // 파생: 테이블별 좌석 / 참가자 이름 / 미착석 참가자.
  const seatsByTable = new Map<string, OpsSeat[]>();
  for (const s of seats) {
    const arr = seatsByTable.get(s.tableId);
    if (arr) arr.push(s);
    else seatsByTable.set(s.tableId, [s]);
  }
  const participantNameById = new Map(participants.map((p) => [p.id, p.name] as const));
  const seatedIds = new Set(
    seats.filter((s) => s.participantId).map((s) => s.participantId as string)
  );
  const unseated = participants.filter((p) => SEATABLE.has(p.status) && !seatedIds.has(p.id));

  const openTable = (id: string) => {
    setSelectedTableId(id);
    setMoveFromSeat(null);
  };
  const backToList = () => {
    setSelectedTableId(null);
    setMoveFromSeat(null);
  };

  const onSeatPress = (seat: OpsSeat) => {
    if (moveFromSeat) {
      if (!seat.participantId && seat.id !== moveFromSeat.id) {
        moveMut.mutate({ fromSeatId: moveFromSeat.id, toSeatId: seat.id });
        setMoveFromSeat(null);
      }
      return;
    }
    if (seat.participantId) setSeatMenuSeat(seat);
    else setAssignTargetSeat(seat);
  };

  const submitAddTable = (input: AddTableInput) => {
    addTableMut.mutate(input, { onSuccess: () => setShowAddForm(false) });
  };

  // 시트(목록/상세 양쪽에서 동일하게 렌더 — 상태가 falsy 면 미표시).
  const sheets = (
    <>
      <SelectBottomSheet
        visible={!!seatMenuSeat}
        onClose={() => setSeatMenuSeat(null)}
        title={
          seatMenuSeat?.participantId ? participantNameById.get(seatMenuSeat.participantId) : '좌석'
        }
        options={[
          { label: '이동', value: 'move' },
          { label: '비우기', value: 'free', destructive: true },
        ]}
        onSelect={(v) => {
          const seat = seatMenuSeat;
          if (!seat) return;
          if (v === 'move') setMoveFromSeat(seat);
          else if (v === 'free') freeMut.mutate(seat.id);
        }}
      />

      <SelectBottomSheet
        visible={!!assignTargetSeat}
        onClose={() => setAssignTargetSeat(null)}
        title="참가자 배정"
        options={
          unseated.length > 0
            ? unseated.map((p) => ({ label: `#${p.entryNumber} ${p.name}`, value: p.id }))
            : [{ label: '착석 대기 참가자가 없습니다', value: '__none', disabled: true }]
        }
        onSelect={(participantId) => {
          const seat = assignTargetSeat;
          if (!seat || participantId === '__none') return;
          assignMut.mutate({ seatId: seat.id, participantId });
        }}
      />

      {selectedTable && (
        <SelectBottomSheet
          visible={lockPickerOpen}
          onClose={() => setLockPickerOpen(false)}
          title="테이블 잠금"
          options={[
            { label: '없음', value: 'none' },
            { label: '잠금', value: 'locked' },
            { label: '피처', value: 'feature' },
          ]}
          onSelect={(v) =>
            lockMut.mutate({ tableId: selectedTable.id, lockType: v as OpsTableLockType })
          }
        />
      )}

      {selectedTable && (
        <SelectBottomSheet
          visible={priorityPickerOpen}
          onClose={() => setPriorityPickerOpen(false)}
          title="우선순위"
          options={PRIORITY_OPTIONS}
          onSelect={(v) =>
            priorityMut.mutate({
              tableId: selectedTable.id,
              priority: v === 'none' ? null : Number(v),
            })
          }
        />
      )}

      {/* 배정 모드 선택 피커(빈자리채움·랜덤·칩드래프트) */}
      <SelectBottomSheet
        visible={showRedrawPicker}
        onClose={() => setShowRedrawPicker(false)}
        title="배정 방식 선택"
        options={[
          { label: '빈자리 채움 (대기 → 빈 좌석)', value: 'waitlist_fill' },
          { label: '랜덤 전원 재배치', value: 'random_draw' },
          { label: '칩 드래프트 전원 재배치', value: 'chip_draft' },
        ]}
        onSelect={(v) => {
          setRedrawMode(v as 'waitlist_fill' | 'random_draw' | 'chip_draft');
          setShowRedraw(true);
        }}
      />

      <RedrawModal
        tournamentId={tournamentId}
        visible={showRedraw}
        onClose={() => setShowRedraw(false)}
        mode={redrawMode}
      />
    </>
  );

  // ── 상세 뷰(테이블 선택 시) ──────────────────────────────────────────────
  if (selectedTable) {
    const tableSeats = seatsByTable.get(selectedTable.id) ?? [];
    return (
      <View className="flex-1">
        <View className="flex-row items-center justify-between px-4 py-2">
          <Pressable onPress={backToList} accessibilityRole="button" className="active:opacity-70">
            <Text className="text-sm text-primary-600 dark:text-primary-400">← 목록</Text>
          </Pressable>
          <Text
            numberOfLines={1}
            className="flex-1 px-2 text-center font-sans-semibold text-content-primary dark:text-off-white"
          >
            {selectedTable.name?.trim() ? selectedTable.name : `테이블 ${selectedTable.tableNo}`}
          </Text>
          <View className="w-12" />
        </View>

        <View className="mx-4 mb-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => setLockPickerOpen(true)}
              accessibilityRole="button"
              className="flex-1 rounded-md bg-gray-100 px-3 py-2 active:opacity-70 dark:bg-gray-800"
            >
              <Text className="text-xs text-secondary-500 dark:text-secondary-400">잠금</Text>
              <Text className="font-sans-semibold text-content-primary dark:text-off-white">
                {LOCK_LABEL[selectedTable.lockType]}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setPriorityPickerOpen(true)}
              accessibilityRole="button"
              className="flex-1 rounded-md bg-gray-100 px-3 py-2 active:opacity-70 dark:bg-gray-800"
            >
              <Text className="text-xs text-secondary-500 dark:text-secondary-400">우선순위</Text>
              <Text className="font-sans-semibold text-content-primary dark:text-off-white">
                {selectedTable.priority ?? '없음'}
              </Text>
            </Pressable>
          </View>
          <View className="mt-2 flex-row gap-2">
            {STATUS_BUTTONS.map((b) => (
              <Pressable
                key={b.value}
                onPress={() => statusMut.mutate({ tableId: selectedTable.id, status: b.value })}
                accessibilityRole="button"
                className={`flex-1 items-center rounded-md py-2 active:opacity-70 ${
                  selectedTable.status === b.value
                    ? 'bg-primary-600'
                    : 'bg-gray-100 dark:bg-gray-800'
                }`}
              >
                <Text
                  className={`text-sm ${
                    selectedTable.status === b.value
                      ? 'font-sans-semibold text-white'
                      : 'text-content-primary'
                  }`}
                >
                  {b.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {moveFromSeat && (
          <View className="mx-4 mb-2 flex-row items-center justify-between rounded-md bg-gray-100 px-3 py-2 dark:bg-gray-800">
            <Text className="flex-1 text-sm text-content-primary dark:text-off-white">
              이동:{' '}
              {moveFromSeat.participantId
                ? participantNameById.get(moveFromSeat.participantId)
                : ''}{' '}
              → 빈 좌석을 선택하세요
            </Text>
            <Pressable
              onPress={() => setMoveFromSeat(null)}
              accessibilityRole="button"
              className="active:opacity-70"
            >
              <Text className="text-sm text-primary-600 dark:text-primary-400">취소</Text>
            </Pressable>
          </View>
        )}

        <ScrollView className="flex-1 px-3" contentContainerStyle={{ paddingBottom: 24 }}>
          <SeatGrid
            seats={tableSeats}
            participantNameById={participantNameById}
            moveMode={!!moveFromSeat}
            moveFromSeatId={moveFromSeat?.id ?? null}
            onSeatPress={onSeatPress}
          />
        </ScrollView>

        {sheets}
      </View>
    );
  }

  // ── 목록 뷰 ──────────────────────────────────────────────────────────────
  return (
    <View className="flex-1">
      <View className="flex-row items-center justify-between px-4 py-2">
        <Pressable
          onPress={() => setShowRedrawPicker(true)}
          accessibilityRole="button"
          className="min-h-[44px] items-center justify-center rounded-md bg-gray-100 px-3 active:opacity-70 dark:bg-gray-800"
        >
          <Text className="font-sans-semibold text-sm text-content-primary dark:text-off-white">
            Redraw
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setShowAddForm((s) => !s)}
          accessibilityRole="button"
          className="rounded-md bg-primary-600 px-3 py-1.5 active:opacity-70"
        >
          <Text className="font-sans-semibold text-sm text-white">
            {showAddForm ? '닫기' : '+ 테이블 추가'}
          </Text>
        </Pressable>
      </View>

      {showAddForm && (
        <View className="mx-4 mb-2">
          <AddTableForm isPending={addTableMut.isPending} onSubmit={submitAddTable} />
        </View>
      )}

      <AppFlashList
        data={tables}
        keyExtractor={(t: OpsTable) => t.id}
        estimatedItemSize={72}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        renderItem={({ item }: { item: OpsTable }) => {
          const tableSeats = seatsByTable.get(item.id) ?? [];
          const filled = tableSeats.filter((s) => s.participantId).length;
          return (
            <TableRow
              table={item}
              seatCount={tableSeats.length}
              filled={filled}
              onPress={() => openTable(item.id)}
            />
          );
        }}
        ListEmptyComponent={
          <View className="items-center px-6 py-10">
            <Text className="text-secondary-500 dark:text-secondary-400">
              {isLoading ? '불러오는 중…' : '아직 테이블이 없습니다.'}
            </Text>
            {!isLoading && (
              <Text className="mt-2 text-center text-xs text-secondary-500 dark:text-secondary-400">
                {
                  "참가자 등록 전 테이블을 먼저 추가하세요. 테이블이 없으면 워크인 등록이 '착석 대기'로 적체되고 PLAYING 통계에 잡히지 않습니다."
                }
              </Text>
            )}
          </View>
        }
      />

      {sheets}
    </View>
  );
}

export default TablesTab;
