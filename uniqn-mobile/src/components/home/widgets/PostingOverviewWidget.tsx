/**
 * PostingOverviewWidget
 * 내 공고 현황 요약 위젯 (Home V2 hero 슬롯 — 고용주 전용)
 *
 * hero 슬롯 역할: 홈 화면 최상단에서 "오늘의 공고 현황"을 한눈에.
 * - 주요 KPI: 새 지원자 수 (gold badge)
 * - 보조: 모집중/마감 공고 건수
 */
import React from 'react';
import { View, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { DashboardWidgetShell } from '@/components/home/DashboardWidgetShell';
import { NumericText } from '@/components/ui';
import { useMyJobPostings } from '@/hooks/useJobManagement';
import { useThemeStore } from '@/stores/themeStore';

const HERO_GRADIENT_DARK = ['#1A1710', '#0B0B0E'] as const;
const HERO_GRADIENT_LIGHT = ['#FAF8F3', '#FFFFFF'] as const;

interface HeroContentProps {
  activeCount: number;
  closedCount: number;
  newApplicantCount: number;
}

function HeroContent({ activeCount, closedCount, newApplicantCount }: HeroContentProps) {
  const accessibilityLabel = `공고 현황: 모집중 ${activeCount}건, 마감 ${closedCount}건, 새 지원자 ${newApplicantCount}명`;

  return (
    <Pressable
      onPress={() => router.push('/(app)/(tabs)/employer')}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <View className="flex-row items-center gap-2 mb-1">
        <View className="bg-primary-500 rounded px-2 py-0.5" style={{ borderRadius: 4 }}>
          <NumericText className="font-sans-bold text-content-onGold" style={{ fontSize: 14 }}>
            새 지원자 {newApplicantCount}
          </NumericText>
        </View>
        <NumericText
          className="text-content-primary font-sans-bold"
          style={{ fontSize: 20, letterSpacing: -0.5 }}
          numberOfLines={1}
        >
          공고 {activeCount}건 모집중
        </NumericText>
      </View>
      <NumericText className="text-content-secondary text-xs mt-1" numberOfLines={1}>
        모집중 {activeCount} · 마감 {closedCount}
      </NumericText>
    </Pressable>
  );
}

export function PostingOverviewWidget() {
  const { data, isLoading, error, refetch } = useMyJobPostings();
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const gradientColors = isDarkMode ? HERO_GRADIENT_DARK : HERO_GRADIENT_LIGHT;

  const postings = data ?? [];
  const activePostings = postings.filter(
    (p) => p.status === 'active' || p.status === 'approved' || p.status === 'capacity_full'
  );
  const closedPostings = postings.filter((p) => p.status === 'closed');

  const newApplicantCount = activePostings.reduce((sum, p) => {
    const active = p.stats?.activeApplicants ?? 0;
    return sum + active;
  }, 0);

  const hasPostings = postings.length > 0;

  return (
    <DashboardWidgetShell
      variant="hero"
      title="오늘의 현황"
      isLoading={isLoading}
      error={error instanceof Error ? error : null}
      onRetry={refetch}
      emptyState={
        hasPostings
          ? undefined
          : {
              message: '진행 중인 공고가 없습니다. 공고를 작성해볼까요?',
              cta: {
                label: '공고 작성',
                onPress: () => router.push('/(employer)/my-postings/create'),
              },
            }
      }
    >
      {hasPostings ? (
        /*
         * Gradient bleed contract:
         * - marginHorizontal: -16 cancels DashboardWidgetShell hero variant's
         *   horizontal px-4 padding so the gradient reaches the card edges.
         * - Shell's vertical py-4 is intentionally preserved (no negative
         *   marginVertical) for breathing room between hero and adjacent widgets.
         * - borderRadius: 12 is retained for future cases where the shell adds
         *   horizontal inset; at full bleed it's a cosmetic no-op.
         */
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{
            borderRadius: 12,
            marginHorizontal: -16,
            paddingHorizontal: 16,
            paddingVertical: 16,
          }}
        >
          <HeroContent
            activeCount={activePostings.length}
            closedCount={closedPostings.length}
            newApplicantCount={newApplicantCount}
          />
        </LinearGradient>
      ) : undefined}
    </DashboardWidgetShell>
  );
}
