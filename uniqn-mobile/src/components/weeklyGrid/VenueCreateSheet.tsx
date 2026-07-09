/**
 * VenueCreateSheet — 운영처(컨테이너) 생성 시트.
 *
 * 빈 상태 버튼 / 선택기 "+ 운영처 추가" 두 진입점이 공유하는 단일 컴포넌트.
 * v1: 이름만 입력(kind='dated' 고정). 제출 → useCreateVenueContainer → get-or-create(멱등).
 * 성공 시 onCreated(c) 호출(시트 닫기는 호출부 onCreated 책임). 토스트는 이 컴포넌트(호출부) 책임.
 * 닫힐 때 입력 초기화.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToastStore } from '@/stores/toastStore';
import { useCreateVenueContainer } from '@/hooks/weeklyGrid';
import { isAppError } from '@/errors';
import type { VenueContainer } from '@/domains/weeklyGrid';

export interface VenueCreateSheetProps {
  visible: boolean;
  workspaceId: string | undefined;
  onClose: () => void;
  onCreated: (container: VenueContainer) => void;
}

export function VenueCreateSheet({
  visible,
  workspaceId,
  onClose,
  onCreated,
}: VenueCreateSheetProps) {
  const [name, setName] = useState('');
  // mutate 는 안정적 참조, isPending 만 상태 변화 → 콜백/JSX 불필요 재생성 방지 위해 분해.
  const { mutate, isPending } = useCreateVenueContainer(workspaceId);
  const toastSuccess = useToastStore((s) => s.success);
  const toastError = useToastStore((s) => s.error);

  // 닫힐 때 입력 초기화(재오픈 시 이전 값 잔존 방지).
  useEffect(() => {
    if (!visible) setName('');
  }, [visible]);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !!workspaceId && !isPending;

  const handleSubmit = useCallback(() => {
    const value = name.trim();
    if (!value || !workspaceId || isPending) return;
    mutate(value, {
      onSuccess: (container) => {
        toastSuccess('운영처를 만들었어요.');
        onCreated(container);
      },
      onError: (err) => {
        const msg =
          isAppError(err) && err.userMessage ? err.userMessage : '운영처 생성에 실패했어요.';
        toastError(msg);
      },
    });
  }, [name, workspaceId, isPending, mutate, toastSuccess, toastError, onCreated]);

  const footer = (
    <View className="flex-row gap-2 p-4">
      <Button variant="outline" onPress={onClose} className="flex-1" accessibilityLabel="취소">
        취소
      </Button>
      <Button
        variant="primary"
        onPress={handleSubmit}
        disabled={!canSubmit}
        loading={isPending}
        className="flex-1"
        accessibilityLabel="운영처 만들기"
      >
        만들기
      </Button>
    </View>
  );

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title="운영처 만들기"
      isLoading={isPending}
      footer={footer}
    >
      <View className="p-5">
        <Input
          label="운영처 이름"
          value={name}
          onChangeText={setName}
          placeholder="예: 강남 홀덤펍"
          onSubmitEditing={handleSubmit}
          returnKeyType="done"
          maxLength={40}
        />
      </View>
    </SheetModal>
  );
}
