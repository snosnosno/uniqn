/**
 * UNIQN Mobile - 공지사항 수정 페이지
 *
 * @description 관리자용 공지사항 수정
 */

import { View, ActivityIndicator, Text, Pressable } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAnnouncementDetail, useUpdateAnnouncement } from '@/hooks/useAnnouncement';
import { AnnouncementForm } from '@/components/admin/announcements';
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

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: '공지사항 수정' }} />
        <View className="flex-1 bg-gray-50 dark:bg-surface-dark items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      </>
    );
  }

  if (error || !announcement) {
    return (
      <>
        <Stack.Screen options={{ title: '공지사항 수정' }} />
        <View className="flex-1 bg-gray-50 dark:bg-surface-dark items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text className="text-lg font-medium text-gray-700 dark:text-gray-300 mt-4">
            공지사항을 찾을 수 없습니다
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-6 bg-primary-600 px-6 py-3 rounded-lg"
          >
            <Text className="text-white font-medium">돌아가기</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: '공지사항 수정',
          headerBackTitle: '취소',
        }}
      />

      <View className="flex-1 bg-gray-50 dark:bg-surface-dark">
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
    </>
  );
}
