/**
 * UNIQN Mobile - ActionTileGrid 컴포넌트
 *
 * @description 진입점 여러 개를 2열 그리드 타일로 낸다.
 *
 * 진입점을 "한 항목 = 한 행"으로 세우면 한 칸이 세로 70px 을 먹는다(제목 + 설명 두 줄).
 * 여섯 개면 420px — 화면 한 장을 목록이 통째로 가져간다. 설명문 대부분이
 * "지원자 목록을 확인합니다." 같은 제목의 되풀이라 **화면에서는 지우고 접근성 라벨에만
 * 남긴다**(스크린리더는 제목만으로 목적지를 판단하기 어렵다). 남은 세로는 2열로 다시 절반이 된다.
 *
 * 실측: 공고 상세 '관리' 6항목이 470 → 265px (커밋 ba3d08a77).
 *
 * @version 1.0.0
 */

import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Badge, type BadgeVariant } from './Badge';

export interface ActionTileItem {
  /** 리스트 키 겸 행 분할 기준 */
  key: string;
  /** 제목 왼쪽 아이콘. size 18 권장 (룰 27 화이트리스트) */
  icon: React.ReactNode;
  /** 타일에 그려지는 제목 */
  title: string;
  /**
   * 화면에는 그리지 않고 **접근성 라벨에만** 담기는 설명.
   * 제목을 되풀이하는 문장이라면 그게 정상이다 — 시각 사용자에겐 제목만으로 충분하고,
   * 스크린리더 사용자에겐 목적지를 가늠할 문장이 필요하다.
   */
  description: string;
  /** 처리할 일 개수 등. 배지가 있는 칸만 두 줄이 되어 자연히 커 보인다 */
  badge?: { label: string; variant: BadgeVariant };
  onPress: () => void;
  testID?: string;
}

export interface ActionTileGridProps {
  items: ActionTileItem[];
}

/**
 * 타일 한 칸.
 *
 * 반 폭이라 9자 제목("스태프 관리/정산")은 한 줄에 못 앉는다 — 자르지 말고 두 줄을 준다.
 * 같은 행의 두 칸은 flex 로 높이가 맞춰지므로 줄 수가 달라도 어긋나지 않는다.
 */
function ActionTile({
  icon,
  title,
  description,
  badge,
  onPress,
  testID,
}: Omit<ActionTileItem, 'key'>) {
  // 배지가 라벨에서 빠지면 스크린리더 사용자는 "대기 3명" 같은 처리할 일 개수를 듣지 못한다 —
  // 화면에서 가장 행동을 부르는 정보가 시각 사용자에게만 전달된다.
  const accessibilityLabel = badge
    ? `${title}, ${badge.label}, ${description}`
    : `${title}, ${description}`;

  return (
    <Pressable
      onPress={onPress}
      className="min-h-[60px] flex-1 justify-center rounded-lg bg-surface-card px-2.5 py-2.5 dark:bg-surface-elevated active:opacity-70"
      accessibilityRole="button"
      testID={testID}
      accessibilityLabel={accessibilityLabel}
    >
      <View className="flex-row items-center">
        {icon}
        <Text
          className="ml-1.5 flex-1 text-sm font-sans-medium text-content-primary dark:text-off-white"
          numberOfLines={2}
        >
          {title}
        </Text>
      </View>
      {badge ? (
        <Badge variant={badge.variant} size="sm" className="mt-1.5 self-start">
          {badge.label}
        </Badge>
      ) : null}
    </Pressable>
  );
}

/**
 * 진입점 목록을 2열 그리드로 렌더한다.
 *
 * 목록 순서는 좌→우, 위→아래로 그대로 읽히므로 우선순위 표현이 깨지지 않는다.
 * 호출부는 이미 우선순위대로 정렬된 배열만 넘기면 된다.
 */
export function ActionTileGrid({ items }: ActionTileGridProps) {
  // 🔑 `flex-wrap` 이 아니라 두 개씩 끊어 행을 만든다. wrap 은 칸마다 폭을 고정해야 하는데
  //    (그 순간 `flex-1` 이 무력해진다) 긴 제목에서 줄이 밀린다. 행으로 끊으면 `flex-1` 두 칸이
  //    언제나 정확히 반반을 나눠 갖는다.
  const rows = useMemo(
    () =>
      items.reduce<ActionTileItem[][]>((acc, item, index) => {
        if (index % 2 === 0) {
          return [...acc, [item]];
        }

        const head = acc.slice(0, -1);
        const last = acc[acc.length - 1] ?? [];

        return [...head, [...last, item]];
      }, []),
    [items]
  );

  return (
    <View className="gap-2">
      {rows.map((row, rowIndex) => (
        <View key={row[0]?.key ?? `tile-row-${rowIndex}`} className="flex-row gap-2">
          {row.map(({ key, ...tile }) => (
            <ActionTile key={key} {...tile} />
          ))}
          {/* 홀수 개일 때 마지막 칸이 가로를 다 먹지 않도록 빈 칸을 채운다 */}
          {row.length === 1 ? <View className="flex-1" /> : null}
        </View>
      ))}
    </View>
  );
}
