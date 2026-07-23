/**
 * ops 참가 등록 시트(L7) — FAB 진입.
 * 현행 인라인 폼(리스트 밀림)을 대체(스펙 결정: 인라인 토글 폼 제거 → FAB "등록" → 시트).
 * 필드마다 명시 라벨(디자인 리뷰 지적: placeholder-as-label 제거, placeholder 는 예시로만 유지).
 * SheetModal 은 ModalKeyboardAvoider 내장 → 키보드 보정 자동. 중첩 gorhom 피커 없음(단순 시트).
 */
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SheetModal } from '@/components/ui';
import { useRegisterParticipant } from '@/hooks/ops';

interface OpsRegisterParticipantSheetProps {
  tournamentId: string;
  visible: boolean;
  onClose: () => void;
}

/** 필드 위 명시 라벨(모듈 스코프 — 렌더마다 재생성 방지). */
function FieldLabel({ text, required }: { text: string; required?: boolean }) {
  return (
    <Text className="mb-1 font-sans-semibold text-xs text-secondary-600 dark:text-secondary-400">
      {text}
      {required ? <Text className="text-error-600 dark:text-error-400"> *</Text> : null}
    </Text>
  );
}

export function OpsRegisterParticipantSheet({
  tournamentId,
  visible,
  onClose,
}: OpsRegisterParticipantSheetProps) {
  const registerMut = useRegisterParticipant(tournamentId);

  const [name, setName] = useState('');
  const [nationality, setNationality] = useState('');
  const [phone, setPhone] = useState('');
  const [buyIn, setBuyIn] = useState('');

  const resetFields = () => {
    setName('');
    setNationality('');
    setPhone('');
    setBuyIn('');
  };

  const canSubmit = name.trim().length > 0 && !registerMut.isPending;

  const submitRegister = () => {
    if (!canSubmit) return;
    registerMut.mutate(
      {
        name: name.trim(),
        nationality: nationality.trim() || undefined,
        phone: phone.trim() || undefined,
        buyInAmount: buyIn.trim() ? parseInt(buyIn.replace(/[^0-9]/g, ''), 10) : undefined,
      },
      {
        onSuccess: () => {
          resetFields();
          onClose();
        },
      }
    );
  };

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title="참가 등록"
      isLoading={registerMut.isPending}
      footer={
        <Pressable
          onPress={submitRegister}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel="등록"
          accessibilityState={{ disabled: !canSubmit }}
          className={`min-h-[48px] items-center justify-center rounded-md ${canSubmit ? 'bg-primary-600 active:opacity-70' : 'bg-gray-300 dark:bg-gray-700'}`}
        >
          <Text className="font-sans-semibold text-white">
            {registerMut.isPending ? '등록 중…' : '등록'}
          </Text>
        </Pressable>
      }
    >
      <View className="gap-3 px-4 py-2">
        <View>
          <FieldLabel text="이름" required />
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="예: 홍길동"
            placeholderTextColor="#9CA3AF"
            maxLength={50}
            accessibilityLabel="참가자 이름"
            className="rounded-md border border-gray-300 px-3 py-2 text-content-primary dark:border-gray-700 dark:text-off-white"
          />
        </View>
        <View>
          <FieldLabel text="국적" />
          <TextInput
            value={nationality}
            onChangeText={setNationality}
            placeholder="예: KR"
            placeholderTextColor="#9CA3AF"
            accessibilityLabel="국적"
            className="rounded-md border border-gray-300 px-3 py-2 text-content-primary dark:border-gray-700 dark:text-off-white"
          />
        </View>
        <View>
          <FieldLabel text="바이인 금액" />
          <TextInput
            value={buyIn}
            onChangeText={setBuyIn}
            placeholder="예: 100000"
            placeholderTextColor="#9CA3AF"
            keyboardType="number-pad"
            accessibilityLabel="바이인 금액"
            className="rounded-md border border-gray-300 px-3 py-2 text-content-primary dark:border-gray-700 dark:text-off-white"
          />
        </View>
        <View>
          <FieldLabel text="전화번호" />
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="예: 010-1234-5678"
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            accessibilityLabel="전화번호"
            className="rounded-md border border-gray-300 px-3 py-2 text-content-primary dark:border-gray-700 dark:text-off-white"
          />
        </View>
      </View>
    </SheetModal>
  );
}
