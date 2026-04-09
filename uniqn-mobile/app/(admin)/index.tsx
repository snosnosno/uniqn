import { Pressable, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import {
  ChatbubbleEllipsesOutlineIcon,
  DocumentTextOutlineIcon,
  FlagOutlineIcon,
  PeopleOutlineIcon,
  RefreshIcon,
  TrophyOutlineIcon,
  type IconComponent,
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
      <Pressable className="rounded-xl border border-gray-100 bg-white p-4 active:opacity-80 dark:border-surface-overlay dark:bg-surface">
        <View className={`mb-3 h-12 w-12 items-center justify-center rounded-lg ${bgColor}`}>
          <Icon size={24} color={iconColor} />
        </View>
        <Text className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">{title}</Text>
        <Text className="text-sm text-gray-500 dark:text-gray-400">{description}</Text>
      </Pressable>
    </Link>
  );
}

export default function AdminDashboard() {
  const menuItems: DashboardCardProps[] = [
    {
      title: '대회공고 검토',
      description: '대회공고 인증 요청을 검토하고 처리합니다.',
      icon: TrophyOutlineIcon,
      iconColor: '#eab308',
      href: '/(admin)/tournaments',
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
    },
    {
      title: '사용자 관리',
      description: '회원 정보와 권한을 확인합니다.',
      icon: PeopleOutlineIcon,
      iconColor: '#9333EA',
      href: '/(admin)/users',
      bgColor: 'bg-primary-100 dark:bg-primary-900/30',
    },
    {
      title: '신고 관리',
      description: '일반 서비스 신고를 검토하고 처리합니다.',
      icon: FlagOutlineIcon,
      iconColor: '#dc2626',
      href: '/(admin)/reports',
      bgColor: 'bg-red-100 dark:bg-red-900/30',
    },
    {
      title: '게시판 신고',
      description: '게시글과 댓글 신고를 검토합니다.',
      icon: FlagOutlineIcon,
      iconColor: '#b91c1c',
      href: '/(admin)/board-reports',
      bgColor: 'bg-rose-100 dark:bg-rose-900/30',
    },
    {
      title: '문의 관리',
      description: '사용자 문의를 확인하고 답변합니다.',
      icon: ChatbubbleEllipsesOutlineIcon,
      iconColor: '#0891b2',
      href: '/(admin)/inquiries',
      bgColor: 'bg-cyan-100 dark:bg-cyan-900/30',
    },
    {
      title: '통계',
      description: '최근 서비스 지표를 확인합니다.',
      icon: RefreshIcon,
      iconColor: '#2563eb',
      href: '/(admin)/stats',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      title: '공지사항 관리',
      description: '공지사항을 작성하고 관리합니다.',
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
          <Text className="mb-1 text-2xl font-bold text-gray-900 dark:text-white">관리자</Text>
          <Text className="text-gray-500 dark:text-gray-400">
            주요 운영 화면을 한 곳에서 빠르게 확인합니다.
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
