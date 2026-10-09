/**
 * 명단 붙여넣기 등록(모바일) — 엑셀·카톡에서 복사한 줄들을 미리 보고 한 번에 등록한다.
 *
 * 서버가 전부 성공하거나 전부 취소하므로(원자성), 오류가 있는 줄이 하나라도 있으면 등록 버튼을 막는다.
 * 줄 해석(번호 떼기·전화번호 가르기·중복 표시)은 웹 콘솔과 같은 순수 함수(`domains/ops/roster`)를 쓴다.
 */
import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SheetModal } from '@/components/ui';
import { parseRoster } from '@/domains/ops';
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

export function OpsBulkRegisterSheet({
  tournamentId,
  visible,
  onClose,
  existingNames,
}: OpsBulkRegisterSheetProps) {
  const registerMut = useRegisterParticipantsBulk(tournamentId);
  const [text, setText] = useState('');
  const [buyIn, setBuyIn] = useState('');

  const parsed = useMemo(() => parseRoster(text, existingNames), [text, existingNames]);
  // 숫자가 하나도 없는 금액("abc")은 0원으로 기록하지 않고 막는다.
  const buyInInvalid = buyIn.trim() !== '' && !/\d/.test(buyIn);
  const blocked =
    registerMut.isPending ||
    parsed.rows.length === 0 ||
    parsed.errorCount > 0 ||
    parsed.overLimit ||
    buyInInvalid;

  const reset = () => {
    setText('');
    setBuyIn('');
  };

  const submit = () => {
    if (blocked) return;
    registerMut.mutate(
      {
        rows: parsed.rows.map((r) => ({ name: r.name, phone: r.phone })),
        buyInAmount: buyIn.trim() ? parseAmount(buyIn) : undefined,
      },
      {
        // 성공했을 때만 비운다 — 실패하면 붙여넣은 명단을 그대로 두어 고쳐서 다시 보낼 수 있게.
        onSuccess: () => {
          reset();
          onClose();
        },
      }
    );
  };

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title="명단 붙여넣기"
      // 등록 중에는 닫지 않는다 — 닫고 새 명단을 적는 사이 앞 요청이 끝나면 새 입력이 지워진다.
      isLoading={registerMut.isPending}
      fullHeight
      footer={
        <Pressable
          onPress={submit}
          disabled={blocked}
          accessibilityRole="button"
          accessibilityLabel={`${parsed.validCount}명 등록`}
          accessibilityState={{ disabled: blocked }}
          className={`min-h-[48px] items-center justify-center rounded-md ${blocked ? 'bg-gray-300 dark:bg-gray-700' : 'bg-primary-600 active:opacity-70'}`}
        >
          <Text className="font-sans-semibold text-white">
            {registerMut.isPending ? '등록 중…' : `${parsed.validCount}명 등록`}
          </Text>
        </Pressable>
      }
    >
      <View className="gap-3 px-4 py-2">
        <Text className="text-sm text-secondary-500 dark:text-secondary-400">
          한 줄에 한 명씩 붙여넣으세요. 이름 옆에 연락처가 있으면 함께 등록해요. 한 번에{' '}
          {BULK_REGISTER_MAX}명까지.
        </Text>

        <View>
          <Text className="mb-1 font-sans-semibold text-xs text-secondary-600 dark:text-secondary-400">
            명단
          </Text>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            textAlignVertical="top"
            autoCorrect={false}
            autoCapitalize="none"
            placeholder={'홍길동\n김철수 010-1234-5678\n3. 이영희'}
            placeholderTextColor="#9CA3AF"
            accessibilityLabel="등록할 명단"
            className="min-h-[140px] rounded-md border border-gray-300 px-3 py-2 text-content-primary dark:border-gray-700 dark:text-off-white"
          />
        </View>

        {parsed.rows.length > 0 ? (
          <View className="gap-2">
            <Text
              accessibilityLiveRegion="polite"
              className="text-sm text-content-primary dark:text-off-white"
            >
              {parsed.validCount}명 등록 예정
              {parsed.errorCount > 0 ? ` · 오류 ${parsed.errorCount}줄` : ''}
              {parsed.overLimit
                ? ` · ${BULK_REGISTER_MAX}명을 넘었어요. 나눠서 등록해 주세요.`
                : ''}
            </Text>

            <View className="rounded-md border border-gray-200 dark:border-gray-700">
              {parsed.rows.map((r, index) => (
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

            {parsed.errorCount > 0 ? (
              <Text className="text-xs text-secondary-500 dark:text-secondary-400">
                오류가 있는 줄을 고치거나 지워야 등록할 수 있어요. 한 줄이라도 틀리면 전체가
                등록되지 않아요.
              </Text>
            ) : null}
          </View>
        ) : null}

        <View>
          <Text className="mb-1 font-sans-semibold text-xs text-secondary-600 dark:text-secondary-400">
            바이인 금액 (선택 · 전원 같은 금액)
          </Text>
          <TextInput
            value={buyIn}
            onChangeText={setBuyIn}
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
      </View>
    </SheetModal>
  );
}
