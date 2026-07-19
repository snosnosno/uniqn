/**
 * NicknameSearchField — 닉네임 prefix 검색 폼
 *
 * 닉네임 입력(Input) + 검색 버튼(Button)으로 구성된 순수 표현(presentational) 프리미티브.
 * 그리드 인원 추가 시트(AddSlotSheet)와 스태프 직접추가 모달(AddStaffModal)이 공유한다.
 *
 * 검색 로직(useStaffNicknameSearch)은 호출부에 남긴다 — 이 컴포넌트는 값·콜백만 받는다.
 *
 * 레이아웃: 라벨(전체폭) → [입력창 flex-1 · 검색버튼] 한 줄(items-center 로 세로 중앙 정렬)
 *   → 안내문(전체폭). 안내문을 Input hint 로 넣으면 컬럼이 세로로 길어져 버튼이 안내문 옆으로
 *   밀리므로, 안내문은 행 바깥 하단에 별도 배치한다.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SearchIcon } from '@/components/icons';
import { SECONDARY_PALETTE } from '@/constants/colors';

export interface NicknameSearchFieldProps {
  nickname: string;
  onChangeNickname: (value: string) => void;
  onSearch: () => void;
  isSearching: boolean;
}

export function NicknameSearchField({
  nickname,
  onChangeNickname,
  onSearch,
  isSearching,
}: NicknameSearchFieldProps) {
  return (
    <View>
      {/* 라벨 (Input 기본 라벨 스타일과 동일) */}
      <Text className="mb-1.5 text-sm font-sans-medium text-content-secondary">닉네임</Text>

      {/* 입력창 + 검색버튼: items-center 로 버튼이 입력창 옆에 세로 중앙 정렬 */}
      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <Input
            value={nickname}
            onChangeText={onChangeNickname}
            placeholder="닉네임 입력 (2자 이상)"
            accessibilityLabel="닉네임"
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={onSearch}
            returnKeyType="search"
          />
        </View>
        <Button
          variant="secondary"
          onPress={onSearch}
          loading={isSearching}
          icon={<SearchIcon size={18} color={SECONDARY_PALETTE[500]} />}
          accessibilityLabel="닉네임으로 검색"
        >
          검색
        </Button>
      </View>

      {/* 안내문 (행 바깥 하단, 전체폭) */}
      <Text className="mt-1 text-sm font-sans text-secondary-600 dark:text-secondary-400">
        닉네임 앞부분으로 검색됩니다 (대소문자 무시).
      </Text>
    </View>
  );
}

export default NicknameSearchField;
