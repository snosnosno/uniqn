import { memo, useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Modal } from '@/components/ui/Modal';
import { CheckIcon } from '@/components/icons';
import { useThemeStore } from '@/stores/themeStore';
import { REGION_GROUPS, REGIONS_BY_GROUP, type RegionOption } from '@/constants/regions';

export interface RegionSelectModalProps {
  visible: boolean;
  onClose: () => void;
  /** slug 선택. null = 선택 해제 */
  onSelect: (slug: string | null) => void;
  selectedSlug?: string;
  title?: string;
}

export const RegionSelectModal = memo(function RegionSelectModal({
  visible,
  onClose,
  onSelect,
  selectedSlug,
  title = '지역 선택',
}: RegionSelectModalProps) {
  const isDarkMode = useThemeStore((state) => state.isDarkMode);

  const handleSelect = useCallback(
    (slug: string | null) => {
      onSelect(slug);
      onClose();
    },
    [onClose, onSelect]
  );

  const renderItem = useCallback(
    (item: RegionOption) => {
      const isSelected = item.slug === selectedSlug;
      return (
        <Pressable
          key={item.slug}
          onPress={() => handleSelect(item.slug)}
          className="flex-row items-center justify-between px-4 py-3.5 border-b border-secondary-100 dark:border-surface-overlay active:opacity-70"
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected }}
          accessibilityLabel={`${item.label} 지역 선택`}
        >
          <Text className="text-base font-sans text-content-primary">{item.label}</Text>
          {isSelected ? <CheckIcon size={20} color={isDarkMode ? '#D4AF37' : '#8A7228'} /> : null}
        </Pressable>
      );
    },
    [handleSelect, isDarkMode, selectedSlug]
  );

  return (
    <Modal visible={visible} onClose={onClose} title={title} position="bottom" showCloseButton>
      <View className="-mx-5 -mb-5">
        <ScrollView
          className="max-h-[420px]"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        >
          {/* 선택 해제 */}
          <Pressable
            onPress={() => handleSelect(null)}
            className="flex-row items-center justify-between px-4 py-3.5 border-b border-secondary-100 dark:border-surface-overlay active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel="지역 선택 안 함"
          >
            <Text className="text-base font-sans text-content-secondary dark:text-secondary-400">
              선택 안 함
            </Text>
            {!selectedSlug ? (
              <CheckIcon size={20} color={isDarkMode ? '#D4AF37' : '#8A7228'} />
            ) : null}
          </Pressable>

          {REGION_GROUPS.map((group) => (
            <View key={group}>
              <View className="bg-surface-card px-4 py-2 dark:bg-surface-elevated">
                <Text className="text-xs font-sans-semibold text-content-muted dark:text-secondary-400">
                  {group}
                </Text>
              </View>
              {REGIONS_BY_GROUP[group].map(renderItem)}
            </View>
          ))}
          <View className="h-8" />
        </ScrollView>
      </View>
    </Modal>
  );
});
