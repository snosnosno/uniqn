/**
 * TaxSheet — 세금 설정 시트 (주문서 급여·선택)
 *
 * @description 기존 TaxSettingsEditor(없음/세율/고정금액 인라인 라디오)를 래핑한다. 공고 기본은
 * 세금 미설정('세금 없음')이라 신규 공고엔 taxSettings가 없다 — 시트를 열면 3.3%가 제안값으로
 * 시드되고 [확인]을 눌러야만 반영된다(닫기만 하면 미설정 유지). 이는 의도된 제안 동작(2026-07-14 결정) —
 * 실수로 원천징수가 붙는 금전 사고를 막으면서도 흔한 3.3%를 한 번에 고르게 한다. 단일 SheetModal.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { TaxSettingsEditor } from '@/components/employer/settlement/TaxSettingsEditor';
import type { TaxSettings } from '@/types/jobPosting';

export interface TaxSheetProps {
  visible: boolean;
  value: TaxSettings | undefined;
  onConfirm: (next: TaxSettings) => void;
  onClose: () => void;
}

export function TaxSheet({ visible, value, onConfirm, onClose }: TaxSheetProps) {
  // 미설정이면 3.3%를 제안값으로 시드 — 확인해야만 반영(닫기=미설정 유지)
  const [settings, setSettings] = useState<TaxSettings>(value ?? { type: 'rate', value: 3.3 });

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title="세금 설정"
      footer={
        <Button
          onPress={() => {
            onConfirm(settings);
            onClose();
          }}
        >
          확인
        </Button>
      }
    >
      <View className="px-4 pt-3 pb-2">
        <TaxSettingsEditor
          taxSettings={settings}
          onChange={setSettings}
          showLabel={false}
          showPreview={false}
        />
      </View>
    </SheetModal>
  );
}
