/**
 * UNIQN Mobile - 개인정보 열람 화면
 *
 * @description 개인정보 열람 화면 (법적 필수) — 수정은 설정 > 프로필 수정 경유
 * @version 1.0.0
 */

import { useState, useCallback, useEffect } from 'react';
import { PRIMARY_COLORS } from '@/constants/colors';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackHeader } from '@/components/headers';
import { ShieldCheckIcon } from '@/components/icons';
import { Card } from '@/components/ui/Card';
import { useAuthStore, useThemeStore, useToastStore } from '@/stores';
import { getMyData } from '@/services';
import type { FirestoreUserProfile } from '@/types';
import { logger } from '@/utils/logger';
import { toDate, type DateInput } from '@/utils/date';
import { formatBirthDate } from '@/utils/formatters';
import { formatE164ToDisplay } from '@/utils/phone';

// ============================================================================
// Data Row Component
// ============================================================================

interface DataRowProps {
  label: string;
  value: string | null;
}

function DataRow({ label, value }: DataRowProps) {
  return (
    <View className="flex-row items-center justify-between py-3 border-b border-divider">
      <Text className="text-content-muted text-sm font-sans">{label}</Text>
      <Text className="text-content-primary font-sans-medium">{value || '-'}</Text>
    </View>
  );
}

// ============================================================================
// Screen Component
// ============================================================================

export default function MyDataScreen() {
  const { isDarkMode } = useThemeStore();
  const { user } = useAuthStore();
  const { addToast } = useToastStore();

  const [userData, setUserData] = useState<FirestoreUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 데이터 로드
  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      const data = await getMyData(user.uid);
      setUserData(data);
    } catch (error) {
      logger.error('개인정보 로드 실패', error as Error);
      addToast({ type: 'error', message: '개인정보를 불러오는데 실패했습니다' });
    } finally {
      setIsLoading(false);
    }
  }, [user, addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 날짜 포맷
  const formatDate = (timestamp: DateInput): string => {
    const date = toDate(timestamp);
    if (!date) return '-';
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // 역할 한글 변환
  const getRoleLabel = (role: string): string => {
    const roleMap: Record<string, string> = {
      admin: '관리자',
      employer: '구인자',
      staff: '스태프',
    };
    return roleMap[role] || role;
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader title="내 정보" fallbackHref="/(app)/settings" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            size="large"
            color={isDarkMode ? PRIMARY_COLORS[300] : PRIMARY_COLORS[700]}
          />
          <Text className="mt-4 text-content-muted font-sans">정보를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader title="내 정보" fallbackHref="/(app)/settings" />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 안내 카드 */}
        <Card className="mb-6 bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800">
          <View className="flex-row items-start">
            <View className="mr-3">
              <ShieldCheckIcon size={24} color={PRIMARY_COLORS[700]} />
            </View>
            <View className="flex-1">
              <Text className="text-primary-800 dark:text-primary-200 font-sans-semibold mb-1">
                개인정보 처리방침
              </Text>
              <Text className="text-primary-700 dark:text-primary-300 text-sm font-sans">
                개인정보보호법에 따라 수집된 개인정보를 열람할 수 있습니다. 정보 수정은 프로필
                수정에서 할 수 있습니다.
              </Text>
            </View>
          </View>
        </Card>

        {/* 기본 정보 */}
        <Card className="mb-4">
          <Text className="text-micro uppercase tracking-wider text-content-muted font-sans-bold mb-4">
            기본 정보
          </Text>

          <DataRow label="이메일" value={userData?.email ?? null} />
          <DataRow label="이름" value={userData?.name ?? null} />
          <DataRow
            label="연락처"
            value={userData?.phone ? formatE164ToDisplay(userData.phone) : null}
          />
          <DataRow label="닉네임" value={userData?.nickname ?? null} />
          <DataRow label="회원 유형" value={getRoleLabel(userData?.role ?? '')} />
          <DataRow label="가입일" value={formatDate(userData?.createdAt)} />
          <DataRow label="수정일" value={formatDate(userData?.updatedAt)} />
        </Card>

        {/* 본인인증 정보 — B12: 기본 정보와 중복되는 이름/연락처 제거. 인증 상태 + 생년월일/성별만 */}
        <Card className="mb-4">
          <Text className="text-micro uppercase tracking-wider text-content-muted font-sans-bold mb-4">
            본인인증 정보
          </Text>

          <DataRow label="본인인증" value={userData?.identityVerified ? '인증 완료' : '미인증'} />
          <DataRow label="전화번호 인증" value={userData?.phoneVerified ? '인증 완료' : '미인증'} />
          <DataRow
            label="생년월일"
            value={userData?.birthDate ? formatBirthDate(userData.birthDate) : null}
          />
          <DataRow
            label="성별"
            value={
              userData?.gender === 'male' ? '남성' : userData?.gender === 'female' ? '여성' : null
            }
          />
        </Card>

        {/* 동의 정보 */}
        <Card className="mb-4">
          <Text className="text-micro uppercase tracking-wider text-content-muted font-sans-bold mb-4">
            동의 정보
          </Text>

          <DataRow label="이용약관" value={userData?.termsAgreed ? '동의함' : '미동의'} />
          <DataRow label="개인정보처리방침" value={userData?.privacyAgreed ? '동의함' : '미동의'} />
          <DataRow label="마케팅 수신" value={userData?.marketingAgreed ? '동의함' : '미동의'} />
        </Card>

        {/* 개인정보 삭제 안내 */}
        <Card className="bg-surface-card dark:bg-surface-elevated">
          <Text className="text-content-muted text-sm leading-5 font-sans">
            개인정보 삭제를 원하시면 회원탈퇴를 진행해주세요. 탈퇴 시 30일간의 유예 기간이 있으며,
            이 기간 동안 복구가 가능합니다.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
