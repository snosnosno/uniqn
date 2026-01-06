/**
 * UNIQN Mobile - Admin User Detail
 * 사용자 상세 정보 페이지
 */

import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { EmptyState } from '@/components/ui/EmptyState';

export default function AdminUserDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();

  // TODO: 사용자 상세 정보 및 권한 수정 기능 구현
  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900">
      <EmptyState
        title="사용자 상세"
        description={`사용자 ID: ${id}\n상세 정보 조회 기능이 추가될 예정입니다.`}
        icon="👤"
      />
    </View>
  );
}
