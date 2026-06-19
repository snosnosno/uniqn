import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { STATUS_COLORS } from '@/constants/colors';
import { router } from 'expo-router';
import { StackHeader } from '@/components/headers';
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
    <Pressable
      onPress={() => router.push(href as never)}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={description}
      className="relative rounded-md border border-secondary-100 bg-white p-4 active:opacity-80 dark:border-surface-overlay dark:bg-surface"
    >
      {/* CardStripe tone="gold" thickness={2} 와 동일한 좌측 골드 스트라이프 (Pressable collapse 방지 위해 인라인) */}
      <View
        className="bg-primary-500 dark:bg-primary-400 rounded-sm"
        style={{ position: 'absolute', left: 0, top: 12, bottom: 12, width: 2 }}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <View className={`mb-3 h-12 w-12 items-center justify-center rounded-lg ${bgColor}`}>
        <Icon size={24} color={iconColor} />
      </View>
      <Text className="mb-1 text-lg font-display-semibold text-content-primary dark:text-off-white">
        {title}
      </Text>
      <Text className="text-sm text-content-secondary font-sans">{description}</Text>
    </Pressable>
  );
}

export default function AdminDashboard() {
  const menuItems: DashboardCardProps[] = [
    {
      title: '대회공고 검토',
      description: '대회공고 인증 요청을 검토하고 처리합니다.',
      icon: TrophyOutlineIcon,
      iconColor: '#EAB308',
      href: '/(admin)/tournaments',
      bgColor: 'bg-warning-100 dark:bg-warning-900/30',
    },
    {
      title: '사용자 관리',
      description: '회원 정보와 권한을 확인합니다.',
      icon: PeopleOutlineIcon,
      iconColor: '#B8962E',
      href: '/(admin)/users',
      bgColor: 'bg-primary-100 dark:bg-primary-900/30',
    },
    {
      title: '신고 관리',
      description: '일반 서비스 신고를 검토하고 처리합니다.',
      icon: FlagOutlineIcon,
      iconColor: STATUS_COLORS.error,
      href: '/(admin)/reports',
      bgColor: 'bg-error-50 dark:bg-error-900/30',
    },
    {
      title: '게시판 신고',
      description: '게시글과 댓글 신고를 검토합니다.',
      icon: FlagOutlineIcon,
      iconColor: '#B91C1C',
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
      title: '구인자 신청',
      description: '구인자 등록 신청을 검토하고 승인/거부합니다.',
      icon: PeopleOutlineIcon,
      iconColor: '#10B981',
      href: '/(admin)/employer-applications',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    },
    {
      title: '통계',
      description: '최근 서비스 지표를 확인합니다.',
      icon: RefreshIcon,
      iconColor: STATUS_COLORS.info,
      href: '/(admin)/stats',
      bgColor: 'bg-info-100 dark:bg-info-900/30',
    },
    {
      title: '공지사항 관리',
      description: '공지사항을 작성하고 관리합니다.',
      icon: DocumentTextOutlineIcon,
      iconColor: '#EA580C',
      href: '/(admin)/announcements',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30',
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader title="관리자" fallbackHref="/(app)/(tabs)/home-jobs" />
      <ScrollView className="flex-1 bg-surface-page dark:bg-surface">
        <View className="p-4">
          <View className="mb-6">
            <Text className="mb-1 text-2xl font-display text-content-primary dark:text-off-white">
              관리자
            </Text>
            <Text className="text-content-secondary font-sans">
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
    </SafeAreaView>
  );
}
