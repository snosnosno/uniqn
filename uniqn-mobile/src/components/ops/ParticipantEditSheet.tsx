/**
 * 결함③ — 참가자 등록 정보 정정 시트(SheetModal): 이름 / 국적 / 연락처.
 *
 * 이 시트가 없던 동안은 **이름 오타조차 고칠 수 없었다**(정정 RPC 0개). 서버
 * `ops_update_participant` 가 값을 재검증하고(1~100자 · XSS 패턴 · 50/30자 상한),
 * 무변경 저장은 서버에서 no-op 이 되어 감사 로그를 오염시키지 않는다.
 *
 * ⚠️ 프리필 effect 의 deps 는 **원시값**(participantId)이다. `participant` 객체를 의존성에 두면
 *   상위 액션시트가 매 렌더 새 객체를 만드는 순간 재발화해, ops_participants realtime
 *   invalidate → refetch → 재렌더마다 **입력 중이던 값이 스냅샷으로 되돌아간다.**
 *   되돌아간 값은 zod 도 서버도 유효해서 어느 방어층에도 안 걸린다(결함① ChipCountSheet 가
 *   실제로 밟은 함정 · 선례 WorkLogEditSheet.tsx:243-255).
 */
import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { useUpdateParticipant } from '@/hooks/ops';

interface Props {
  visible: boolean;
  onClose: () => void;
  participant: {
    id: string;
    name: string;
    entryNumber: number | null;
    nationality?: string | null;
    phone?: string | null;
  } | null;
  tournamentId: string;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  keyboardType,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  maxLength: number;
  keyboardType?: 'default' | 'phone-pad';
  hint?: string;
}) {
  return (
    <View className="gap-1">
      <Text className="text-sm text-secondary-500 dark:text-secondary-400">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        maxLength={maxLength}
        keyboardType={keyboardType ?? 'default'}
        accessibilityLabel={label}
        className="min-h-[44px] rounded-md border border-gray-200 px-3 text-content-primary dark:border-gray-700 dark:text-off-white"
      />
      {hint ? (
        <Text className="text-xs text-secondary-500 dark:text-secondary-400">{hint}</Text>
      ) : null}
    </View>
  );
}

export function ParticipantEditSheet({ visible, onClose, participant, tournamentId }: Props) {
  const updateMut = useUpdateParticipant(tournamentId);
  const [name, setName] = useState('');
  const [nationality, setNationality] = useState('');
  const [phone, setPhone] = useState('');
  const participantId = participant?.id ?? null;

  useEffect(() => {
    if (visible && participantId !== null) {
      setName(participant?.name ?? '');
      setNationality(participant?.nationality ?? '');
      setPhone(participant?.phone ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 열림·대상 전환에만 반응한다(위 주석)
  }, [visible, participantId]);

  if (!participant) return null;

  const canSave = name.trim().length > 0 && !updateMut.isPending;

  const onSave = () => {
    updateMut.mutate(
      // 빈 문자열 → null(지우기) 정규화는 스키마 transform 이 한다 — 서버와 같은 규칙.
      { participantId: participant.id, name, nationality, phone },
      { onSuccess: onClose }
    );
  };

  const footer = (
    <Pressable
      onPress={onSave}
      disabled={!canSave}
      accessibilityRole="button"
      className={`min-h-[44px] items-center justify-center rounded-md ${
        canSave ? 'bg-primary-600 active:opacity-70' : 'bg-gray-300 dark:bg-gray-700'
      }`}
    >
      <Text className="font-sans-semibold text-white">
        {updateMut.isPending ? '저장 중…' : '정보 저장'}
      </Text>
    </Pressable>
  );

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title={`#${participant.entryNumber ?? ''} 정보 수정`}
      isLoading={updateMut.isPending}
      footer={footer}
    >
      <View className="gap-4 px-4 py-4">
        <Field
          label="이름"
          value={name}
          onChange={setName}
          placeholder="참가자 이름"
          maxLength={100}
        />
        <Field
          label="국적"
          value={nationality}
          onChange={setNationality}
          placeholder="예: KR"
          maxLength={50}
          hint="비우면 국적 정보가 지워집니다."
        />
        <Field
          label="연락처"
          value={phone}
          onChange={setPhone}
          placeholder="010-1234-5678"
          maxLength={30}
          keyboardType="phone-pad"
          hint="비우면 연락처가 지워집니다."
        />
      </View>
    </SheetModal>
  );
}
