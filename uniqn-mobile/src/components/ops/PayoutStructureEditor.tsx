/**
 * ops 1f — PAYOUTS 구조 편집기(스펙 §7.1 A): 금액 | % 두 모드.
 * 금액 모드: 행 추가/삭제 + rank 연속 재부여(reindexRows) 저장. 0/빈 행은 검증 에러.
 * % 모드: percents → computeAmountsFromPercents(현재 풀) 원화 병기 + 템플릿 추천.
 * active 저장 시 소급 불가 안내(ConfirmModal — 🔨H18, LEVELS 편집 가드와 동형).
 */
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, useColorScheme } from 'react-native';
import { useOpsPrizes, useSetPrizeStructure, useOpsLiveStats } from '@/hooks/ops';
import { computeAmountsFromPercents, recommendPayoutCurve } from '@/domains/ops';
import type { ItmRatio } from '@/domains/ops';
import { ConfirmModal } from '@/components/ui/Modal';
import { SelectBottomSheet } from '@/components/ui/BottomSheet';
import type { OpsTournament } from '@/types/ops';
import type { PrizeStructureInput } from '@/schemas/opsPrize.schema';
import { fmtKrw, parseAmount, reindexRows } from './payoutRows';

const ITM_RATIOS: ItmRatio[] = [0.1, 0.15, 0.2];
const EMPTY_ROW_ERROR = '금액이 비어 있는 행이 있어요';
const POOL_TOO_SMALL_MSG = '풀이 작아 1,000원/100원 단위 분배가 불가해요';
const invalidPercentsMsg = (sum: number) => `비율 합계가 100이 되어야 해요(현재 ${sum}%)`;

type Mode = 'amount' | 'percent';
type PayloadResult = { ok: true; payload: PrizeStructureInput } | { ok: false; error: string };

export function PayoutStructureEditor({ tournament }: { tournament: OpsTournament }) {
  const { prizes, isLoading } = useOpsPrizes(tournament.id);
  const { stats, refetch: refetchStats } = useOpsLiveStats(tournament.id);
  const setMut = useSetPrizeStructure(tournament.id);
  const colorScheme = useColorScheme();

  const pool = stats?.prizePool ?? 0;
  const entries = stats?.entries ?? 0;

  const [mode, setMode] = useState<Mode>('amount');
  const [rows, setRows] = useState<{ amount: string }[]>([]);
  const [percents, setPercents] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [pending, setPending] = useState<PrizeStructureInput | null>(null);

  // 서버 데이터 도착/갱신 시 미편집 상태면 금액 draft 동기화(편집 중이면 보존).
  useEffect(() => {
    if (!dirty && prizes.length > 0) {
      setRows(
        [...prizes].sort((a, b) => a.rank - b.rank).map((p) => ({ amount: String(p.amount) }))
      );
    }
  }, [prizes, dirty]);

  // % 모드 미리보기(현재 풀 기준 환산). 저장 시에도 동일 함수 재실행.
  const parsedPercents = percents.map((p) => parseFloat(p) || 0);
  const percentSum = Math.round(parsedPercents.reduce((s, p) => s + p, 0) * 100) / 100;
  const curve = computeAmountsFromPercents(pool, parsedPercents);

  const displaySum =
    mode === 'amount'
      ? rows.reduce((s, r) => s + parseAmount(r.amount), 0)
      : curve.ok
        ? curve.amounts.reduce((s, a) => s + a, 0)
        : 0;
  const remaining = pool - displaySum;

  // ── 금액 모드 편집 ──────────────────────────────────────────────
  const addAmountRow = () => {
    setRows((rs) => [...rs, { amount: '' }]);
    setDirty(true);
  };
  const updateAmount = (idx: number, v: string) => {
    setRows((rs) => rs.map((r, i) => (i === idx ? { amount: v } : r)));
    setDirty(true);
    setError(null);
  };
  const removeAmountRow = (idx: number) => {
    setRows((rs) => rs.filter((_, i) => i !== idx));
    setDirty(true);
    setError(null);
  };

  // ── % 모드 편집 ────────────────────────────────────────────────
  const addPercentRow = () => {
    setPercents((ps) => [...ps, '']);
    setDirty(true);
  };
  const updatePercent = (idx: number, v: string) => {
    setPercents((ps) => ps.map((p, i) => (i === idx ? v : p)));
    setDirty(true);
  };
  const removePercentRow = (idx: number) => {
    setPercents((ps) => ps.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const applyTemplate = (ratio: ItmRatio) => {
    setPercents(recommendPayoutCurve(entries, ratio).map(String));
    setMode('percent');
    setDirty(true);
    setError(null);
  };

  // ── 저장 payload 산출(검증 포함) ─────────────────────────────────
  const buildPayload = (): PayloadResult => {
    if (mode === 'percent') {
      if (!curve.ok) {
        return {
          ok: false,
          error:
            curve.reason === 'POOL_TOO_SMALL' ? POOL_TOO_SMALL_MSG : invalidPercentsMsg(percentSum),
        };
      }
      return { ok: true, payload: curve.amounts.map((amount, i) => ({ rank: i + 1, amount })) };
    }
    const parsed = rows.map((r) => parseAmount(r.amount));
    if (rows.length === 0 || parsed.some((a) => a <= 0)) {
      return { ok: false, error: EMPTY_ROW_ERROR };
    }
    // 기존 .filter(amount>0) 제거 — 항상 연속 rank 로 재부여.
    const payload = reindexRows(parsed.map((amount) => ({ amount }))).map((r) => ({
      rank: r.rank,
      amount: r.amount,
    }));
    return { ok: true, payload };
  };

  const doSave = (payload: PrizeStructureInput) => {
    setMut.mutate(payload, { onSuccess: () => setDirty(false) });
  };

  const onSavePress = () => {
    if (setMut.isPending) return;
    const result = buildPayload();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    // 🔨H18: 진행 중(active) 저장은 소급 불가 안내 후 확인(LEVELS 가드와 동형 ConfirmModal).
    if (tournament.status === 'active') {
      setPending(result.payload);
      setConfirmOpen(true);
    } else {
      doSave(result.payload);
    }
  };

  if (isLoading) {
    return (
      <View className="items-center py-10">
        <ActivityIndicator accessibilityRole="progressbar" accessibilityLabel="로딩 중" />
      </View>
    );
  }

  const templateOptions = ITM_RATIOS.map((r) => ({
    label: `ITM ${Math.round(r * 100)}% · ${recommendPayoutCurve(entries, r).length}명 지급`,
    value: String(r),
  }));

  return (
    <View className="gap-3 px-4 py-4">
      {/* 모드 세그먼트 */}
      <View className="flex-row rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
        {(['amount', 'percent'] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            accessibilityRole="button"
            className={`min-h-[44px] flex-1 items-center justify-center rounded-md ${mode === m ? 'bg-white dark:bg-gray-700' : ''}`}
          >
            <Text
              className={`text-sm ${mode === m ? 'font-sans-semibold text-content-primary' : 'text-secondary-500 dark:text-secondary-400'}`}
            >
              {m === 'amount' ? '금액' : '%'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* 템플릿 추천 */}
      <Pressable
        onPress={() => setTemplateOpen(true)}
        accessibilityRole="button"
        className="min-h-[44px] items-center justify-center rounded-md border border-primary-500 active:opacity-70 dark:border-primary-400"
      >
        <Text className="text-sm font-sans-semibold text-primary-600 dark:text-primary-300">
          템플릿 추천 (현재 {entries}엔트리)
        </Text>
      </Pressable>

      {/* ── 금액 모드 ── */}
      {mode === 'amount' &&
        (rows.length === 0 ? (
          <View className="items-center gap-3 py-8">
            <Text className="px-6 text-center text-sm text-secondary-500 dark:text-secondary-400">
              순위별 수령액을 설정하면 탈락 시 자동으로 배정돼요.
            </Text>
            <Pressable
              onPress={addAmountRow}
              accessibilityRole="button"
              className="min-h-[44px] items-center justify-center rounded-md bg-primary-600 px-6 active:opacity-70"
            >
              <Text className="font-sans-semibold text-white">상금 구조 만들기</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {rows.map((r, idx) => (
              <View key={idx} className="flex-row items-center gap-3">
                <Text className="w-10 text-sm text-content-primary dark:text-off-white">
                  {idx + 1}위
                </Text>
                <TextInput
                  value={r.amount}
                  onChangeText={(v) => updateAmount(idx, v)}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  className="min-h-[44px] flex-1 rounded-md border border-gray-200 px-3 text-right text-primary-400 dark:border-gray-700 dark:text-primary-300"
                />
                <Pressable
                  onPress={() => removeAmountRow(idx)}
                  accessibilityRole="button"
                  accessibilityLabel={`${idx + 1}위 삭제`}
                  hitSlop={8}
                  className="min-h-[44px] w-10 items-center justify-center"
                >
                  <Text className="text-lg text-error-600 dark:text-error-400">✕</Text>
                </Pressable>
              </View>
            ))}
            <Pressable
              onPress={addAmountRow}
              accessibilityRole="button"
              className="min-h-[44px] justify-center"
            >
              <Text className="text-sm text-secondary-500 dark:text-secondary-400">
                + 순위 추가
              </Text>
            </Pressable>
          </>
        ))}

      {/* ── % 모드 ── */}
      {mode === 'percent' && (
        <>
          {!curve.ok && percents.length > 0 && (
            <View className="rounded-md bg-amber-50 px-3 py-2 dark:bg-amber-900/30">
              <Text className="text-sm text-amber-600 dark:text-amber-400">
                {curve.reason === 'POOL_TOO_SMALL'
                  ? POOL_TOO_SMALL_MSG
                  : invalidPercentsMsg(percentSum)}
              </Text>
            </View>
          )}
          {percents.map((p, idx) => (
            <View key={idx} className="flex-row items-center gap-2">
              <Text className="w-10 text-sm text-content-primary dark:text-off-white">
                {idx + 1}위
              </Text>
              <TextInput
                value={p}
                onChangeText={(v) => updatePercent(idx, v)}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                className="min-h-[44px] w-16 rounded-md border border-gray-200 px-2 text-right text-primary-400 dark:border-gray-700 dark:text-primary-300"
              />
              <Text className="text-sm text-secondary-500 dark:text-secondary-400">%</Text>
              <Text className="flex-1 text-right text-sm text-content-primary dark:text-off-white">
                {curve.ok ? `${fmtKrw(curve.amounts[idx] ?? 0)}원` : '—'}
              </Text>
              <Pressable
                onPress={() => removePercentRow(idx)}
                accessibilityRole="button"
                accessibilityLabel={`${idx + 1}위 삭제`}
                hitSlop={8}
                className="min-h-[44px] w-8 items-center justify-center"
              >
                <Text className="text-lg text-error-600 dark:text-error-400">✕</Text>
              </Pressable>
            </View>
          ))}
          <View className="flex-row gap-2">
            <Pressable
              onPress={addPercentRow}
              accessibilityRole="button"
              className="min-h-[44px] flex-1 justify-center"
            >
              <Text className="text-sm text-secondary-500 dark:text-secondary-400">
                + 순위 추가
              </Text>
            </Pressable>
            <Pressable
              onPress={() => refetchStats()}
              accessibilityRole="button"
              className="min-h-[44px] items-center justify-center rounded-md border border-gray-200 px-3 active:opacity-70 dark:border-gray-700"
            >
              <Text className="text-sm text-secondary-500 dark:text-secondary-400">
                현재 풀 기준 재계산
              </Text>
            </Pressable>
          </View>
        </>
      )}

      {/* 검증 에러 */}
      {error && <Text className="text-sm text-error-600 dark:text-error-400">{error}</Text>}

      <View className="h-px bg-gray-200 dark:bg-gray-700" />

      {/* 풀 대비 바(참고치 — 저장 차단 안 함) */}
      <View className="flex-row justify-between">
        <Text className="text-xs text-secondary-500 dark:text-secondary-400">
          합계{' '}
          <Text
            className={
              displaySum > pool ? 'text-amber-600 dark:text-amber-400' : 'text-content-primary'
            }
          >
            {fmtKrw(displaySum)}
          </Text>
        </Text>
        <Text className="text-xs text-secondary-500 dark:text-secondary-400">
          현재 풀 {fmtKrw(pool)}
        </Text>
        <Text className="text-xs text-secondary-500 dark:text-secondary-400">
          잔여{' '}
          <Text
            className={
              remaining < 0 ? 'text-amber-600 dark:text-amber-400' : 'text-content-primary'
            }
          >
            {fmtKrw(remaining)}
          </Text>
        </Text>
      </View>

      {/* 저장 */}
      <Pressable
        onPress={onSavePress}
        disabled={setMut.isPending}
        accessibilityRole="button"
        className={`mt-1 min-h-[44px] items-center justify-center rounded-md ${setMut.isPending ? 'bg-gray-300 dark:bg-gray-700' : 'bg-primary-600 active:opacity-70'}`}
      >
        {setMut.isPending ? (
          <ActivityIndicator color={colorScheme === 'dark' ? '#FFFFFF' : '#374151'} />
        ) : (
          <Text className="font-sans-semibold text-white">상금 구조 저장</Text>
        )}
      </Pressable>

      <ConfirmModal
        visible={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          if (pending) doSave(pending);
        }}
        title="상금 구조 저장"
        message="이미 탈락한 참가자에게는 소급되지 않아요. 저장할까요?"
        confirmText="저장"
        cancelText="계속 편집"
      />

      <SelectBottomSheet
        visible={templateOpen}
        onClose={() => setTemplateOpen(false)}
        title="추천 페이아웃 곡선"
        options={templateOptions}
        onSelect={(v) => applyTemplate(parseFloat(v) as ItmRatio)}
      />
    </View>
  );
}

export default PayoutStructureEditor;
