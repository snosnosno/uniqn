/**
 * VenueSelector — 운영처(workspace) + 컨테이너(venue) 선택기 (unit 5)
 *
 * 상단 그리드 화면에서 "어느 워크스페이스의 어느 운영처를 볼지" 고른다.
 * - 워크스페이스가 2개 이상일 때만 워크스페이스 칩 줄을 노출(단일이면 생략).
 * - 운영처(컨테이너) 칩 줄은 항상 노출. 0개면 안내 텍스트.
 * 데이터 패칭은 화면(unit 7)이 담당하고 본 컴포넌트는 값+콜백만 받는 표현 컴포넌트.
 *
 * U3: 색상은 Midnight Craft 토큰 리터럴 클래스만(동적 className dark: 유실 방지).
 * a11y: 칩은 button role + selected 상태 전달.
 */
import React, { useCallback } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import type { Workspace } from '@/types/workspace';
import type { VenueContainer } from '@/domains/weeklyGrid';

export interface VenueSelectorProps {
  workspaces: Workspace[];
  activeWorkspaceId: string | undefined;
  onSelectWorkspace: (id: string) => void;
  containers: VenueContainer[];
  selectedVenueId: string | null;
  onSelectVenue: (id: string) => void;
  isLoadingContainers?: boolean;
}

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  a11yLabel: string;
}

function Chip({ label, selected, onPress, a11yLabel }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={a11yLabel}
      className={`mr-2 min-h-[40px] justify-center rounded-full px-4 py-2 ${
        selected
          ? 'bg-primary-500'
          : 'border border-divider bg-surface-page dark:bg-surface-elevated'
      }`}
    >
      <Text
        className={`text-sm font-sans-medium ${
          selected ? 'text-content-onGold' : 'text-content-secondary'
        }`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function VenueSelector({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  containers,
  selectedVenueId,
  onSelectVenue,
  isLoadingContainers = false,
}: VenueSelectorProps) {
  const handleSelectWorkspace = useCallback(
    (id: string) => () => onSelectWorkspace(id),
    [onSelectWorkspace]
  );
  const handleSelectVenue = useCallback((id: string) => () => onSelectVenue(id), [onSelectVenue]);

  return (
    <View className="border-b border-divider bg-surface-page px-4 py-3 dark:bg-surface">
      {/* 워크스페이스 선택(2개 이상일 때만) */}
      {workspaces.length > 1 ? (
        <View className="mb-3">
          <Text className="mb-2 text-xs font-sans-medium text-content-muted">워크스페이스</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 8 }}
          >
            {workspaces.map((ws) => (
              <Chip
                key={ws.id}
                label={ws.name}
                selected={ws.id === activeWorkspaceId}
                onPress={handleSelectWorkspace(ws.id)}
                a11yLabel={`워크스페이스 ${ws.name}`}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* 운영처(컨테이너) 선택 */}
      <Text className="mb-2 text-xs font-sans-medium text-content-muted">운영처</Text>
      {isLoadingContainers ? (
        <View className="h-10 flex-row items-center">
          <ActivityIndicator size="small" />
          <Text className="ml-2 text-sm text-content-secondary">운영처 불러오는 중…</Text>
        </View>
      ) : containers.length === 0 ? (
        <View className="h-10 justify-center">
          <Text className="text-sm text-content-secondary">
            이 워크스페이스에 등록된 운영처가 없어요
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 8 }}
        >
          {containers.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              selected={c.id === selectedVenueId}
              onPress={handleSelectVenue(c.id)}
              a11yLabel={`운영처 ${c.name}`}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

export default VenueSelector;
