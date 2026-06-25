/** ops 대회 목록/피커 (1a). */
import { View, Text, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { AppFlashList } from '@/components/ui/AppFlashList';
import { StackHeader } from '@/components/headers';
import { useOpsTournaments } from '@/hooks/ops';
import type { OpsTournament } from '@/types/ops';

const STATUS_LABEL: Record<OpsTournament['status'], string> = {
  upcoming: '예정',
  active: '진행 중',
  completed: '종료',
};

export default function OpsTournamentListScreen() {
  const { tournaments, isLoading, refetch } = useOpsTournaments();

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
      <StackHeader
        title="라이브 운영"
        fallbackHref="/(app)/(tabs)/home-jobs"
        rightAction={
          <Pressable
            onPress={() => router.push('/(ops)/tournaments/new')}
            accessibilityRole="button"
            className="rounded-md bg-primary-600 px-3 py-1.5 active:opacity-70"
          >
            <Text className="font-sans-semibold text-sm text-white">+ 대회</Text>
          </Pressable>
        }
      />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : tournaments.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-secondary-500 dark:text-secondary-400">
            등록된 대회가 없습니다.{'\n'}우측 상단 “+ 대회”로 만들어 보세요.
          </Text>
        </View>
      ) : (
        <AppFlashList
          data={tournaments}
          keyExtractor={(t: OpsTournament) => t.id}
          estimatedItemSize={88}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
          renderItem={({ item }: { item: OpsTournament }) => (
            <Pressable
              onPress={() => router.push(`/(ops)/tournaments/${item.id}`)}
              accessibilityRole="button"
              className="mb-3 rounded-lg border border-gray-200 bg-white p-4 active:opacity-70 dark:border-gray-700 dark:bg-gray-900"
            >
              <View className="flex-row items-center justify-between">
                <Text
                  className="flex-1 font-sans-semibold text-base text-content-primary dark:text-off-white"
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text className="ml-2 text-xs text-secondary-500 dark:text-secondary-400">
                  {STATUS_LABEL[item.status]}
                </Text>
              </View>
              <Text className="mt-1 text-sm text-secondary-500 dark:text-secondary-400">
                {item.gameType}
                {item.venue ? ` · ${item.venue}` : ''}
                {item.eventDate ? ` · ${item.eventDate}` : ''}
              </Text>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
