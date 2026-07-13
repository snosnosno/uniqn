/**
 * TitleSheet — 공고 제목 입력 시트 (주문서 기본정보)
 *
 * @description 텍스트 입력(25자 카운터) + 최근 제목 칩. onConfirm 은 trim 된 제목을 부모로
 * 흘려보내고, 부모(OrderSheetScreen)가 form.setValue(shouldValidate) 로 zod safeText(XSS) 경계를 태운다.
 * SheetModal(단일) 내부 렌더 — 중첩 Modal 없음(#186/#243 회피).
 */
import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { useThemeStore } from '@/stores/themeStore';
import { SECONDARY_PALETTE } from '@/constants/colors';

export interface TitleSheetProps {
  visible: boolean;
  value: string;
  /** 프리셋(Task 9) 템플릿 title 들 — 그 전까지 빈 배열 */
  recentTitles: string[];
  onConfirm: (next: string) => void;
  onClose: () => void;
}

export function TitleSheet({ visible, value, recentTitles, onConfirm, onClose }: TitleSheetProps) {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const [text, setText] = useState(value);
  // 재오픈 시 부모의 현재 값으로 동기화(이전 편집 잔존 방지)
  useEffect(() => {
    if (visible) setText(value);
  }, [visible, value]);

  const trimmed = text.trim();

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title="공고 제목"
      footer={
        <Button
          onPress={() => {
            onConfirm(trimmed);
            onClose();
          }}
          disabled={trimmed.length === 0}
        >
          확인
        </Button>
      }
    >
      <TextInput
        value={text}
        onChangeText={setText}
        maxLength={25}
        placeholder="예: 주말 딜러 구합니다"
        placeholderTextColor={isDarkMode ? SECONDARY_PALETTE[500] : SECONDARY_PALETTE[400]}
        className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 text-content-primary font-sans"
        testID="order-sheet-title-input"
      />
      <Text className="text-xs text-content-muted mt-1 mb-3 text-right font-sans">
        {text.length}/25
      </Text>
      {recentTitles.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {recentTitles.map((t) => (
            <Pressable
              key={t}
              onPress={() => setText(t)}
              className="px-3 py-1.5 min-h-[44px] justify-center rounded-full border border-secondary-200 dark:border-surface-overlay active:opacity-80"
              accessibilityRole="button"
              accessibilityLabel={`최근 제목 ${t}`}
            >
              <Text className="text-xs text-content-secondary font-sans">{t}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </SheetModal>
  );
}
