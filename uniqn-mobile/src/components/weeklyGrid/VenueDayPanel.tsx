/**
 * VenueDayPanel — 주간 그리드 선택 날짜 패널(요약·소프트타깃·추가·편집 통합, B 통합 단계)
 *
 * 선택한 운영처 컨테이너의 특정 날짜에 대해 4가지를 한 패널에서 처리한다:
 *  - U1 부족신호 요약: 현재(headcount)/목표(softTarget)/부족(shortage)을 색상 단독이 아니라
 *    아이콘+숫자+a11y 라벨로 병기(GridDayCell SSOT 소비 → CalendarCell 뱃지와 정합).
 *  - 소프트타깃 입력: 그 날 목표인원 → useSetVenueSoftTarget(venueId, date, count). 날짜 toDateString(E5).
 *  - 인원 추가: AddSlotSheet(풀/전화/공고).
 *  - 슬롯 편집: VenueDayDetail 행 탭 → EditSlotSheet(형제 슬롯 중복충돌 경고).
 *
 * R1: 클라는 COUNT/표시만(요약은 GridDayCell), filled 미러·정원 정합은 RPC 책임.
 * 쓰기 무효화는 각 훅/시트가 queryKeys.weeklyGrid.all prefix 로 담당 → 부족셀·상세 자동 갱신.
 * 플래그 OFF면 상위(weekly-grid 화면)에서 미노출.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale/ko';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import {
  UsersIcon,
  FlagOutlineIcon,
  AlertTriangleIcon,
  UserPlusIcon,
  MegaphoneIcon,
} from '@/components/icons';
import { SECONDARY_PALETTE, STATUS_COLORS } from '@/constants/colors';
import { toDateString, parseDateString, getTodayString } from '@/utils/date';
import { useToastStore } from '@/stores/toastStore';
import { useUser } from '@/stores/authStore';
import {
  useSetVenueSoftTarget,
  useSetVenueSoftTargetBulk,
  useVenueDaySlots,
} from '@/hooks/weeklyGrid';
import {
  computeShortage,
  getSameWeekdayDatesInMonth,
  type GridDayCell,
} from '@/domains/weeklyGrid';
import type { VenueDaySlot } from '@/repositories/weeklyGrid';
import { VenueDayDetail } from './VenueDayDetail';
import { AddSlotSheet } from './AddSlotSheet';
import { EditSlotSheet } from './EditSlotSheet';

export interface VenueDayPanelProps {
  /** venue 컨테이너 job_posting_id (= venueId) */
  venueId: string;
  /** YYYY-MM-DD 선택일 */
  date: string;
  /** 사람이 읽는 날짜 라벨(예: "6월 29일 (월)") */
  dateLabel: string;
  /** 그리드 요약 셀(현재/목표/부족 SSOT). 없으면 0 으로 방어. */
  cell?: GridDayCell;
}

type ChipTone = 'neutral' | 'warning' | 'success';

/** 요약 칩 톤별 정적 클래스(NativeWind dark: 유실 방지 — 동적 조립 금지). */
const CHIP_TONE: Record<ChipTone, { box: string; text: string }> = {
  neutral: {
    box: 'bg-surface-card border border-divider dark:bg-surface-elevated',
    text: 'text-content-secondary',
  },
  warning: { box: 'bg-warning-500/15', text: 'text-warning-700 dark:text-warning-300' },
  success: { box: 'bg-success-500/15', text: 'text-success-700 dark:text-success-300' },
};

/** 요약 칩 한 칸 — U1: 아이콘+라벨+수치 병기 + a11y 라벨(색상 단독 금지). */
function StatChip({
  icon,
  label,
  value,
  a11yLabel,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  a11yLabel: string;
  tone: ChipTone;
}) {
  const toneClass = CHIP_TONE[tone];
  return (
    <View
      accessible
      accessibilityLabel={a11yLabel}
      className={`flex-row items-center gap-1 rounded-full px-3 py-1.5 ${toneClass.box}`}
    >
      {icon}
      <Text className={`text-xs font-sans-medium ${toneClass.text}`}>{label}</Text>
      <Text className={`text-sm font-sans-semibold ${toneClass.text}`}>{value}</Text>
    </View>
  );
}

export function VenueDayPanel({ venueId, date, dateLabel, cell }: VenueDayPanelProps) {
  const router = useRouter();
  const toastSuccess = useToastStore((s) => s.success);
  const toastError = useToastStore((s) => s.error);
  const user = useUser();
  const editedBy = user?.uid;

  const headcount = cell?.headcount ?? 0;
  const softTarget = cell?.softTarget ?? 0;
  const shortage = cell?.shortage ?? computeShortage(softTarget, headcount);

  // 형제 슬롯(편집 시 같은 스태프·시작시각 중복충돌 경고용). VenueDayDetail 과 동일 쿼리키 공유(중복요청 없음).
  const { data: daySlots } = useVenueDaySlots(venueId, date);
  const siblingSlots = useMemo(() => daySlots ?? [], [daySlots]);

  const [addVisible, setAddVisible] = useState(false);
  const [editingSlot, setEditingSlot] = useState<VenueDaySlot | null>(null);

  // 소프트타깃 입력값(문자열) — 저장값/날짜 변경 시 동기화(재진입 시 이전 값 잔존 방지).
  const [targetInput, setTargetInput] = useState<string>(softTarget > 0 ? String(softTarget) : '');
  useEffect(() => {
    setTargetInput(softTarget > 0 ? String(softTarget) : '');
  }, [softTarget, date]);

  const setSoftTarget = useSetVenueSoftTarget();
  const setSoftTargetBulk = useSetVenueSoftTargetBulk();

  // "이번 달 같은 요일 전체 적용" 토글(기본 off). on 이면 저장이 요일 반복 벌크 경로를 탄다.
  const [repeatWeekday, setRepeatWeekday] = useState(false);

  // 입력 정규화(빈값=0, 음수/NaN=무효). 저장 버튼 활성/검증 공통 사용.
  const parsedTarget = useMemo(() => {
    const trimmed = targetInput.trim();
    if (trimmed === '') return 0;
    const n = Number.parseInt(trimmed, 10);
    return Number.isFinite(n) ? n : NaN;
  }, [targetInput]);

  const targetValid = Number.isFinite(parsedTarget) && parsedTarget >= 0;
  const targetDirty = targetValid && parsedTarget !== softTarget;

  const handleSaveTarget = useCallback(() => {
    if (!targetValid) {
      toastError('목표 인원은 0 이상의 숫자로 입력해주세요.');
      return;
    }
    if (repeatWeekday) {
      // 요일 반복: 선택일을 Date 로 복원 → 이번 달 같은 요일에 목표 인원 벌크 저장.
      const parsed = parseDateString(date);
      if (!parsed) {
        toastError('날짜를 확인할 수 없어요. 잠시 후 다시 시도해주세요.');
        return;
      }
      // 과거 날짜 제외 — 지난날 부족 뱃지 오표시·이미 지난 개별 설정 오염 방지(오늘 포함 이후만).
      const today = getTodayString();
      const dates = getSameWeekdayDatesInMonth(parsed).filter((d) => d >= today);
      if (dates.length === 0) {
        toastError('이번 달에 적용할 남은 날짜가 없어요.');
        return;
      }
      // 일괄 덮어쓰기 확인(임페커블 룰12) — 개별 설정한 날짜가 조용히 리셋되지 않게 명시 동의.
      const weekdayLabel = format(parsed, 'EEEE', { locale: ko });
      Alert.alert(
        '요일 전체 적용',
        `이번 달 남은 ${weekdayLabel} ${dates.length}일의 목표 인원을 ${parsedTarget}명으로 덮어써요. 개별로 설정해둔 날짜도 함께 바뀝니다.`,
        [
          { text: '취소', style: 'cancel' },
          {
            text: `${dates.length}일에 적용`,
            style: 'destructive',
            onPress: () =>
              setSoftTargetBulk.mutate(
                { venueId, dates, count: parsedTarget },
                {
                  onSuccess: () => toastSuccess(`${dates.length}일에 목표 인원을 저장했어요.`),
                  // 순차 저장이라 중간 실패 시 일부만 반영됐을 수 있음(멱등이라 재시도 안전).
                  onError: () =>
                    toastError(
                      '목표 인원 저장에 실패했어요. 일부만 적용됐을 수 있어요 — 다시 시도해주세요.'
                    ),
                }
              ),
          },
        ]
      );
      return;
    }
    setSoftTarget.mutate(
      // E5: write 경계에서 날짜키 정규화(레포도 재정규화하나 클라단 일관성 보장).
      { venueId, date: toDateString(date), count: parsedTarget },
      {
        onSuccess: () => toastSuccess('목표 인원을 저장했어요.'),
        onError: () => toastError('목표 인원 저장에 실패했어요. 잠시 후 다시 시도해주세요.'),
      }
    );
  }, [
    targetValid,
    repeatWeekday,
    parsedTarget,
    setSoftTarget,
    setSoftTargetBulk,
    venueId,
    date,
    toastSuccess,
    toastError,
  ]);

  return (
    // P1-3: 상위(weekly-grid)가 단일 ScrollView 스크롤러 — flex-1 대신 자연 높이(Yoga flex-1 붕괴 회피).
    <View>
      {/* 헤더: 날짜 + 인원 추가 진입 */}
      <View className="flex-row items-center justify-between px-4 pt-2">
        <Text className="text-sm font-sans-semibold text-content-primary">{dateLabel} 배치</Text>
        <Button
          variant="secondary"
          size="sm"
          onPress={() => setAddVisible(true)}
          icon={<UserPlusIcon size={16} color={SECONDARY_PALETTE[500]} />}
          accessibilityLabel="인원 추가"
        >
          추가
        </Button>
      </View>

      {/* U1 부족신호 요약(아이콘+숫자+a11y, 색상 단독 금지) */}
      <View className="flex-row flex-wrap items-center gap-2 px-4 pt-2">
        <StatChip
          icon={<UsersIcon size={14} color={SECONDARY_PALETTE[500]} />}
          label="현재"
          value={`${headcount}명`}
          a11yLabel={`현재 배치 인원 ${headcount}명`}
          tone="neutral"
        />
        <StatChip
          icon={<FlagOutlineIcon size={14} color={SECONDARY_PALETTE[500]} />}
          label="목표"
          value={`${softTarget}명`}
          a11yLabel={`목표 인원 ${softTarget}명`}
          tone="neutral"
        />
        {shortage > 0 ? (
          <StatChip
            icon={<AlertTriangleIcon size={14} color={STATUS_COLORS.warning} />}
            label="부족"
            value={`${shortage}명`}
            a11yLabel={`부족 인원 ${shortage}명`}
            tone="warning"
          />
        ) : softTarget > 0 ? (
          <StatChip
            icon={<UsersIcon size={14} color={STATUS_COLORS.success} />}
            label="충원"
            value="완료"
            a11yLabel="목표 인원 충원 완료"
            tone="success"
          />
        ) : null}
      </View>

      {/* P2-1: 부족신호 → 프리필 공고 깔때기 — 그리드가 아는 것(운영처·날짜·부족 인원)을 폼에 실어 보낸다 */}
      {shortage > 0 ? (
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

      {/* 소프트타깃 입력(그 날 목표인원) */}
      <View className="flex-row items-end gap-2 px-4 pt-2">
        <View className="w-28">
          <Input
            label="목표 인원"
            value={targetInput}
            onChangeText={setTargetInput}
            placeholder="0"
            keyboardType="number-pad"
            maxLength={3}
            accessibilityLabel="이 날 목표 인원"
            onSubmitEditing={handleSaveTarget}
            returnKeyType="done"
          />
        </View>
        <Button
          variant="outline"
          size="sm"
          onPress={handleSaveTarget}
          disabled={!targetDirty}
          loading={setSoftTarget.isPending || setSoftTargetBulk.isPending}
          accessibilityLabel="목표 인원 저장"
        >
          저장
        </Button>
      </View>

      {/* 요일 반복 토글: on 이면 저장이 이번 달 같은 요일 전체에 목표 인원을 적용 */}
      <View className="px-4 pt-2">
        <Checkbox
          checked={repeatWeekday}
          onChange={setRepeatWeekday}
          label="이번 달 같은 요일 전체 적용"
          size="sm"
        />
      </View>

      {/* 선택 날짜 배치 상세(행 탭 → 편집) — 직접 렌더(가상화 없음), 스크롤은 상위 담당 */}
      <View className="mt-1">
        <VenueDayDetail
          venueId={venueId}
          date={date}
          onSlotPress={setEditingSlot}
          onAddPress={() => setAddVisible(true)}
        />
      </View>

      {/* 인원 추가 시트 — weeklyGrid 무효화는 useConfirmedStaff.addStaff(W-1)가 담당 */}
      <AddSlotSheet
        visible={addVisible}
        onClose={() => setAddVisible(false)}
        containerId={venueId}
        date={date}
      />

      {/* 슬롯 편집 시트 — useUpdateSlot/useDeleteSlot 이 weeklyGrid.all 무효화 */}
      <EditSlotSheet
        visible={editingSlot !== null}
        onClose={() => setEditingSlot(null)}
        slot={editingSlot}
        date={date}
        siblingSlots={siblingSlots}
        editedBy={editedBy}
      />
    </View>
  );
}

export default VenueDayPanel;
