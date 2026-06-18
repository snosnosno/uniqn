/**
 * UNIQN Mobile - 공지사항 수정 페이지
 *
 * @description 관리자용 공지사항 수정
 */

import { View, ActivityIndicator, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StackHeader } from '@/components/headers';
import { AlertCircleOutlineIcon } from '@/components/icons';
import { useAnnouncementDetail, useUpdateAnnouncement } from '@/hooks/useAnnouncement';
import { AnnouncementForm } from '@/components/admin/announcements';
import { STATUS_COLORS } from '@/constants/colors';
import type { CreateAnnouncementInput } from '@/types';

export default function EditAnnouncementPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: announcement, isLoading, error } = useAnnouncementDetail(id ?? '');
  const { mutate: updateAnnouncement, isPending } = useUpdateAnnouncement();

  const handleSubmit = (data: CreateAnnouncementInput) => {
    updateAnnouncement(
      { announcementId: id!, input: data },
      {
        onSuccess: () => {
          router.back();
        },
      }
    );
  };

  const handleCancel = () => {
    router.back();
  };

  const fallbackHref = `/(admin)/announcements/${id}`;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader title="공지사항 수정" fallbackHref={fallbackHref} />
        <View className="flex-1 bg-surface-page dark:bg-surface items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !announcement) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader title="공지사항 수정" fallbackHref={fallbackHref} />
        <View className="flex-1 bg-surface-page dark:bg-surface items-center justify-center px-8">
          <AlertCircleOutlineIcon size={64} color={STATUS_COLORS.error} />
          <Text className="text-lg font-sans-medium text-content-secondary mt-4">
            공지사항을 찾을 수 없습니다
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-6 bg-primary-600 px-6 py-3 rounded-lg"
          >
            <Text className="text-content-onGold font-sans-medium">돌아가기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader title="공지사항 수정" fallbackHref={fallbackHref} />
      <View className="flex-1 bg-surface-page dark:bg-surface">
        <AnnouncementForm
          initialData={{
            title: announcement.title,
            content: announcement.content,
            category: announcement.category,
            priority: announcement.priority,
            isPinned: announcement.isPinned,
            targetAudience: announcement.targetAudience,
            imageUrl: announcement.imageUrl,
            imageStoragePath: announcement.imageStoragePath,
            images: announcement.images,
          }}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={isPending}
          submitLabel="수정"
        />
      </View>
    </SafeAreaView>
  );
}
