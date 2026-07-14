/**
 * DescriptionSheet — 상세 설명 시트 (주문서 기본정보, optional)
 *
 * @description multiline 입력(500자 카운터). 설명은 선택 항목이라 빈 값 확정 허용. onConfirm 은
 * trim 된 설명을 부모로 흘려보내고, 부모가 form.setValue(shouldValidate) 로 zod safeText(XSS·max500)
 * 경계를 태운다. 단일 SheetModal 렌더.
 */
import React, { useEffect, useState } from 'react';
import { Text, TextInput } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { useThemeStore } from '@/stores/themeStore';
import { SECONDARY_PALETTE } from '@/constants/colors';

export interface DescriptionSheetProps {
  visible: boolean;
  value: string;
  onConfirm: (next: string) => void;
  onClose: () => void;
}

export function DescriptionSheet({ visible, value, onConfirm, onClose }: DescriptionSheetProps) {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const [text, setText] = useState(value);
  // 재오픈 시 부모의 현재 값으로 동기화
  useEffect(() => {
    if (visible) setText(value);
  }, [visible, value]);

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title="상세 설명"
      footer={
        <Button
          onPress={() => {
            onConfirm(text.trim());
            onClose();
          }}
        >
          확인
        </Button>
      }
    >
      <TextInput
        value={text}
        onChangeText={setText}
        maxLength={500}
        multiline
        textAlignVertical="top"
        placeholder="복장·우대사항·유의사항 등 자유롭게 적어주세요 (선택)"
        placeholderTextColor={isDarkMode ? SECONDARY_PALETTE[500] : SECONDARY_PALETTE[400]}
        testID="order-sheet-description-input"
        className="min-h-[140px] rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 text-content-primary font-sans"
      />
      <Text className="text-xs text-content-muted mt-1 text-right font-sans">
        {text.length}/500
      </Text>
    </SheetModal>
  );
}
