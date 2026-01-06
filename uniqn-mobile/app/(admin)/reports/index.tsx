/**
 * UNIQN Mobile - Admin Reports List
 * 신고 관리 목록 페이지
 */

import { View } from 'react-native';
import { EmptyState } from '@/components/ui/EmptyState';

export default function AdminReportsPage() {
  // TODO: 신고 목록 조회 및 처리 기능 구현
  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900">
      <EmptyState
        title="신고 관리"
        description="신고된 컨텐츠 검토 및 처리 기능이 추가될 예정입니다."
        icon="🚨"
      />
    </View>
  );
}
