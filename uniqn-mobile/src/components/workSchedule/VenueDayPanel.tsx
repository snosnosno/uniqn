/**
 * VenueDayPanel — 근무표 선택 날짜 패널(요약·소프트타깃·추가·편집 통합, B 통합 단계)
 *
 * 선택한 운영처 컨테이너의 특정 날짜에 대해 4가지를 한 패널에서 처리한다:
 *  - U1 부족신호 요약: 현재(headcount)/목표(softTarget)/부족(shortage)을 색상 단독이 아니라
 *    아이콘+숫자+a11y 라벨로 병기(GridDayCell SSOT 소비 → CalendarCell 뱃지와 정합).
 *  - 소프트타깃 입력: 그 날 목표인원 → useSetVenueSoftTarget(venueId, date, count). 날짜 toDateString(E5).
 *  - 인원 추가: AddSlotSheet(풀/전화/공고).
 *  - 슬롯 편집: VenueDayDetail 행 탭 → WorkLogEditSheet(3개 진입점 공용 통합 시트).
 *
 * 구인자 IA S4 — 밀도: 칩 3개(현재/필요/부족) + 입력칸 + 저장 버튼이 세로로 쌓여 사람 줄이
 *    화면 아래로 밀려났다. `3/5명 · 2명 부족` 한 줄로 접고, 줄을 누르면 목표 편집이 펼쳐진다.
 *    편집 영역은 여전히 **수동 목표만** 다룬다(PR #490 분리).
 *
 * 🔴 **`isContainer` 게이트가 사라졌다.** 예전에는 컨테이너 직속 배치만 `useConfirmedStaff` 로
 *    실적(출퇴근)을 해소할 수 있어, 공고 스팬 슬롯에서는 실적 편집 입구가 통째로 증발했다
 *    (설계 결함 ②). 읽기 RPC 가 실적을 함께 내려주게 되면서 원인이 사라졌으므로, 슬롯이
 *    직접 들고 온 값을 시트에 넘긴다 — 두 번째 조회도, 모달 스왑 지연도 필요 없다.
 *
 * ⚠️ **빼기는 시트가 아니라 카드 액션이다**(설계 §3-4). 시트는 순수 편집기이고 파괴적 액션은
 *    진입 맥락의 것이다. 시트 푸터로 되돌리지 말 것.
 *
 * R1: 클라는 COUNT/표시만(요약은 GridDayCell), filled 미러·정원 정합은 RPC 책임.
 * 쓰기 무효화는 각 훅/시트가 queryKeys.workSchedule.all prefix 로 담당 → 부족셀·상세 자동 갱신.
 * 플래그 OFF면 상위(work-schedule 화면)에서 미노출.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import {
  UsersIcon,
  AlertTriangleIcon,
  UserPlusIcon,
  MegaphoneIcon,
  ClockIcon,
} from '@/components/icons';
import { SECONDARY_PALETTE, STATUS_COLORS } from '@/constants/colors';
import { toDateString } from '@/utils/date';
import { useToastStore } from '@/stores/toastStore';
import { useUser } from '@/stores/authStore';
import { useDeleteSlot, useSetVenueSoftTarget, useVenueDaySlots } from '@/hooks/workSchedule';
import { computeShortage, readScheduledStart, type GridDayCell } from '@/domains/workSchedule';
import { isWorkLogStatus } from '@/shared/status';
import { isStaffRole } from '@/types/role';
import { WorkLogEditSheet, type WorkLogEditInitial } from '@/components/workLogEdit';
import type { VenueDaySlot } from '@/repositories/workSchedule';
import { VenueDayDetail } from './VenueDayDetail';
import { AddSlotSheet } from './AddSlotSheet';
import { SlotTimeChangeSheet } from './SlotTimeChangeSheet';
import { ReleaseAssignmentSheet } from './ReleaseAssignmentSheet';
import { saveFailed } from '@/constants/messages';

export interface VenueDayPanelProps {
  /** venue 컨테이너 job_posting_id (= venueId) */
  venueId: string;
  /** YYYY-MM-DD 선택일 */
  date: string;
  /** 사람이 읽는 날짜 라벨(예: "6월 29일 (월)") */
  dateLabel: string;
  /** 그리드 요약 셀(현재/목표/부족 SSOT). 없으면 0 으로 방어. */
  cell?: GridDayCell;
  /** 월 요약을 신뢰할 수 있는지. false면 0명으로 단정하지 않고 계획·충원 쓰기를 잠근다. */
  isSummaryAvailable?: boolean;
}

/** 하루 목표 인원(소프트타깃) 클라 상한(L2) — 서버(set_venue_soft_target)는 음수만 거부(상한 없음)라 클라에서 상한 클램프. 뱃지 "997명" 과장 방지. */
const MAX_SOFT_TARGET = 99;

/** ISO timestamptz → Date. 못 읽으면 null(기록 없음과 같게 다룬다 — 지어내지 않는다). */
function parseTimestamptz(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * 근무표 슬롯 → 통합 편집 시트 초기값.
 *
 * 🔴 `status` 는 슬롯의 **실값**을 넘긴다. null 로 얼버무리면 노쇼·취소 행에서도 시트 배지가
 *    시각에서 파생돼 "저장하면 출근이 됩니다"라고 거짓말한다(서버는 그 상태를 안 건드린다).
 *    반대로 낯선 값을 'scheduled' 로 흡수해도 같은 거짓말이 되므로, 모를 때만 null 을 준다.
 *
 * 🔑 `jobPosting`/`filledByRole`(역할 마감 표기)은 여기서 채우지 않는다 — 근무표에는 넘길
 *    단일 공고가 **원리적으로 없다**(슬롯마다 `jobPostingId` 가 다르고 컨테이너 직속 배치는
 *    대응 공고가 아예 없다). 이 경로에 마감 표기가 없는 것은 정상이다(설계 §3-2-b).
 */
function toEditInitial(slot: VenueDaySlot, fallbackDate: string): WorkLogEditInitial {
  return {
    ...readScheduledStart(slot.timeSlot),
    checkIn: parseTimestamptz(slot.checkInTs),
    checkOut: parseTimestamptz(slot.checkOutTs),
    checkInScannedAt: parseTimestamptz(slot.checkInScannedAt ?? null),
    checkOutScannedAt: parseTimestamptz(slot.checkOutScannedAt ?? null),
    modificationHistory: slot.modificationHistory ?? [],
    role: isStaffRole(slot.role) ? slot.role : 'staff',
    customRole: slot.customRole,
    color: slot.color,
    memo: slot.notes ?? '',
    date: slot.date || fallbackDate,
    status: isWorkLogStatus(slot.status) ? slot.status : null,
    payrollStatus: slot.payrollStatus,
    staffName: slot.staffName,
  };
}

type SummaryTone = 'neutral' | 'warning' | 'success';

/** 요약 줄 톤별 정적 클래스(NativeWind dark: 유실 방지 — 동적 조립 금지). */
const SUMMARY_TONE_TEXT: Record<SummaryTone, string> = {
  neutral: 'text-content-primary',
  warning: 'text-warning-700 dark:text-warning-300',
  success: 'text-success-700 dark:text-success-300',
};

/**
 * 한 줄 요약 — 문구·스크린리더 라벨·톤. U1: 색상 단독 금지(수치·상태를 글자로 병기).
 *  - 부족: `3/5명 · 2명 부족`
 *  - 충원: `5/5명 · 충원 완료`
 *  - 목표 없음: `3명 배치`
 */
function describeDaySummary(headcount: number, softTarget: number, shortage: number) {
  if (softTarget > 0 && shortage > 0) {
    return {
      text: `${headcount}/${softTarget}명 · ${shortage}명 부족`,
      a11y: `현재 ${headcount}명, 필요 ${softTarget}명, ${shortage}명 부족`,
      tone: 'warning' as SummaryTone,
    };
  }
  if (softTarget > 0) {
    return {
      text: `${headcount}/${softTarget}명 · 충원 완료`,
      a11y: `현재 ${headcount}명, 필요 ${softTarget}명, 충원 완료`,
      tone: 'success' as SummaryTone,
    };
  }
  return {
    text: `${headcount}명 배치`,
    a11y: `현재 ${headcount}명 배치`,
    tone: 'neutral' as SummaryTone,
  };
}

export function VenueDayPanel({
  venueId,
  date,
  dateLabel,
  cell,
  isSummaryAvailable = true,
}: VenueDayPanelProps) {
  const router = useRouter();
  const toastSuccess = useToastStore((s) => s.success);
  const toastError = useToastStore((s) => s.error);
  const user = useUser();
  const editedBy = user?.uid;

  const headcount = cell?.headcount ?? 0;
  const softTarget = cell?.softTarget ?? 0;
  const shortage = cell?.shortage ?? computeShortage(softTarget, headcount);
  // 🔑 입력칸은 **수동 목표**만 다룬다. 실효 목표(softTarget = max(수동, 공고 파생))를 프리필하면
  //    공고 좌석이 더 클 때 그 숫자가 칸에 들어앉고, 저장 한 번에 사용자의 수동 목표를 덮는다.
  //    공고를 마감해 좌석이 사라지면 있지도 않던 목표만 남아 매일 부족을 외친다(기준선 §5.1).
  const manualTarget = cell?.manualTarget ?? 0;
  const derivedRequired = cell?.derivedRequired ?? 0;
  const summary = describeDaySummary(headcount, softTarget, shortage);

  // 형제 슬롯 — 지금 쓰는 곳은 **시간 일괄 변경 시트(3-C)** 와 헤더 버튼 노출 판정뿐이다.
  // (중복충돌 경고는 통합 시트로 넘어오면서 사라졌다 — `slotEdit.detectSlotConflicts` 주석 참조.)
  // VenueDayDetail 과 동일 쿼리키를 공유해 중복 요청은 없다.
  const { data: daySlots } = useVenueDaySlots(venueId, date);
  const siblingSlots = useMemo(() => daySlots ?? [], [daySlots]);

  const [addVisible, setAddVisible] = useState(false);
  const [editingSlot, setEditingSlot] = useState<VenueDaySlot | null>(null);
  const [timeChangeVisible, setTimeChangeVisible] = useState(false);
  /** 빼기 확인 대상(카드 액션). 시트와 겹치지 않는다 — 카드에서 바로 뜬다. */
  const [deleteTarget, setDeleteTarget] = useState<VenueDaySlot | null>(null);
  /** 목표 인원 편집 펼침(S4) — 요약 줄을 눌러 연다. 날짜를 옮기면 닫는다. */
  const [isTargetEditorOpen, setIsTargetEditorOpen] = useState(false);

  const deleteSlot = useDeleteSlot();

  /**
   * 빼기 — 시트가 아니라 카드 액션이다(설계 §3-4). 파괴적 액션은 진입 맥락의 것이라
   * 화면마다 뜻이 다르고(근무표=배치 빼기, 스태프관리=명단 제거), 순수 편집기인 시트가
   * 그 차이를 prop 으로 흡수하면 D2 가 없애려던 "화면마다 다름"이 시트 안에서 재발한다.
   *
   * 출근 전 확정 배치만 뺄 수 있다. 체크인 이후 기록은 출퇴근 정정 흐름에서 다루며,
   * 감사·정산 근거인 work_log 자체를 제거하지 않는다.
   *
   * staffId 없는 슬롯은 서비스 정합검증을 통과할 수 없어 진입 자체를 막는다(구 시트 가드 계승).
   */
  const handleRequestDelete = useCallback(
    (slot: VenueDaySlot) => {
      if (!slot.staffId) {
        toastError('이 배치는 뺄 수 없어요. 공고 스태프 관리에서 처리해주세요.');
        return;
      }
      setDeleteTarget(slot);
    },
    [toastError]
  );

  const handleDeleteConfirm = useCallback(
    (reason: string) => {
      const target = deleteTarget;
      if (!target?.staffId) return;
      deleteSlot.mutate(
        {
          workLogId: target.workLogId,
          jobPostingId: target.jobPostingId,
          staffId: target.staffId,
          date,
          reason,
        },
        {
          onSuccess: () => {
            toastSuccess('근무에서 뺐어요.');
            setDeleteTarget(null);
          },
          onError: () => toastError('근무 빼기에 실패했어요. 잠시 후 다시 시도해주세요.'),
        }
      );
    },
    [deleteTarget, deleteSlot, date, toastSuccess, toastError]
  );

  // 소프트타깃 입력값(문자열) — 저장값/날짜 변경 시 동기화(재진입 시 이전 값 잔존 방지).
  // 동기화 원본은 **수동 목표**다(실효 목표 아님 — 위 manualTarget 주석 참조).
  const [targetInput, setTargetInput] = useState<string>(
    manualTarget > 0 ? String(manualTarget) : ''
  );
  useEffect(() => {
    setTargetInput(manualTarget > 0 ? String(manualTarget) : '');
  }, [manualTarget, date]);

  // 다른 날짜로 옮기면 편집을 닫는다 — 열린 채 두면 어느 날짜의 목표를 고치는지 헷갈린다.
  useEffect(() => {
    setIsTargetEditorOpen(false);
  }, [date]);

  const setSoftTarget = useSetVenueSoftTarget();

  // 입력 정규화(빈값=0, 음수/NaN=무효, 상한 99 클램프). 저장 버튼 활성/검증 공통 사용.
  // L2: maxLength=3 이 "997" 같은 3자리 입력을 허용하므로 저장/검증 값을 0..99 로 클램프한다
  // (서버는 음수만 거부·상한 없음). 저장 성공 후 softTarget effect 가 targetInput 을 클램프 값으로 자가치유.
  const parsedTarget = useMemo(() => {
    const trimmed = targetInput.trim();
    if (trimmed === '') return 0;
    const n = Number.parseInt(trimmed, 10);
    return Number.isFinite(n) ? Math.min(MAX_SOFT_TARGET, Math.max(0, n)) : NaN;
  }, [targetInput]);

  const targetValid = Number.isFinite(parsedTarget) && parsedTarget >= 0;
  const targetDirty = targetValid && parsedTarget !== manualTarget;

  const handleSaveTarget = useCallback(() => {
    if (!targetValid) {
      toastError('목표 인원은 0 이상의 숫자로 입력해주세요.');
      return;
    }
    setSoftTarget.mutate(
      // E5: write 경계에서 날짜키 정규화(레포도 재정규화하나 클라단 일관성 보장).
      { venueId, date: toDateString(date), count: parsedTarget },
      {
        onSuccess: () => {
          toastSuccess('목표 인원을 저장했어요.');
          setIsTargetEditorOpen(false);
        },
        onError: () => toastError(saveFailed('목표 인원', { retry: true })),
      }
    );
  }, [targetValid, parsedTarget, setSoftTarget, venueId, date, toastSuccess, toastError]);

  return (
    // P1-3: 상위(work-schedule)가 단일 ScrollView 스크롤러 — flex-1 대신 자연 높이(Yoga flex-1 붕괴 회피).
    <View>
      {/* 헤더: 날짜 + 시간 일괄 변경(3-C) + 인원 추가 진입 */}
      <View className="flex-row items-center justify-between px-4 pt-2">
        <Text className="text-sm font-sans-semibold text-content-primary">{dateLabel} 배치</Text>
        <View className="flex-row items-center gap-2">
          {/* 배치된 인원이 없으면 고를 묶음도 없다 — 빈 시트로 보내지 않는다. */}
          {isSummaryAvailable && siblingSlots.length > 0 ? (
            <Button
              variant="secondary"
              size="sm"
              onPress={() => setTimeChangeVisible(true)}
              icon={<ClockIcon size={16} color={SECONDARY_PALETTE[500]} />}
              accessibilityLabel="시간 일괄 변경"
            >
              시간 변경
            </Button>
          ) : null}
          {isSummaryAvailable ? (
            <Button
              variant="secondary"
              size="sm"
              onPress={() => setAddVisible(true)}
              icon={<UserPlusIcon size={16} color={SECONDARY_PALETTE[500]} />}
              accessibilityLabel="인원 추가"
            >
              추가
            </Button>
          ) : null}
        </View>
      </View>

      {/* U1 부족신호 한 줄 요약(수치·상태를 글자로 병기, 색상 단독 금지) — 누르면 목표 편집(S4) */}
      {isSummaryAvailable ? (
        <View className="px-4 pt-2">
          <Pressable
            testID="day-summary-line"
            onPress={() => setIsTargetEditorOpen((open) => !open)}
            accessibilityRole="button"
            // 화면 문구('목표 편집'/'닫기')와 안내를 맞춘다 — 열려 있는데 "편집"이라 읽으면 누르는 순간 닫힌다.
            accessibilityLabel={`${summary.a11y}. ${
              isTargetEditorOpen ? '눌러서 목표 편집 닫기' : '눌러서 목표 인원 편집'
            }`}
            accessibilityState={{ expanded: isTargetEditorOpen }}
            className="min-h-[44px] flex-row items-center gap-2 rounded-md border border-divider bg-surface-card px-3 active:opacity-70 dark:bg-surface-elevated"
          >
            {summary.tone === 'warning' ? (
              <AlertTriangleIcon size={16} color={STATUS_COLORS.warning} />
            ) : (
              <UsersIcon
                size={16}
                color={summary.tone === 'success' ? STATUS_COLORS.success : SECONDARY_PALETTE[500]}
              />
            )}
            <Text
              className={`flex-1 text-sm font-sans-semibold ${SUMMARY_TONE_TEXT[summary.tone]}`}
            >
              {summary.text}
            </Text>
            <Text className="text-xs font-sans-medium text-primary-600 dark:text-primary-400">
              {isTargetEditorOpen ? '닫기' : '목표 편집'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View
          accessible
          accessibilityRole="alert"
          className="mx-4 mt-2 rounded-md bg-warning-50 px-3 py-2 dark:bg-warning-900/20"
        >
          <Text className="text-sm font-sans-medium text-warning-700 dark:text-warning-300">
            충원 현황을 확인 중이거나 불러오지 못해 계획 변경을 잠시 잠갔어요.
          </Text>
        </View>
      )}

      {/* 소프트타깃 입력(그 날 목표인원) — 다루는 값은 **수동 목표** 하나다.
          요약 줄의 '필요'는 max(수동, 공고 좌석)이라 이 칸과 다를 수 있고, 그게 정상이다. */}
      {isSummaryAvailable && isTargetEditorOpen ? (
        <View className="px-4 pt-2">
          <View className="flex-row items-end gap-2">
            <View className="w-28">
              <Input
                label="목표 인원"
                value={targetInput}
                onChangeText={setTargetInput}
                placeholder="0"
                keyboardType="number-pad"
                maxLength={3}
                accessibilityLabel="이 날 직접 지정할 목표 인원"
                onSubmitEditing={handleSaveTarget}
                returnKeyType="done"
              />
            </View>
            <Button
              variant="outline"
              size="sm"
              onPress={handleSaveTarget}
              disabled={!targetDirty}
              loading={setSoftTarget.isPending}
              accessibilityLabel="목표 인원 저장"
            >
              저장
            </Button>
          </View>
          {/* 공고 좌석이 있으면 '필요'가 이 입력값과 왜 다른지 그 자리에서 설명한다.
              설명이 없으면 사용자는 칸의 숫자가 반영이 안 된 줄 알고 다시 저장한다. */}
          {derivedRequired > 0 ? (
            <Text className="mt-1 text-xs text-content-secondary" testID="target-source-hint">
              이 날 공고 좌석 {derivedRequired}명 · 직접 지정 {manualTarget}명 → 필요 {softTarget}명
              (둘 중 큰 값)
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* P2-1: 부족신호 → 프리필 공고 깔때기 — 그리드가 아는 것(운영처·날짜·부족 인원)을 폼에 실어 보낸다 */}
      {isSummaryAvailable && shortage > 0 ? (
        <View className="px-4 pt-2">
          <Button
            variant="outline"
            size="sm"
            onPress={() =>
              router.push({
                pathname: '/(employer)/my-postings/create',
                params: { venueId, date, count: String(shortage) },
              })
            }
            icon={<MegaphoneIcon size={16} color={SECONDARY_PALETTE[500]} />}
            accessibilityLabel={`부족 인원 ${shortage}명 공고로 모집`}
          >
            부족 {shortage}명 공고로 모집
          </Button>
        </View>
      ) : null}

      {/* 선택 날짜 배치 상세(행 탭 → 편집) — 직접 렌더(가상화 없음), 스크롤은 상위 담당 */}
      <View className="mt-1">
        {/* 카드에 '시간 수정' 버튼은 두지 않는다 — 편집 입구는 행 탭 → 통합 시트 하나다.
            카드에 남는 액션은 **빼기 하나뿐**이다(파괴적 액션은 진입 맥락의 것 — 설계 §3-4). */}
        <VenueDayDetail
          venueId={venueId}
          date={date}
          // 개별 근태 정정은 월 요약 헤드카운트에 의존하지 않는다.
          // 요약 실패 시에도 미퇴근 해결 경로는 열어 둔다.
          onSlotPress={setEditingSlot}
          onSlotDelete={isSummaryAvailable ? handleRequestDelete : undefined}
          onAddPress={isSummaryAvailable ? () => setAddVisible(true) : undefined}
          // 출처 칩 → 그 공고 상세. 근무표가 공고를 거슬러 올라가는 유일한 길이다(구인자 IA S4).
          onSourcePress={(jobPostingId) => router.push(`/(employer)/my-postings/${jobPostingId}`)}
        />
      </View>

      {/* 인원 추가 시트 — workSchedule 무효화는 useConfirmedStaff.addStaff(W-1)가 담당 */}
      <AddSlotSheet
        visible={addVisible}
        onClose={() => setAddVisible(false)}
        containerId={venueId}
        date={date}
      />

      {/* 시간 일괄 변경 시트(3-C) — useUpdatePostingSlotTime 이 workSchedule/applications/
          jobPostings/postingFilledCounts 를 함께 무효화한다(공고 원문 정원도 바뀌기 때문). */}
      <SlotTimeChangeSheet
        visible={timeChangeVisible}
        onClose={() => setTimeChangeVisible(false)}
        date={date}
        slots={siblingSlots}
      />

      {/* 통합 편집 시트(3개 진입점 공용) — 대상이 있을 때만 마운트한다. `visible` 을 켠 채
          대상만 바꾸면 시트가 `[visible, workLogId]` 로만 초기화하므로 옛 값이 남을 수 있다. */}
      {editingSlot ? (
        <WorkLogEditSheet
          visible
          onClose={() => setEditingSlot(null)}
          workLogId={editingSlot.workLogId}
          initial={toEditInitial(editingSlot, date)}
          editedBy={editedBy}
        />
      ) : null}

      {/* 빼기 확인 — 카드 액션의 것이라 시트와 겹치지 않는다(중첩 RN Modal 없음). */}
      <ReleaseAssignmentSheet
        visible={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        staffName={deleteTarget?.staffName ?? undefined}
        isSubmitting={deleteSlot.isPending}
      />
    </View>
  );
}
