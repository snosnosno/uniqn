import { Pressable, Text, View } from 'react-native';
import { PinIcon } from '@/components/icons';
import type { BoardPost } from '@/types/board';

interface PinnedNoticeBannerProps {
  notices: BoardPost[];
  onPress: (notice: BoardPost) => void;
}

/** 홈 고정 공지 배너 */
export function PinnedNoticeBanner({ notices, onPress }: PinnedNoticeBannerProps) {
  const visible = notices.slice(0, 2);
  if (visible.length === 0) return null;

  return (
    <View className="mb-4 rounded-md bg-primary-50 px-3 py-2 dark:bg-surface-elevated">
      <View className="mb-1 flex-row items-center gap-1">
        <PinIcon size={12} color="#D4AF37" />
        <Text className="text-xs font-sans-semibold text-content-secondary">고정 공지</Text>
      </View>
      {visible.map((notice) => (
        <Pressable
          key={notice.id}
          onPress={() => onPress(notice)}
          accessibilityRole="button"
          accessibilityLabel={`고정 공지: ${notice.title}`}
          className="py-1 active:opacity-70"
        >
          <Text
            numberOfLines={1}
            className="text-sm font-sans text-content-primary dark:text-secondary-100"
          >
            {notice.title}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
