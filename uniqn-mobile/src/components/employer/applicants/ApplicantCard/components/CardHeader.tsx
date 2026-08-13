/**
 * UNIQN Mobile - ApplicantCard 헤더 컴포넌트
 *
 * @description 지원자 카드 헤더 (아바타, 이름, 상태, 펼침 버튼)
 * @version 1.0.0
 */

import React from 'react';
import { View, Text, Pressable, useColorScheme } from 'react-native';

import { Avatar, Badge } from '@/components/ui';
import { ChevronUpIcon, ChevronDownIcon } from '@/components/icons';
import { APPLICATION_STATUS_LABELS } from '@/shared/status';
import type { ApplicationStatus } from '@/types';
import { getIconColor } from '@/constants';
import BubbleScoreBadge from '@/components/review/BubbleScoreBadge';

// ============================================================================
// Types
// ============================================================================

export interface CardHeaderProps {
  /** 표시 이름 */
  displayName: string;
  /** 프로필 사진 URL */
  profilePhotoURL?: string;
  /** 프로필 사진 blurhash 플레이스홀더 */
  profilePhotoURLBlurhash?: string | null;
  /** 읽음 여부 */
  isRead: boolean;
  /** 지원 상태 */
  status: ApplicationStatus;
  /** 펼침 상태 */
  isExpanded: boolean;
  /** 펼침/접힘 토글 */
  onToggleExpand: () => void;
  /** 프로필 보기 (없으면 비활성화) */
  onViewProfile?: () => void;
  /** 버블 점수 (없으면 배지 미노출) */
  bubbleScore?: number;
  /** 점수 표본 크기 — "리뷰 N건" 병기 (QW12) */
  reviewCount?: number;
  /**
   * 최근 180일 노쇼 횟수 (S3-3). 0 이거나 미조회면 칩을 띄우지 않는다.
   *
   * 🔴 횟수만 받는다 — 어느 업장이었는지·언제였는지는 서버가 애초에 반환하지 않는다.
   *    "0회"를 굳이 표시하지 않는 것도 설계다. 전원에게 노쇼 칸을 만들어 두면
   *    그 자체가 사람을 노쇼 여부로 분류하는 화면이 된다.
   */
  noShowCount?: number;
}

// ============================================================================
// Component
// ============================================================================

export const CardHeader = React.memo(function CardHeader({
  displayName,
  profilePhotoURL,
  profilePhotoURLBlurhash,
  isRead,
  status,
  isExpanded,
  onToggleExpand,
  onViewProfile,
  bubbleScore,
  reviewCount,
  noShowCount,
}: CardHeaderProps) {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const chevronColor = getIconColor(isDarkMode, 'secondary');

  return (
    <View className="flex-row items-center">
      {/* 메인 영역 - 프로필 모달 열기 */}
      <Pressable
        onPress={onViewProfile}
        disabled={!onViewProfile}
        accessibilityRole="button"
        accessibilityLabel={`${displayName} 프로필 보기`}
        accessibilityHint="지원자의 상세 프로필을 확인합니다"
        accessibilityState={{ disabled: !onViewProfile }}
        className="flex-1 flex-row items-center active:opacity-80"
      >
        <Avatar
          source={profilePhotoURL}
          name={displayName}
          size="md"
          className="mr-3"
          blurhash={profilePhotoURLBlurhash}
        />
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
              {displayName}
            </Text>
            {!isRead && (
              <View className="h-2 w-2 rounded-sm bg-primary-500" accessibilityLabel="새 지원자" />
            )}
            {typeof bubbleScore === 'number' ? (
              <BubbleScoreBadge score={bubbleScore} size="sm" />
            ) : null}
            {typeof bubbleScore === 'number' && typeof reviewCount === 'number' ? (
              <Text className="text-xs text-content-secondary dark:text-secondary-400 font-sans">
                리뷰 {reviewCount}건
              </Text>
            ) : null}
            {/*
              노쇼 이력 (S3-3) — 확정 전에 "이 사람이 실제로 올까"를 판단할 근거.
              danger 가 아니라 warning 틴트를 쓰는 이유: 이건 거절 사유가 아니라 참고 정보다.
              빨간색은 "차단"으로 읽히고, 그러면 한 번의 사정이 영구 배제가 된다.
              기간(최근 6개월)을 라벨에 명시해 "평생 이력"으로 오해되지 않게 한다.
            */}
            {typeof noShowCount === 'number' && noShowCount > 0 ? (
              <View
                accessible
                accessibilityRole="text"
                accessibilityLabel={`최근 6개월 노쇼 ${noShowCount}회`}
                className="rounded bg-warning-100 px-1.5 py-0.5 dark:bg-warning-700/30"
              >
                <Text className="text-xs font-sans-medium text-warning-700 dark:text-warning-500">
                  노쇼 {noShowCount}회
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        <Badge variant="chip" size="sm" dot>
          {APPLICATION_STATUS_LABELS[status]}
        </Badge>
      </Pressable>

      {/* 펼침/접힘 버튼 */}
      <Pressable
        onPress={onToggleExpand}
        accessibilityRole="button"
        accessibilityLabel={isExpanded ? '지원 상세 접기' : '지원 상세 열기'}
        accessibilityState={{ expanded: isExpanded }}
        className="ml-2 px-3 py-1 rounded-sm bg-surface-card dark:bg-surface active:opacity-60 flex-row items-center"
        hitSlop={8}
      >
        <Text className="text-xs font-sans-medium text-content-muted dark:text-secondary-300">
          {isExpanded ? '접기' : '열기'}
        </Text>
        {isExpanded ? (
          <ChevronUpIcon size={14} color={chevronColor} />
        ) : (
          <ChevronDownIcon size={14} color={chevronColor} />
        )}
      </Pressable>
    </View>
  );
});
