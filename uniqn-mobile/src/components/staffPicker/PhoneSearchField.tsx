/**
 * PhoneSearchField — 전화번호 정확일치 검색 폼
 *
 * 전화번호 입력(Input) + 검색 버튼(Button)으로 구성된 순수 표현(presentational) 프리미티브.
 * 그리드 인원 추가 시트(AddSlotSheet)와 스태프 직접추가 모달(AddStaffModal)이 공유한다.
 *
 * 검색 로직(useStaffPhoneSearch)은 호출부에 남긴다 — 이 컴포넌트는 값·콜백만 받는다.
 * 개인정보 보호를 위해 전화번호 전체가 정확히 일치해야 검색된다(hint 명시).
 */
import React from 'react';
import { View } from 'react-native';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SearchIcon } from '@/components/icons';
import { SECONDARY_PALETTE } from '@/constants/colors';

export interface PhoneSearchFieldProps {
  phone: string;
  onChangePhone: (value: string) => void;
  onSearch: () => void;
  isSearching: boolean;
}

export function PhoneSearchField({
  phone,
  onChangePhone,
  onSearch,
  isSearching,
}: PhoneSearchFieldProps) {
  return (
    <View className="flex-row items-end gap-2">
      <View className="flex-1">
        <Input
          label="전화번호"
          value={phone}
          onChangeText={onChangePhone}
          placeholder="등록된 전화번호 전체 입력"
          keyboardType="phone-pad"
          hint="개인정보 보호를 위해 전화번호 전체가 정확히 일치해야 검색됩니다."
          onSubmitEditing={onSearch}
          returnKeyType="search"
        />
      </View>
      <Button
        variant="secondary"
        onPress={onSearch}
        loading={isSearching}
        icon={<SearchIcon size={18} color={SECONDARY_PALETTE[500]} />}
        accessibilityLabel="전화번호로 검색"
      >
        검색
      </Button>
    </View>
  );
}

export default PhoneSearchField;
