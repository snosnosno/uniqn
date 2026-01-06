/**
 * UNIQN Mobile - Admin Dashboard
 * 관리자 대시보드 메인 페이지
 */

import { View, Text, ScrollView, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

interface DashboardCardProps {
  title: string;
  description: string;
  iconName: IoniconsName;
  iconColor: string;
  href: string;
  bgColor: string;
}

function DashboardCard({ title, description, iconName, iconColor, href, bgColor }: DashboardCardProps) {
  return (
    <Link href={href as never} asChild>
      <Pressable className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 active:opacity-80">
        <View className={`w-12 h-12 rounded-lg items-center justify-center mb-3 ${bgColor}`}>
          <Ionicons name={iconName} size={24} color={iconColor} />
        </View>
        <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          {title}
        </Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400">
          {description}
        </Text>
      </Pressable>
    </Link>
  );
}

export default function AdminDashboard() {
  const menuItems: DashboardCardProps[] = [
    {
      title: '사용자 관리',
      description: '회원 정보 조회 및 권한 관리',
      iconName: 'people-outline',
      iconColor: '#2563eb',
      href: '/(admin)/users',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      title: '신고 관리',
      description: '신고된 컨텐츠 검토 및 처리',
      iconName: 'flag-outline',
      iconColor: '#dc2626',
      href: '/(admin)/reports',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
    },
    {
      title: '시스템 설정',
      description: '앱 설정 및 기능 플래그 관리',
      iconName: 'settings-outline',
      iconColor: '#4b5563',
      href: '/(admin)/settings',
      bgColor: 'bg-gray-100 dark:bg-gray-700',
    },
    {
      title: '통계',
      description: '서비스 이용 현황 및 분석',
      iconName: 'bar-chart-outline',
      iconColor: '#16a34a',
      href: '/(admin)/stats',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      title: '보안 로그',
      description: '로그인 시도 및 보안 이벤트',
      iconName: 'shield-checkmark-outline',
      iconColor: '#9333ea',
      href: '/(admin)/security',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    },
    {
      title: '공지사항 관리',
      description: '공지사항 작성 및 관리',
      iconName: 'document-text-outline',
      iconColor: '#ea580c',
      href: '/(admin)/announcements',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    },
  ];

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-900">
      <View className="p-4">
        {/* Header */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            관리자 대시보드
          </Text>
          <Text className="text-gray-500 dark:text-gray-400">
            UNIQN 서비스 관리 및 모니터링
          </Text>
        </View>

        {/* Quick Stats */}
        <View className="flex-row gap-3 mb-6">
          <View className="flex-1 bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <Text className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              총 사용자
            </Text>
            <Text className="text-2xl font-bold text-gray-900 dark:text-white">
              --
            </Text>
          </View>
          <View className="flex-1 bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <Text className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              오늘 신규
            </Text>
            <Text className="text-2xl font-bold text-green-600">
              --
            </Text>
          </View>
          <View className="flex-1 bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
            <Text className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              미처리 신고
            </Text>
            <Text className="text-2xl font-bold text-red-600">
              --
            </Text>
          </View>
        </View>

        {/* Menu Grid */}
        <View className="flex-row flex-wrap gap-3">
          {menuItems.map((item) => (
            <View key={item.title} className="w-[48%]">
              <DashboardCard {...item} />
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
