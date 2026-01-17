/**
 * UNIQN Mobile - 공지사항 작성 페이지
 *
 * @description 관리자용 새 공지사항 작성
 */

import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useCreateAnnouncement } from '@/hooks/useAnnouncement';
import { AnnouncementForm } from '@/components/admin/announcements';
import type { CreateAnnouncementInput } from '@/types';

export default function CreateAnnouncementPage() {
  const router = useRouter();
  const { mutate: createAnnouncement, isPending } = useCreateAnnouncement();

  const handleSubmit = (data: CreateAnnouncementInput) => {
    createAnnouncement(data, {
      onSuccess: (announcementId) => {
        // Navigate to detail page
        router.replace(`/(admin)/announcements/${announcementId}`);
      },
    });
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: '공지사항 작성',
          headerBackTitle: '취소',
        }}
      />

      <View className="flex-1 bg-gray-50 dark:bg-gray-900">
        <AnnouncementForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={isPending}
          submitLabel="저장"
        />
      </View>
    </>
  );
}
