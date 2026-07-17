/**
 * ops 1e — STAFF 탭(7번째 세그먼트). 스펙 §4.2 구성(위→아래):
 *   1. 연결 공고 카드(owner 전용 연결/변경/해제, PostingPickerSheet)
 *   2. import CTA(확정 스태프 가져오기 — event_date 기본/"전체 기간" 토글, 확인 다이얼로그)
 *   3. 로스터 리스트(AppFlashList, staleness 캡션, 행 탭→액션 시트: 테이블 지정/삭제)
 *   4. 수동 추가(StaffAddSheet)
 *
 * 권한 메모:
 * - 공고 연결/변경/해제는 owner-only(ops_set_tournament_posting RPC 게이트, §2.1) — UI 도 owner 에게만 노출.
 * - import/행 액션(테이블 지정/삭제)/수동 추가는 is_ops_member 범위(§2.2·§2.4·§2.5) — 뷰어 전원에 노출,
 *   실제 권한 판정은 서버(RPC)가 최종 소스이며 거부 시 토스트로 표면화된다.
 * - 공고 picker 소스(useMyJobPostings)는 활성 워크스페이스 스코프라 워크스페이스가 없으면 연결 버튼을 숨긴다.
 *
 * "테이블 지정" 행 액션은 Task 7 DealerPickerSheet(테이블→스태프 선택) 를 그대로 재사용하지 않고
 * 브리프가 허용한 대안(스태프→테이블 선택 인라인 SelectBottomSheet)을 택했다 — 방향이 반대라
 * DealerPickerSheet 를 그대로 감싸면 어색해지고, mutate 계약(useAssignTableStaff)은 동일하게 재사용한다.
 */
import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { confirmAction } from '@/utils/confirmAction';
import { AppFlashList } from '@/components/ui/AppFlashList';
import { SelectBottomSheet } from '@/components/ui';
import {
  useOpsStaff,
  useOpsTables,
  useSetTournamentPosting,
  useImportOpsStaff,
  useRemoveOpsStaff,
  useAssignTableStaff,
} from '@/hooks/ops';
import { useMyJobPostings } from '@/hooks/useJobManagement';
import { useActiveWorkspace } from '@/hooks/workspace/useActiveWorkspace';
import { useAuthStore } from '@/stores/authStore';
import { StaffRow } from './StaffRow';
import { StaffAddSheet } from './StaffAddSheet';
import { PostingPickerSheet } from './PostingPickerSheet';
import type { OpsStaff, OpsTournament } from '@/types/ops';

const UNASSIGN_TABLE_VALUE = '__unassign_table';
const NONE_TABLE_VALUE = '__none_table';
const ROW_ASSIGN_VALUE = 'assign';
const ROW_REMOVE_VALUE = 'remove';

interface StaffTabProps {
  tournamentId: string;
  tournament: OpsTournament;
}

export function StaffTab({ tournamentId, tournament }: StaffTabProps) {
  const actorId = useAuthStore((s) => s.user?.uid);
  const { activeWorkspace } = useActiveWorkspace();
  const { data: postings } = useMyJobPostings();
  const { data: roster, isLoading: rosterLoading } = useOpsStaff(tournamentId);
  const { tables } = useOpsTables(tournamentId);

  const setPostingMut = useSetTournamentPosting(tournamentId);
  const importMut = useImportOpsStaff(tournamentId);
  const removeMut = useRemoveOpsStaff(tournamentId);
  const assignMut = useAssignTableStaff(tournamentId);

  const [showPostingPicker, setShowPostingPicker] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [fullPeriod, setFullPeriod] = useState(false);
  const [rowActionStaff, setRowActionStaff] = useState<OpsStaff | null>(null);
  const [tableAssignFor, setTableAssignFor] = useState<OpsStaff | null>(null);

  const isOwner = !!actorId && tournament.ownerId === actorId;
  const connectedPosting = useMemo(
    () => (postings ?? []).find((p) => p.id === tournament.jobPostingId) ?? null,
    [postings, tournament.jobPostingId]
  );

  // staffId → 배정 테이블 번호/테이블ID 맵(useOpsTables 파생 — 딜러 배지·테이블 지정 시트 공용).
  const { tableNoByStaffId, tableIdByStaffId } = useMemo(() => {
    const noMap = new Map<string, number>();
    const idMap = new Map<string, string>();
    for (const t of tables) {
      if (t.assignedStaffId) {
        noMap.set(t.assignedStaffId, t.tableNo);
        idMap.set(t.assignedStaffId, t.id);
      }
    }
    return { tableNoByStaffId: noMap, tableIdByStaffId: idMap };
  }, [tables]);

  const tableAssignOptions = useMemo(() => {
    if (!tableAssignFor) return [];
    const currentTableId = tableIdByStaffId.get(tableAssignFor.staffId) ?? null;
    const tableOptions =
      tables.length > 0
        ? tables.map((t) => ({
            label: `T${t.tableNo}${t.name?.trim() ? ` ${t.name}` : ''}${
              t.id === currentTableId ? ' (현재)' : ''
            }`,
            value: t.id,
          }))
        : [{ label: '등록된 테이블이 없습니다', value: NONE_TABLE_VALUE, disabled: true }];
    return currentTableId
      ? [{ label: '배정 해제', value: UNASSIGN_TABLE_VALUE, destructive: true }, ...tableOptions]
      : tableOptions;
  }, [tables, tableAssignFor, tableIdByStaffId]);

  const confirmUnlink = useCallback(() => {
    confirmAction({
      title: '공고 연결 해제',
      message:
        '연결을 해제하면 이 대회에 공고 경유로 접근하던 워크스페이스 멤버의 열람 권한이 축소될 수 있습니다.',
      confirmText: '해제',
      destructive: true,
      onConfirm: () => setPostingMut.mutate(null),
    });
  }, [setPostingMut]);

  const handleImportPress = useCallback(() => {
    const date = fullPeriod ? null : (tournament.eventDate ?? null);
    confirmAction({
      title: '확정 스태프 가져오기',
      message: '이미 있는 스태프는 건너뛰고, 삭제했던 스태프는 다시 추가됩니다.',
      confirmText: '가져오기',
      onConfirm: () => importMut.mutate(date),
    });
  }, [fullPeriod, tournament.eventDate, importMut]);

  const confirmRemove = useCallback(
    (staff: OpsStaff) => {
      confirmAction({
        title: '로스터에서 삭제',
        message: `${staff.staffName} 님을 로스터에서 삭제할까요?\n배정된 테이블이 있으면 함께 해제됩니다.`,
        confirmText: '삭제',
        destructive: true,
        onConfirm: () => removeMut.mutate(staff.id),
      });
    },
    [removeMut]
  );

  const sheets = (
    <>
      <PostingPickerSheet
        visible={showPostingPicker}
        onClose={() => setShowPostingPicker(false)}
        onSelect={(postingId) => setPostingMut.mutate(postingId)}
      />

      <SelectBottomSheet
        visible={!!rowActionStaff}
        onClose={() => setRowActionStaff(null)}
        title={rowActionStaff?.staffName}
        options={[
          { label: '테이블 지정', value: ROW_ASSIGN_VALUE },
          { label: '로스터에서 삭제', value: ROW_REMOVE_VALUE, destructive: true },
        ]}
        onSelect={(v) => {
          const staff = rowActionStaff;
          if (!staff) return;
          if (v === ROW_ASSIGN_VALUE) setTableAssignFor(staff);
          else if (v === ROW_REMOVE_VALUE) confirmRemove(staff);
        }}
      />

      {tableAssignFor && (
        <SelectBottomSheet
          visible={!!tableAssignFor}
          onClose={() => setTableAssignFor(null)}
          title="테이블 지정"
          snapPoints={['60%', '90%']}
          scrollable
          options={tableAssignOptions}
          onSelect={(v) => {
            const staff = tableAssignFor;
            if (!staff || v === NONE_TABLE_VALUE) return;
            if (v === UNASSIGN_TABLE_VALUE) {
              const currentTableId = tableIdByStaffId.get(staff.staffId);
              if (currentTableId) assignMut.mutate({ tableId: currentTableId, staffId: null });
            } else {
              assignMut.mutate({ tableId: v, staffId: staff.staffId });
            }
          }}
        />
      )}

      <StaffAddSheet
        visible={showAddSheet}
        tournamentId={tournamentId}
        onClose={() => setShowAddSheet(false)}
      />
    </>
  );

  const postingCard = (
    <View className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <Text className="text-xs text-secondary-500 dark:text-secondary-400">연결된 공고</Text>
      {tournament.jobPostingId ? (
        <>
          <Text
            numberOfLines={1}
            className="mt-1 font-sans-semibold text-content-primary dark:text-off-white"
          >
            {connectedPosting?.title ?? '연결됨(현재 목록에서 찾을 수 없음)'}
          </Text>
          {isOwner && (
            <View className="mt-2 flex-row gap-2">
              <Pressable
                onPress={() => setShowPostingPicker(true)}
                accessibilityRole="button"
                className="rounded-md bg-gray-100 px-3 py-1.5 active:opacity-70 dark:bg-gray-800"
              >
                <Text className="text-sm text-content-primary dark:text-off-white">변경</Text>
              </Pressable>
              <Pressable
                onPress={confirmUnlink}
                accessibilityRole="button"
                className="rounded-md bg-gray-100 px-3 py-1.5 active:opacity-70 dark:bg-gray-800"
              >
                <Text className="text-sm text-error-600 dark:text-error-400">해제</Text>
              </Pressable>
            </View>
          )}
        </>
      ) : (
        <>
          <Text className="mt-1 text-sm text-secondary-500 dark:text-secondary-400">
            공고를 연결하면 확정 스태프를 가져올 수 있어요.
          </Text>
          {isOwner &&
            (activeWorkspace ? (
              <Pressable
                onPress={() => setShowPostingPicker(true)}
                accessibilityRole="button"
                className="mt-2 self-start rounded-md bg-primary-600 px-3 py-1.5 active:opacity-70"
              >
                <Text className="font-sans-semibold text-sm text-white">연결</Text>
              </Pressable>
            ) : (
              <Text className="mt-2 text-xs text-secondary-500 dark:text-secondary-400">
                워크스페이스가 없어 공고를 연결할 수 없습니다.
              </Text>
            ))}
        </>
      )}
    </View>
  );

  const importCtaCard = tournament.jobPostingId ? (
    <View className="mt-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs text-secondary-500 dark:text-secondary-400">
          {/* eventDate 가 없으면 handleImportPress 도 date=null(전체 기간)로 호출한다 — 캡션도 동작과
              일치시킨다("대회일" 문구는 실제로 필터되지 않는 상태를 오도했다, 리뷰 후속 T8-M2). */}
          {fullPeriod || !tournament.eventDate ? '전체 기간' : tournament.eventDate} 기준
        </Text>
        <Pressable
          onPress={() => setFullPeriod((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel="전체 기간 토글"
        >
          <Text
            className={`text-xs font-sans-medium ${
              fullPeriod
                ? 'text-primary-600 dark:text-primary-400'
                : 'text-secondary-500 dark:text-secondary-400'
            }`}
          >
            전체 기간 {fullPeriod ? 'ON' : 'OFF'}
          </Text>
        </Pressable>
      </View>
      <Pressable
        onPress={handleImportPress}
        accessibilityRole="button"
        className="mt-2 items-center rounded-md bg-primary-600 py-2.5 active:opacity-70"
      >
        <Text className="font-sans-semibold text-sm text-white">확정 스태프 가져오기</Text>
      </Pressable>
    </View>
  ) : null;

  // AppFlashList 는 실제 스크롤 영역(로스터 행)만 담당한다. 카드류·staleness 캡션·수동추가 버튼은
  // ListHeaderComponent/ListFooterComponent 대신 형제 View 로 배치한다 — TablesTab.tsx 의
  // "Redraw/+ 테이블 추가 버튼을 목록 위 형제로" 문형과 동일(FlashList 는 renderItem/ListEmptyComponent 만 사용).
  return (
    <View className="flex-1">
      <View className="px-4 pb-1 pt-2">
        {postingCard}
        {importCtaCard}
        {(roster ?? []).length > 0 && (
          <Text className="mb-1 mt-3 px-1 text-xs text-secondary-500 dark:text-secondary-400">
            가져온 시점 기준 명단입니다
          </Text>
        )}
      </View>

      <AppFlashList
        data={roster ?? []}
        keyExtractor={(s: OpsStaff) => s.id}
        estimatedItemSize={72}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 4 }}
        renderItem={({ item }: { item: OpsStaff }) => (
          <StaffRow
            staff={item}
            assignedTableNo={tableNoByStaffId.get(item.staffId) ?? null}
            onPress={() => setRowActionStaff(item)}
          />
        )}
        ListEmptyComponent={
          <View className="items-center px-6 py-10">
            <Text className="text-secondary-500 dark:text-secondary-400">
              {rosterLoading ? '불러오는 중…' : '등록된 스태프가 없습니다.'}
            </Text>
          </View>
        }
      />

      <View className="items-center px-4 py-3">
        <Pressable
          onPress={() => setShowAddSheet(true)}
          accessibilityRole="button"
          className="rounded-md bg-gray-100 px-4 py-2.5 active:opacity-70 dark:bg-gray-800"
        >
          <Text className="font-sans-semibold text-sm text-content-primary dark:text-off-white">
            + 스태프 추가
          </Text>
        </Pressable>
      </View>

      {sheets}
    </View>
  );
}

export default StaffTab;
