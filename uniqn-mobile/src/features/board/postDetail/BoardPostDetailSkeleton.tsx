import { ScrollView, Text, View } from 'react-native';
import { Card, Skeleton, SkeletonButton, SkeletonText } from '@/components/ui';
import { LAYOUT } from '@/constants';

export function BoardPostDetailSkeleton() {
  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ padding: 16, paddingBottom: LAYOUT.TAB_BAR_HEIGHT + 32 }}
      showsVerticalScrollIndicator={false}
    >
      <Text className="mb-4 text-sm text-content-secondary font-sans">
        게시글을 불러오는 중이에요.
      </Text>

      <View className="mb-3 flex-row flex-wrap gap-2">
        <Skeleton width={72} height={28} borderRadius={14} />
        <Skeleton width={64} height={28} borderRadius={14} />
        <Skeleton width={56} height={28} borderRadius={14} />
      </View>

      <Card className="mb-4 border border-secondary-100 dark:border-surface-overlay">
        <Skeleton width="72%" height={28} className="mb-3" />
        <View className="mb-5 flex-row flex-wrap gap-2">
          <Skeleton width={84} height={16} />
          <Skeleton width={120} height={16} />
          <Skeleton width={72} height={16} />
        </View>
        <SkeletonText lines={4} lineHeight={16} lastLineWidth="58%" className="mb-5" />
        <Skeleton width="100%" height={208} borderRadius={20} className="mb-5" />
        <View className="flex-row flex-wrap gap-2">
          <Skeleton width={76} height={32} borderRadius={16} />
          <Skeleton width={84} height={32} borderRadius={16} />
          <Skeleton width={80} height={32} borderRadius={16} />
        </View>
      </Card>

      <View className="mb-3 flex-row items-center justify-between">
        <Skeleton width={92} height={22} />
        <Skeleton width={68} height={16} />
      </View>

      {[1, 2].map((item) => (
        <Card
          key={item}
          className="mb-3 border border-secondary-100 bg-white dark:border-surface-overlay dark:bg-surface"
        >
          <View className="mb-3 flex-row items-center gap-2">
            <Skeleton width={88} height={18} />
            <Skeleton width={54} height={24} borderRadius={12} />
          </View>
          <SkeletonText lines={3} lineHeight={14} lastLineWidth="46%" className="mb-4" />
          <View className="flex-row flex-wrap gap-2">
            <Skeleton width={64} height={30} borderRadius={15} />
            <Skeleton width={64} height={30} borderRadius={15} />
            <Skeleton width={64} height={30} borderRadius={15} />
          </View>
        </Card>
      ))}

      <Card className="border border-secondary-100 dark:border-surface-overlay">
        <Skeleton width={80} height={20} className="mb-3" />
        <Skeleton width="100%" height={138} borderRadius={16} className="mb-4" />
        <View className="flex-row gap-3">
          <SkeletonButton width="48%" />
          <SkeletonButton width="48%" />
        </View>
      </Card>
    </ScrollView>
  );
}
