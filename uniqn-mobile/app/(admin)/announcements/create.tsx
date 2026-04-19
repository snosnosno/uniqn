/**
 * UNIQN Mobile - 공지사항 작성 페이지
 *
 * @description 관리자용 새 공지사항 작성
 */

import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StackHeader } from '@/components/headers';
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
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader title="공지사항 작성" fallbackHref="/(admin)/announcements" />
      <View className="flex-1 bg-surface-page dark:bg-surface">
        <AnnouncementForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={isPending}
          submitLabel="저장"
        />
      </View>
    </SafeAreaView>
  );
}
