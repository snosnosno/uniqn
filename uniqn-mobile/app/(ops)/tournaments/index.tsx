/**
 * ops 대회 목록/피커 화면.
 * - 1a: 목록/피커, 1e: `?postingId=` 필터(해당 공고 연결 대회만)
 * - S1 A2+A3: 재개 카드(active 최신 우선) · 빈 상태 3단 온보딩 · 디자인 토큰 · Skeleton ·
 *   진입 계측(ops_hub_entered) — 전 회원 개방(D11)에 맞춘 시각 계층 개편.
 *
 * 상태 매트릭스(설계 §9.1): LOADING / EMPTY / ERROR / SUCCESS / PARTIAL.
 */
import { useMemo } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { AppFlashList } from '@/components/ui/AppFlashList';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { StackHeader } from '@/components/headers';
import { TrophyOutlineIcon, AlertCircleIcon } from '@/components/icons';
import { SECONDARY_PALETTE, getLayoutColor } from '@/constants/colors';
import { useThemeStore } from '@/stores/themeStore';
import { useOpsTournaments } from '@/hooks/ops';
import { useOpsHubEnteredOnce } from '@/hooks/ops/useOpsHubEnteredOnce';
import { selectResumeTournament } from '@/domains/ops';
import type { OpsTournament, OpsTournamentStatus } from '@/types/ops';

// ============================================================================
// 상태 배지 (디자인 토큰 — raw gray 금지)
// ============================================================================

const STATUS_BADGE: Record<OpsTournamentStatus, { label: string; bg: string; text: string }> = {
  upcoming: {
    label: '예정',
    bg: 'bg-info-100 dark:bg-info-900/30',
    text: 'text-info-700 dark:text-info-300',
  },
  active: {
    label: '진행 중',
    bg: 'bg-success-100 dark:bg-success-900/30',
    text: 'text-success-700 dark:text-success-300',
  },
  completed: {
    label: '종료',
    bg: 'bg-secondary-100 dark:bg-surface-overlay',
    text: 'text-secondary-600 dark:text-secondary-300',
  },
};

function StatusBadge({ status }: { status: OpsTournamentStatus }) {
  const badge = STATUS_BADGE[status];
  return (
    <View className={`ml-2 rounded-full px-2 py-0.5 ${badge.bg}`}>
      <Text className={`text-xs font-sans-semibold ${badge.text}`}>{badge.label}</Text>
    </View>
  );
}

/** 보조 메타 — 게임타입 · 장소 · 날짜(존재하는 값만). */
function TournamentMeta({ tournament }: { tournament: OpsTournament }) {
  const meta = [tournament.gameType, tournament.venue, tournament.eventDate]
    .filter(Boolean)
    .join(' · ');
  return (
    <Text className="mt-1 text-sm text-content-secondary dark:text-secondary-400" numberOfLines={1}>
      {meta}
    </Text>
  );
}

// ============================================================================
// 카드 (목록 / 재개)
// ============================================================================

function TournamentCard({
  tournament,
  onPress,
}: {
  tournament: OpsTournament;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      // 룰 21: Pressed 다크/라이트 반대 방향(light 어두워짐 / dark 밝아짐)
      className="mb-3 rounded-lg border border-divider bg-surface-card p-4 active:bg-secondary-100 dark:active:bg-surface-hover"
    >
      <View className="flex-row items-center justify-between">
        <Text
          className="flex-1 font-sans-semibold text-base text-content-primary dark:text-off-white"
          numberOfLines={1}
        >
          {tournament.name}
        </Text>
        <StatusBadge status={tournament.status} />
      </View>
      <TournamentMeta tournament={tournament} />
    </Pressable>
  );
}

/** 재개 카드(①) — 대회명 / 상태 배지 / 보조 메타. selectResumeTournament 위임 결과만 렌더. */
function ResumeCard({ tournament, onPress }: { tournament: OpsTournament; onPress: () => void }) {
  return (
    <Pressable
      testID="ops-resume-card"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`이어서 운영: ${tournament.name}`}
      className="mb-4 rounded-xl border border-divider bg-surface-card p-4 active:bg-secondary-100 dark:active:bg-surface-hover"
    >
      <Text className="mb-1.5 text-xs font-sans-semibold uppercase tracking-chip text-primary-600 dark:text-primary-300">
        이어서 운영
      </Text>
      <View className="flex-row items-center justify-between">
        <Text
          className="flex-1 font-display-semibold text-lg text-content-primary dark:text-off-white"
          numberOfLines={1}
        >
          {tournament.name}
        </Text>
        <StatusBadge status={tournament.status} />
      </View>
      <TournamentMeta tournament={tournament} />
    </Pressable>
  );
}

// ============================================================================
// 상태별 화면 (LOADING / EMPTY / ERROR)
// ============================================================================

/** 카드 형태 Skeleton — 공간 예약(레이아웃 시프트 금지). 내부는 accessible=false(컨테이너가 announce). */
function TournamentCardSkeleton() {
  return (
    <View className="mb-3 rounded-lg border border-divider bg-surface-card p-4">
      <View className="flex-row items-center justify-between">
        <Skeleton width="55%" height={16} accessible={false} />
        <Skeleton width={52} height={20} borderRadius={10} accessible={false} />
      </View>
      <Skeleton width="72%" height={13} style={{ marginTop: 12 }} accessible={false} />
    </View>
  );
}

/** LOADING: Skeleton 3행 + (메인 모드) 재개 카드 Skeleton — 실제 카드와 동일 공간 예약. */
function LoadingState({ postingId }: { postingId?: string }) {
  return (
    <View
      testID="ops-list-skeleton"
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="대회 목록 불러오는 중"
      className="p-4"
    >
      {!postingId && (
        <View className="mb-4 rounded-xl border border-divider bg-surface-card p-4">
          <Skeleton width={72} height={12} accessible={false} />
          <View className="mt-2 flex-row items-center justify-between">
            <Skeleton width="55%" height={20} accessible={false} />
            <Skeleton width={52} height={20} borderRadius={10} accessible={false} />
          </View>
          <Skeleton width="70%" height={13} style={{ marginTop: 12 }} accessible={false} />
        </View>
      )}
      <TournamentCardSkeleton />
      <TournamentCardSkeleton />
      <TournamentCardSkeleton />
    </View>
  );
}

/** EMPTY(메인, ②): 인지(아이콘/타이틀) + 가치(설명) + 행동("첫 대회 만들기" CTA). */
function EmptyOnboarding({ onCreate }: { onCreate: () => void }) {
  const isDark = useThemeStore((s) => s.isDarkMode);
  return (
    <View className="flex-1 items-center justify-center px-8">
      <View className="mb-5 h-16 w-16 items-center justify-center rounded-2xl bg-secondary-100 dark:bg-surface-elevated">
        <TrophyOutlineIcon
          size={30}
          color={isDark ? SECONDARY_PALETTE[400] : SECONDARY_PALETTE[500]}
        />
      </View>
      <Text className="mb-2 text-center text-lg font-display-semibold text-content-primary dark:text-off-white">
        첫 대회를 열어보세요
      </Text>
      <Text className="mb-6 text-center text-sm leading-5 text-content-secondary dark:text-secondary-400 dark:leading-sm-dark">
        참가자 등록부터 좌석 배정·블라인드·전광판까지{'\n'}대회 운영을 한 화면에서 관리할 수 있어요.
      </Text>
      <Button variant="primary" onPress={onCreate}>
        첫 대회 만들기
      </Button>
    </View>
  );
}

/** EMPTY(피커/postingId): 공고 연결 안내 + 생성 진입. */
function PostingEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <Text className="mb-6 text-center text-sm leading-5 text-content-secondary dark:text-secondary-400 dark:leading-sm-dark">
        이 공고에 연결된 대회가 없습니다.{'\n'}아래 버튼으로 만들어 연결해 보세요.
      </Text>
      <Button variant="primary" onPress={onCreate}>
        이 공고에 대회 만들기
      </Button>
    </View>
  );
}

/** ERROR(데이터 없음): 에러 + 재시도. 진입점(헤더 생성 버튼)은 항상 유지. */
function ErrorRetry({ onRetry }: { onRetry: () => void }) {
  return (
    <View testID="ops-error" className="flex-1 items-center justify-center px-8">
      <View className="mb-5 h-16 w-16 items-center justify-center rounded-2xl bg-error-100">
        <AlertCircleIcon size={30} color="#DC2626" />
      </View>
      <Text className="mb-2 text-center text-lg font-display-semibold text-content-primary dark:text-off-white">
        대회를 불러오지 못했어요
      </Text>
      <Text className="mb-6 text-center text-sm leading-5 text-content-secondary dark:text-secondary-400 dark:leading-sm-dark">
        네트워크 상태를 확인한 뒤 다시 시도해 주세요.
      </Text>
      <Button variant="outline" onPress={onRetry}>
        다시 시도
      </Button>
    </View>
  );
}

/** ERROR(캐시 데이터 있음): 목록은 유지하되 상단에 재시도 배너 노출. */
function ErrorBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <View
      testID="ops-error-banner"
      className="mb-4 flex-row items-center justify-between rounded-lg border border-error-200 bg-error-50 px-4 py-3 dark:border-error-900"
    >
      <Text className="mr-3 flex-1 text-sm text-error-700 dark:text-error-300">
        목록을 최신화하지 못했어요.
      </Text>
      <Pressable
        onPress={onRetry}
        accessibilityRole="button"
        className="rounded-md px-2 py-1 active:opacity-70"
      >
        <Text className="text-sm font-sans-semibold text-error-700 dark:text-error-300">
          다시 시도
        </Text>
      </Pressable>
    </View>
  );
}

// ============================================================================
// Screen
// ============================================================================

export default function OpsTournamentListScreen() {
  const { postingId: postingIdParam } = useLocalSearchParams<{ postingId?: string }>();
  const postingId = Array.isArray(postingIdParam) ? postingIdParam[0] : postingIdParam;
  const { tournaments, isLoading, error, refetch } = useOpsTournaments();
  const isDark = useThemeStore((s) => s.isDarkMode);

  // ⑤ 진입 계측: 메인 허브 진입만 1회. 피커(postingId)는 퍼널 분모(impression) 밖 진입이라 제외.
  useOpsHubEnteredOnce(!postingId);

  const filteredTournaments = useMemo(
    () => (postingId ? tournaments.filter((t) => t.jobPostingId === postingId) : tournaments),
    [tournaments, postingId]
  );

  // ① 재개 카드: 메인 모드 + 에러 아님일 때만. 선택 로직은 selectResumeTournament 위임(재구현 금지).
  const resume = useMemo(
    () => (!postingId && !error ? selectResumeTournament(filteredTournaments, Date.now()) : null),
    [postingId, error, filteredTournaments]
  );

  const createHref = postingId
    ? `/(ops)/tournaments/new?postingId=${postingId}`
    : '/(ops)/tournaments/new';

  const goCreate = () => router.push(createHref);
  const goDetail = (id: string) => router.push(`/(ops)/tournaments/${id}`);
  const handleRetry = () => {
    void refetch();
  };

  const hasData = filteredTournaments.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
      <StackHeader
        title="라이브 운영"
        fallbackHref="/(app)/(tabs)/home-jobs"
        rightAction={
          <Pressable
            onPress={goCreate}
            accessibilityRole="button"
            className="rounded-md bg-primary-600 px-3 py-1.5 active:opacity-70"
          >
            <Text className="font-sans-semibold text-sm text-white">+ 대회</Text>
          </Pressable>
        }
      />

      {isLoading ? (
        <LoadingState postingId={postingId} />
      ) : error && !hasData ? (
        <ErrorRetry onRetry={handleRetry} />
      ) : !hasData ? (
        postingId ? (
          <PostingEmpty onCreate={goCreate} />
        ) : (
          <EmptyOnboarding onCreate={goCreate} />
        )
      ) : (
        <AppFlashList
          data={filteredTournaments}
          keyExtractor={(t: OpsTournament) => t.id}
          estimatedItemSize={88}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={handleRetry}
              tintColor={getLayoutColor(isDark, 'refreshTint')}
              colors={[getLayoutColor(isDark, 'refreshTint')]}
            />
          }
          ListHeaderComponent={
            error || resume ? (
              <View>
                {error ? <ErrorBanner onRetry={handleRetry} /> : null}
                {resume ? (
                  <ResumeCard tournament={resume} onPress={() => goDetail(resume.id)} />
                ) : null}
              </View>
            ) : null
          }
          renderItem={({ item }: { item: OpsTournament }) => (
            <TournamentCard tournament={item} onPress={() => goDetail(item.id)} />
          )}
        />
      )}
    </SafeAreaView>
  );
}
