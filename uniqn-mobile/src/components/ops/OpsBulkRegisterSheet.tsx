/**
 * 명단 붙여넣기 등록(모바일) — 엑셀·카톡에서 복사한 줄들을 미리 보고 한 번에 등록한다.
 *
 * 서버가 전부 성공하거나 전부 취소하므로(원자성), 오류가 있는 줄이 하나라도 있으면 등록 버튼을 막는다.
 * 줄 해석(번호 떼기·전화번호 가르기·중복 표시)은 웹 콘솔과 같은 순수 함수(`domains/ops/roster`)를 쓴다.
 *
 * 🔑 실패 사유는 **시트 안에** 보여 준다. 네이티브 토스트는 앱 루트에 떠서 모달 창 위로 올라오지 못하는데
 *    (ToastManager 주석), 이 시트는 화면 전체를 덮는다 — 토스트에만 기대면 등록이 왜 안 됐는지 알 길이 없다
 *    (오프라인·입력 중 자동 마감·서버 검증 실패 모두 버튼만 되돌아온다).
 */
import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SheetModal } from '@/components/ui';
import { parseRoster, type RosterRow } from '@/domains/ops';
import { extractUserMessage } from '@/errors';
import { useRegisterParticipantsBulk } from '@/hooks/ops';
import { BULK_REGISTER_MAX } from '@/schemas/opsParticipant.schema';
import { parseAmount } from './payoutRows';

interface OpsBulkRegisterSheetProps {
  tournamentId: string;
  visible: boolean;
  onClose: () => void;
  /** 이미 등록된 이름 — 같은 이름은 막지 않고 표시만 한다(동명이인은 실제로 있다) */
  existingNames: readonly string[];
}

/** 미리보기에 그리는 최대 줄 수 — 200명을 다 그리면 키 입력마다 수백 노드를 다시 그린다. */
export const BULK_PREVIEW_MAX = 30;

/**
 * 미리보기에 올릴 줄 — 확인이 필요한 줄(오류·경고)을 빠짐없이 먼저 고르고, 남는 자리에 문제없는 줄을 앞에서부터 채운다.
 * 순서는 붙여넣은 줄 순서 그대로(오류 줄을 명단에서 찾기 쉽게).
 */
export function pickPreviewRows(
  rows: readonly RosterRow[],
  max: number = BULK_PREVIEW_MAX
): RosterRow[] {
  const flagged = rows.filter((r) => r.error || r.warning);
  const room = Math.max(0, max - flagged.length);
  const clean = rows.filter((r) => !r.error && !r.warning).slice(0, room);
  const picked = new Set([...flagged, ...clean]);
  return rows.filter((r) => picked.has(r));
}

export function OpsBulkRegisterSheet({
  tournamentId,
  visible,
  onClose,
  existingNames,
}: OpsBulkRegisterSheetProps) {
  const registerMut = useRegisterParticipantsBulk(tournamentId);

  const close = () => {
    // 닫을 때 지난 실패 기록을 지운다 — 다시 열었을 때 옛 오류가 떠 있지 않게.
    registerMut.reset();
    onClose();
  };

  return (
    <SheetModal
      visible={visible}
      onClose={close}
      title="명단 붙여넣기"
      // 등록 중에는 닫지 않는다 — 닫고 새 명단을 적는 사이 앞 요청이 끝나면 새 입력이 지워진다.
      isLoading={registerMut.isPending}
      fullHeight
    >
      {/* 열 때마다 빈 폼에서 시작한다(직전 명단·바이인 금액이 다음 등록에 남지 않게 — 웹 콘솔과 같다).
          1조에 적다 만 바이인이 2조 명단 전원에게 기록되는 일을 막는다. */}
      {visible ? (
        <BulkRegisterForm
          existingNames={existingNames}
          isPending={registerMut.isPending}
          errorMessage={registerMut.error ? extractUserMessage(registerMut.error) : null}
          onEdit={() => {
            // 고치기 시작하면 지난 실패 안내를 내린다(같은 오류가 계속 떠 있으면 고쳐도 안 된 줄 안다).
            if (registerMut.error) registerMut.reset();
          }}
          onSubmit={(input) => registerMut.mutate(input, { onSuccess: onClose })}
        />
      ) : null}
    </SheetModal>
  );
}

interface BulkRegisterFormProps {
  existingNames: readonly string[];
  isPending: boolean;
  /** 직전 등록 실패 사유(없으면 null) */
  errorMessage: string | null;
  onEdit: () => void;
  onSubmit: (input: { rows: { name: string; phone?: string }[]; buyInAmount?: number }) => void;
}

function BulkRegisterForm({
  existingNames,
  isPending,
  errorMessage,
  onEdit,
  onSubmit,
}: BulkRegisterFormProps) {
  const [text, setText] = useState('');
  const [buyIn, setBuyIn] = useState('');

  const parsed = useMemo(() => parseRoster(text, existingNames), [text, existingNames]);
  const preview = useMemo(() => pickPreviewRows(parsed.rows), [parsed.rows]);
  const hiddenCount = parsed.rows.length - preview.length;
  // 숫자가 하나도 없는 금액("abc")은 0원으로 기록하지 않고 막는다.
  const buyInInvalid = buyIn.trim() !== '' && !/\d/.test(buyIn);
  const blocked =
    isPending ||
    parsed.rows.length === 0 ||
    parsed.errorCount > 0 ||
    parsed.overLimit ||
    buyInInvalid;

  const submit = () => {
    if (blocked) return;
    onSubmit({
      rows: parsed.rows.map((r) => ({ name: r.name, phone: r.phone })),
      buyInAmount: buyIn.trim() ? parseAmount(buyIn) : undefined,
    });
  };

  return (
    <View className="gap-3 px-4 py-2">
      <Text className="text-sm text-secondary-500 dark:text-secondary-400">
        한 줄에 한 명씩 붙여넣으세요. 이름 옆에 연락처가 있으면 함께 등록해요. 한 번에{' '}
        {BULK_REGISTER_MAX}명까지.
      </Text>

      <View>
        <Text className="mb-1 font-sans-semibold text-xs text-secondary-600 dark:text-secondary-400">
          명단
        </Text>
        {/* 높이를 묶는다 — 200줄을 붙이면 입력란이 200줄로 자라 아래 칸(바이인·미리보기)이 수천 px 밀린다. */}
        <TextInput
          value={text}
          onChangeText={(next) => {
            setText(next);
            onEdit();
          }}
          multiline
          scrollEnabled
          textAlignVertical="top"
          autoCorrect={false}
          autoCapitalize="none"
          placeholder={'홍길동\n김철수 010-1234-5678\n3. 이영희'}
          placeholderTextColor="#9CA3AF"
          accessibilityLabel="등록할 명단"
          className="h-[160px] rounded-md border border-gray-300 px-3 py-2 text-content-primary dark:border-gray-700 dark:text-off-white"
        />
      </View>

      {/* 바이인은 미리보기 위에 둔다 — 명단이 길어도 스크롤 없이 닿게. */}
      <View>
        <Text className="mb-1 font-sans-semibold text-xs text-secondary-600 dark:text-secondary-400">
          바이인 금액 (선택 · 전원 같은 금액)
        </Text>
        <TextInput
          value={buyIn}
          onChangeText={(next) => {
            setBuyIn(next);
            onEdit();
          }}
          placeholder="입력 안 함"
          placeholderTextColor="#9CA3AF"
          keyboardType="number-pad"
          accessibilityLabel="바이인 금액"
          className="rounded-md border border-gray-300 px-3 py-2 text-content-primary dark:border-gray-700 dark:text-off-white"
        />
        {buyInInvalid ? (
          <Text className="mt-1 text-xs text-error-600 dark:text-error-400">
            금액은 숫자로 입력해 주세요
          </Text>
        ) : null}
      </View>

      {errorMessage !== null ? (
        <View
          accessibilityRole="alert"
          className="rounded-md border border-error-200 bg-error-50 p-3 dark:border-error-700 dark:bg-error-900/20"
        >
          <Text className="font-sans-semibold text-sm text-error-700 dark:text-error-300">
            등록하지 못했어요
          </Text>
          <Text className="mt-1 text-sm text-error-700 dark:text-error-300">
            {errorMessage || '잠시 후 다시 시도해 주세요.'}
          </Text>
          <Text className="mt-1 text-xs text-error-700 dark:text-error-300">
            한 명도 등록되지 않았어요. 명단은 그대로 있으니 확인한 뒤 다시 등록해 주세요.
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={submit}
        disabled={blocked}
        accessibilityRole="button"
        accessibilityLabel={`${parsed.validCount}명 등록`}
        accessibilityState={{ disabled: blocked }}
        className={`min-h-[48px] items-center justify-center rounded-md ${blocked ? 'bg-gray-300 dark:bg-gray-700' : 'bg-primary-600 active:opacity-70'}`}
      >
        <Text className="font-sans-semibold text-white">
          {isPending ? '등록 중…' : `${parsed.validCount}명 등록`}
        </Text>
      </Pressable>

      {parsed.rows.length > 0 ? (
        <View className="gap-2">
          <Text
            accessibilityLiveRegion="polite"
            className="text-sm text-content-primary dark:text-off-white"
          >
            {parsed.validCount}명 등록 예정
            {parsed.errorCount > 0 ? ` · 오류 ${parsed.errorCount}줄` : ''}
            {parsed.overLimit ? ` · ${BULK_REGISTER_MAX}명을 넘었어요. 나눠서 등록해 주세요.` : ''}
          </Text>

          {parsed.errorCount > 0 ? (
            <Text className="text-xs text-secondary-500 dark:text-secondary-400">
              오류가 있는 줄을 고치거나 지워야 등록할 수 있어요. 한 줄이라도 틀리면 전체가 등록되지
              않아요.
            </Text>
          ) : null}

          <View className="rounded-md border border-gray-200 dark:border-gray-700">
            {preview.map((r, index) => (
              <View
                key={r.line}
                className={`flex-row items-start gap-2 px-3 py-2 ${index > 0 ? 'border-t border-gray-200 dark:border-gray-700' : ''}`}
              >
                <Text className="w-8 text-right text-xs text-secondary-500 dark:text-secondary-400">
                  {r.line}
                </Text>
                <View className="flex-1">
                  <Text
                    className="font-sans-semibold text-content-primary dark:text-off-white"
                    numberOfLines={1}
                  >
                    {r.name || '—'}
                    {r.phone ? (
                      <Text className="font-sans text-xs text-secondary-500 dark:text-secondary-400">
                        {`  ${r.phone}`}
                      </Text>
                    ) : null}
                  </Text>
                  {r.error ? (
                    <Text className="text-xs text-error-600 dark:text-error-400">{r.error}</Text>
                  ) : r.warning ? (
                    <Text className="text-xs text-warning-700 dark:text-warning-300">
                      {r.warning}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
          {hiddenCount > 0 ? (
            <Text className="text-xs text-secondary-500 dark:text-secondary-400">
              문제없는 {hiddenCount}명은 줄여서 보여 드려요. 확인이 필요한 줄은 모두 위에 있어요.
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
