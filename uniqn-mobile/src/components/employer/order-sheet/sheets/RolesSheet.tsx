/**
 * RolesSheet — 고정(fixed) 역할 시트
 *
 * @description 편집 UI는 RoleCountEditor 가 전담하고 이 시트는 SheetModal 껍데기 + 확인 계약만 갖는다.
 * 날짜형(dated)은 ScheduleSlotsSheet 가 같은 편집기를 슬롯 카드 안에 인라인으로 쓴다 —
 * 두 경로의 역할 입력 방식이 자동으로 일치한다.
 * onConfirm 으로 흘려보내면 부모가 form.setValue 로 zod safeText(customRole XSS·max20) 경계를 태운다.
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { RoleCountEditor, type SlotRoles } from './RoleCountEditor';

export interface RolesSheetProps {
  visible: boolean;
  value: SlotRoles;
  onConfirm: (next: SlotRoles) => void;
  onClose: () => void;
}

export function RolesSheet({ visible, value, onConfirm, onClose }: RolesSheetProps) {
  const [roles, setRoles] = useState<SlotRoles>(value);

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title="어떤 역할이 필요하세요?"
      footer={
        <Button
          onPress={() => {
            onConfirm(roles);
            onClose();
          }}
          disabled={roles.length === 0}
        >
          확인
        </Button>
      }
    >
      <View className="px-4 pt-3 pb-2">
        <RoleCountEditor roles={roles} onChange={setRoles} />
      </View>
    </SheetModal>
  );
}
