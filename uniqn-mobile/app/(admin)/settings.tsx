/**
 * UNIQN Mobile - Admin Settings
 * 시스템 설정 페이지
 */

import { View } from 'react-native';
import { EmptyState } from '@/components/ui/EmptyState';

export default function AdminSettingsPage() {
  // TODO: 시스템 설정 및 기능 플래그 관리 기능 구현
  return (
    <View className="flex-1 bg-gray-50 dark:bg-gray-900">
      <EmptyState
        title="시스템 설정"
        description="앱 설정 및 기능 플래그 관리 기능이 추가될 예정입니다."
        icon="⚙️"
      />
    </View>
  );
}
