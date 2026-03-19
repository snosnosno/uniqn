import { View, Text, ScrollView, Pressable } from 'react-native';
import { Link } from 'expo-router';
import {
  type IconComponent,
  ChatbubbleEllipsesOutlineIcon,
  DocumentTextOutlineIcon,
  FlagOutlineIcon,
  PeopleOutlineIcon,
  TrophyOutlineIcon,
} from '@/components/icons';

interface DashboardCardProps {
  title: string;
  description: string;
  icon: IconComponent;
  iconColor: string;
  href: string;
  bgColor: string;
}

function DashboardCard({
  title,
  description,
  icon: Icon,
  iconColor,
  href,
  bgColor,
}: DashboardCardProps) {
  return (
    <Link href={href as never} asChild>
      <Pressable className="bg-white dark:bg-surface rounded-xl p-4 border border-gray-100 dark:border-surface-overlay active:opacity-80">
        <View className={`w-12 h-12 rounded-lg items-center justify-center mb-3 ${bgColor}`}>
          <Icon size={24} color={iconColor} />
        </View>
        <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{title}</Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400">{description}</Text>
      </Pressable>
    </Link>
  );
}

export default function AdminDashboard() {
  const menuItems: DashboardCardProps[] = [
    {
      title: '대회공고 승인',
      description: '대회공고 승인 요청 검토 및 처리',
      icon: TrophyOutlineIcon,
      iconColor: '#eab308',
      href: '/(admin)/tournaments',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    },
    {
      title: '사용자 관리',
      description: '회원 정보 조회 및 권한 관리',
      icon: PeopleOutlineIcon,
      iconColor: '#9333EA',
      href: '/(admin)/users',
      bgColor: 'bg-primary-100 dark:bg-primary-900/30',
    },
    {
      title: '신고 관리',
      description: '신고된 콘텐츠 검토 및 처리',
      icon: FlagOutlineIcon,
      iconColor: '#dc2626',
      href: '/(admin)/reports',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
    },
    {
      title: '문의 관리',
      description: '고객 문의 확인 및 응답',
      icon: ChatbubbleEllipsesOutlineIcon,
      iconColor: '#0891b2',
      href: '/(admin)/inquiries',
      bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
    },
    {
      title: '공지사항 관리',
      description: '공지사항 작성 및 관리',
      icon: DocumentTextOutlineIcon,
      iconColor: '#ea580c',
      href: '/(admin)/announcements',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    },
  ];

  return (
    <ScrollView className="flex-1 bg-gray-50 dark:bg-surface-dark">
      <View className="p-4">
        <View className="mb-6">
          <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
            관리자 대시보드
          </Text>
          <Text className="text-gray-500 dark:text-gray-400">
            UNIQN 서비스 운영과 주요 업무를 빠르게 확인합니다.
          </Text>
        </View>

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
