/**
 * UNIQN Mobile - Admin Users List
 * 사용자 관리 목록 페이지
 */

import { View } from 'react-native';
import { EmptyState } from '@/components/ui/EmptyState';

export default function AdminUsersPage() {
  // TODO: 사용자 목록 조회 및 관리 기능 구현
  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900">
      <EmptyState
        title="사용자 관리"
        description="사용자 목록 조회 및 권한 관리 기능이 추가될 예정입니다."
        icon="👥"
      />
    </View>
  );
}
