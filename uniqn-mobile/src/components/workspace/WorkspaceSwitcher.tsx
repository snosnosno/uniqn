/**
 * UNIQN Mobile - WorkspaceSwitcher
 *
 * @description 다중 워크스페이스 사용자가 활성 워크스페이스를 전환하는 BottomSheet.
 *              단일 워크스페이스 사용자는 텍스트만 표시 (전환 불가능 → BottomSheet 비활성).
 *              (Phase 1B — workspace collaboration)
 *
 * 디자인:
 *   - 최소 터치 타깃 44px (impeccable §5)
 *   - Pressed 피드백 다크/라이트 반대 방향 (impeccable §21)
 *   - Focus ring Info 블루 #2563EB 2px (impeccable §22)
 *   - 골드 사용 0회 (active 표시는 CheckIcon 만)
 * @version 1.0.0
 */

import { useState, useCallback } from 'react';
import { Modal, Pressable, Text, View, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDownIcon, CheckIcon, XMarkIcon } from '@/components/icons';
import { Badge } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { useActiveWorkspace } from '@/hooks/workspace/useActiveWorkspace';
import { triggerHaptic } from '@/utils/haptics';
import type { Workspace } from '@/types/workspace';

interface WorkspaceSwitcherProps {
  /** 외부에서 활성 워크스페이스 변경을 알아야 할 때 콜백 */
  onChange?: (workspaceId: string) => void;
}

export function WorkspaceSwitcher({ onChange }: WorkspaceSwitcherProps) {
  const userId = useAuthStore((s) => s.user?.uid);
  const { activeWorkspace, workspaces, setActiveWorkspaceId } = useActiveWorkspace();
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const isOwnerOf = useCallback(
    (w: Workspace) => Boolean(userId) && w.ownerId === userId,
    [userId]
  );

  const handleSelect = useCallback(
    (workspaceId: string) => {
      triggerHaptic('light');
      setActiveWorkspaceId(workspaceId);
      onChange?.(workspaceId);
      setOpen(false);
    },
    [setActiveWorkspaceId, onChange]
  );

  // 0개: 표시 안 함 (이 화면 진입 자체가 안내 화면으로 막힘)
  if (workspaces.length === 0) return null;

  // 1개: 텍스트만 (BottomSheet 불필요)
  if (workspaces.length === 1) {
    return (
      <View
        className="min-h-[44px] flex-row items-center px-2 py-2"
        accessibilityRole="text"
        accessibilityLabel={`현재 팀 ${activeWorkspace?.name ?? ''}`}
      >
        <Text
          className="text-base font-sans-medium text-content-primary"
          numberOfLines={1}
          maxFontSizeMultiplier={1.5}
        >
          {activeWorkspace?.name ?? ''}
        </Text>
      </View>
    );
  }

  // 2개+: 전환 가능 dropdown
  return (
    <>
      <Pressable
        onPress={() => {
          triggerHaptic('light');
          setOpen(true);
        }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`현재 팀 ${activeWorkspace?.name ?? ''}, 변경하려면 탭`}
        accessibilityHint="팀 선택 시트가 열립니다"
        className="min-h-[44px] flex-row items-center gap-2 px-2 py-2"
      >
        {({ pressed }) => (
          <View
            className={`flex-row items-center gap-2 rounded-md px-2 py-1 ${
              pressed ? 'bg-surface-overlay dark:bg-surface-elevated' : ''
            }`}
          >
            <Text
              className="text-base font-sans-medium text-content-primary"
              numberOfLines={1}
              maxFontSizeMultiplier={1.5}
            >
              {activeWorkspace?.name ?? '팀 선택'}
            </Text>
            <ChevronDownIcon size={16} />
          </View>
        )}
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 justify-end">
          <Pressable
            className="flex-1 bg-black/40"
            onPress={() => setOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="시트 닫기"
          />
          <View
            className="rounded-t-md bg-surface-card dark:bg-surface-elevated"
            style={{ paddingBottom: insets.bottom + 12 }}
          >
            <View className="flex-row items-center justify-between px-6 pb-2 pt-4">
              <Text className="text-sm font-sans-medium text-content-secondary">팀 선택</Text>
              <Pressable
                onPress={() => setOpen(false)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="닫기"
                className="min-h-[44px] min-w-[44px] items-center justify-center"
              >
                <XMarkIcon size={20} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 360 }}>
              {workspaces.map((w) => {
                const isActive = w.id === activeWorkspace?.id;
                return (
                  <Pressable
                    key={w.id}
                    onPress={() => handleSelect(w.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    accessibilityLabel={`${w.name} ${isOwnerOf(w) ? '소유' : '공동관리'}${
                      isActive ? ', 현재 활성' : ''
                    }`}
                    className="min-h-[44px] flex-row items-center justify-between px-6 py-3"
                  >
                    {({ pressed }) => (
                      <View
                        className={`flex-1 flex-row items-center justify-between gap-3 rounded-sm px-1 py-1 ${
                          pressed ? 'bg-surface-overlay dark:bg-surface-card' : ''
                        }`}
                      >
                        <View className="flex-1 flex-row items-center gap-2">
                          <Text
                            className="flex-shrink text-base text-content-primary"
                            numberOfLines={1}
                          >
                            {w.name}
                          </Text>
                          <Badge variant={isOwnerOf(w) ? 'warning' : 'info'} size="sm">
                            {isOwnerOf(w) ? '소유' : '공동관리'}
                          </Badge>
                        </View>
                        {isActive ? <CheckIcon size={18} /> : null}
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
