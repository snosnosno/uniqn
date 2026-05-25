import { Text, View } from 'react-native';
import { type BoardDetailSectionItem } from '@/components/board/boardDetailListItems';
import { LockIcon, PinIcon } from '@/components/icons';

export function CommentSectionHeader({ item }: { item: BoardDetailSectionItem }) {
  if (item.section === 'pinned') {
    return (
      <View className="mb-3 mt-3 flex-row items-center gap-2">
        <PinIcon size={16} color="#D4A017" />
        <Text className="text-sm font-sans-semibold uppercase tracking-[0.8px] text-content-secondary dark:text-secondary-200">
          {item.title}
        </Text>
      </View>
    );
  }

  return (
    <View className="mb-3 mt-3 flex-row items-center justify-between">
      <Text className="text-lg font-display-semibold text-content-primary dark:text-secondary-100">
        {item.title} {item.count ?? 0}
      </Text>
      {item.isLocked ? (
        <View className="flex-row items-center gap-1 rounded-sm bg-error-50 px-2 py-1 dark:bg-error-900/20">
          <LockIcon size={14} color="#DC2626" />
          <Text className="text-xs text-error-600 dark:text-error-400 font-sans">잠금 상태</Text>
        </View>
      ) : null}
    </View>
  );
}
