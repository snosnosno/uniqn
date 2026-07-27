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
import { SettingsIcon } from '@/components/icons';
import { SECONDARY_PALETTE } from '@/constants/colors';
import type { Workspace } from '@/types/workspace';
import type { VenueContainer } from '@/domains/workSchedule';

export interface VenueSelectorProps {
  workspaces: Workspace[];
  activeWorkspaceId: string | undefined;
  onSelectWorkspace: (id: string) => void;
  containers: VenueContainer[];
  selectedVenueId: string | null;
  onSelectVenue: (id: string) => void;
  isLoadingContainers?: boolean;
  /** 제공 시 운영처 칩 줄에 "+ 운영처 추가" 진입점 노출. */
  onAddVenue?: () => void;
  /** 제공 시 선택된 지점 칩 옆에 ⚙(역할별 단가 설정) 진입점 노출. */
  onOpenSettings?: (venueId: string) => void;
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
  onAddVenue,
  onOpenSettings,
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
          <Text className="mb-2 text-xs font-sans-medium text-content-muted">팀</Text>
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
                a11yLabel={`팀 ${ws.name}`}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* 운영처(컨테이너) 선택 */}
      <Text className="mb-2 text-xs font-sans-medium text-content-muted">지점</Text>
      {isLoadingContainers ? (
        <View className="h-10 flex-row items-center">
          <ActivityIndicator size="small" />
          <Text className="ml-2 text-sm text-content-secondary">지점 불러오는 중…</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 8, alignItems: 'center' }}
        >
          {containers.length === 0 ? (
            <View className="mr-2 h-10 justify-center">
              <Text className="text-sm text-content-secondary">이 팀에 등록된 지점이 없어요</Text>
            </View>
          ) : (
            containers.map((c) => (
              <View key={c.id} className="flex-row items-center">
                <Chip
                  label={c.name}
                  selected={c.id === selectedVenueId}
                  onPress={handleSelectVenue(c.id)}
                  a11yLabel={`지점 ${c.name}`}
                />
                {onOpenSettings && c.id === selectedVenueId ? (
                  <Pressable
                    onPress={() => onOpenSettings(c.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`지점 ${c.name} 단가 설정`}
                    hitSlop={10}
                    className="-ml-1 mr-2 h-10 w-10 items-center justify-center"
                  >
                    <SettingsIcon size={18} color={SECONDARY_PALETTE[400]} />
                  </Pressable>
                ) : null}
              </View>
            ))
          )}
          {onAddVenue ? (
            <Pressable
              onPress={onAddVenue}
              accessibilityRole="button"
              accessibilityLabel="지점 추가"
              className="min-h-[40px] flex-row items-center justify-center rounded-full border border-dashed border-primary-400 px-4 py-2"
            >
              <Text className="text-sm font-sans-medium text-primary-500">+ 지점 추가</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
