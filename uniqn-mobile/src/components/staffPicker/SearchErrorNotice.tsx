/**
 * SearchErrorNotice — 닉네임 검색 실패 안내
 *
 * 검색 RPC 가 던진 예외(서버 rate limit·권한·네트워크)를 사용자 문구로 표시한다.
 *
 * 이 컴포넌트가 없으면 검색 실패가 "결과 0건" 분기로 흡수되어 사용자에게
 * "일치하는 가입자를 찾을 수 없습니다" / "UNIQN 에 가입한 사용자만 추가할 수 있어요" 로
 * 보인다. 실존하는 사용자를 미가입자로 오도하므로, 실패는 반드시 빈 결과보다 **먼저**
 * 분기해 이 컴포넌트로 표시한다.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { isAppError } from '@/errors';

export interface SearchErrorNoticeProps {
  /** 검색 훅이 반환한 에러. null/undefined 면 아무것도 렌더하지 않는다. */
  error: unknown;
}

/** AppError 면 사용자 문구를, 아니면 일반 안내를 돌려준다. */
export function resolveSearchErrorMessage(error: unknown): string | null {
  if (!error) return null;
  if (isAppError(error)) return error.userMessage;
  return '검색에 실패했습니다. 잠시 후 다시 시도해 주세요.';
}

export function SearchErrorNotice({ error }: SearchErrorNoticeProps) {
  const message = resolveSearchErrorMessage(error);
  if (!message) return null;

  return (
    <View className="px-4 py-4">
      <Text
        className="text-center text-sm font-sans text-error-600 dark:text-error-400"
        accessibilityRole="alert"
      >
        {message}
      </Text>
    </View>
  );
}

export default SearchErrorNotice;
