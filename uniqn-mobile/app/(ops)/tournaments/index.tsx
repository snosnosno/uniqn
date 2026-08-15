/**
 * ops 대회 목록/피커 화면.
 * - 1a: 목록/피커, 1e: `?postingId=` 필터(해당 공고 연결 대회만)
 * - S1 A2+A3: 재개 카드(active 최신 우선) · 빈 상태 3단 온보딩 · 디자인 토큰 · Skeleton ·
 *   진입 계측(ops_hub_entered) — 전 회원 개방(D11)에 맞춘 시각 계층 개편.
 *
 * 상태 매트릭스(설계 §9.1): LOADING / EMPTY / ERROR / SUCCESS / PARTIAL.
 */
import { useMemo, useState } from 'react';
import { View, Text, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { AppFlashList } from '@/components/ui/AppFlashList';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { opsFallbackHref } from '@/utils/opsNavigation';
import { StackHeader } from '@/components/headers';
import {
  TrophyOutlineIcon,
  AlertCircleIcon,
  CopyIcon,
  ArchiveOutlineIcon,
} from '@/components/icons';
import { confirmAction } from '@/utils/confirmAction';
import { SECONDARY_PALETTE, getLayoutColor } from '@/constants/colors';
import { useThemeStore } from '@/stores/themeStore';
// ⚠️ 형제 훅과 **같은 배럴**(`@/hooks/ops`)에서 가져온다. 직접 경로(`@/hooks/ops/useOpsMutations`)로
//    가져오면 이 화면의 기존 테스트가 걸어 둔 `jest.mock('@/hooks/ops')` 를 우회해 실제 훅이 돌고,
//    QueryClientProvider 없이 `useQueryClient()` 가 터진다(실제로 10항목이 빨갛게 됐다).
import { useOpsTournaments, useDuplicateTournament, useSetTournamentArchived } from '@/hooks/ops';
import { useOpsHubEnteredOnce } from '@/hooks/ops/useOpsHubEnteredOnce';
import { selectResumeTournament, kstDateString } from '@/domains/ops';
import type { OpsTournament, OpsTournamentStatus } from '@/types/ops';
import { useManualRefresh } from '@/hooks/useManualRefresh';

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

/**
 * 복제 액션 버튼(A4) — 완료 대회 카드 전용 보조 액션.
 * - 카드 본체 터치(상세 진입)와 분리된 별도 터치 타깃(44px, 룰: 최소 터치 영역).
 * - 보조 액션이므로 골드 금지 · muted 아이콘 색(디자인 토큰). 진행 중이면 비활성(연타 방지).
 */
function DuplicateButton({
  testID,
  onPress,
  disabled,
}: {
  testID: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const isDark = useThemeStore((s) => s.isDarkMode);
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="이 설정으로 새 대회 복제"
      accessibilityState={{ disabled }}
      // 44px 터치 타깃(h-11 w-11). 행 높이 증가 최소화를 위해 세로 여백은 음수 마진으로 흡수.
      className={`-my-1.5 ml-1 h-11 w-11 items-center justify-center rounded-lg active:bg-secondary-100 dark:active:bg-surface-hover ${
        disabled ? 'opacity-40' : ''
      }`}
    >
      <CopyIcon size={18} color={isDark ? SECONDARY_PALETTE[400] : SECONDARY_PALETTE[500]} />
    </Pressable>
  );
}

/**
 * 보관/복원 액션(결함③) — 카드 전용 보조 액션.
 * 훅을 리프에서 호출한다: `useSetTournamentArchived` 는 무효화를 위해 대회 id 를 클로저로 잡으므로
 * 목록 상위에서 한 번 만들 수 없다(행마다 id 가 다르다).
 * 🔑 hard DELETE 는 `ops_events` append-only 트리거와 충돌해 불가능하다 — 보관이 "치우기"의
 *    유일한 경로이므로 라벨도 '삭제'가 아니라 '보관'이다(되돌릴 수 있음을 문구로 알린다).
 */
function ArchiveButton({ tournament }: { tournament: OpsTournament }) {
  const isDark = useThemeStore((s) => s.isDarkMode);
  const archiveMut = useSetTournamentArchived(tournament.id);
  const isArchived = !!tournament.archivedAt;

  const onPress = () => {
    if (archiveMut.isPending) return;
    if (isArchived) {
      // 복원은 되돌리는 방향이라 확인 없이 1탭.
      archiveMut.mutate(false);
      return;
    }
    confirmAction({
      title: '대회 보관',
      message: `'${tournament.name}' 을 보관할까요?\n목록에서 숨겨지고, 보관함에서 언제든 복원할 수 있어요.`,
      confirmText: '보관',
      onConfirm: () => archiveMut.mutate(true),
    });
  };

  return (
    <Pressable
      testID={`ops-archive-${tournament.id}`}
      onPress={onPress}
      disabled={archiveMut.isPending}
      accessibilityRole="button"
      accessibilityLabel={isArchived ? '대회 보관 해제(복원)' : '대회 보관'}
      accessibilityState={{ disabled: archiveMut.isPending }}
      className={`-my-1.5 ml-1 h-11 w-11 items-center justify-center rounded-lg active:bg-secondary-100 dark:active:bg-surface-hover ${
        archiveMut.isPending ? 'opacity-40' : ''
      }`}
    >
      <ArchiveOutlineIcon
        size={18}
        color={isArchived ? '#D4AF37' : isDark ? SECONDARY_PALETTE[400] : SECONDARY_PALETTE[500]}
      />
    </Pressable>
  );
}

function TournamentCard({
  tournament,
  onPress,
  onDuplicate,
  isDuplicating = false,
  showArchiveAction = false,
}: {
  tournament: OpsTournament;
  onPress: () => void;
  onDuplicate?: () => void;
  isDuplicating?: boolean;
  showArchiveAction?: boolean;
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
        {onDuplicate ? (
          <DuplicateButton
            testID={`ops-duplicate-${tournament.id}`}
            onPress={onDuplicate}
            disabled={isDuplicating}
          />
        ) : null}
        {showArchiveAction ? <ArchiveButton tournament={tournament} /> : null}
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

  // PTR 스피너는 사용자가 당겼을 때만 — 조회 상태를 그대로 물리면 화면에 들어올 때마다
  // 배경 재조회로 스피너가 뜬다(useManualRefresh 주석 참고).
  const { refreshing: pullRefreshing, onRefresh: onPullRefresh } = useManualRefresh(() =>
    refetch()
  );
  const duplicate = useDuplicateTournament();
  const isDark = useThemeStore((s) => s.isDarkMode);

  // ⑤ 진입 계측: 메인 허브 진입만 1회. 피커(postingId)는 퍼널 분모(impression) 밖 진입이라 제외.
  useOpsHubEnteredOnce(!postingId);

  // 결함③ 보관함 토글. 기본은 활성만 — 테스트 대회가 목록에 영구 잔존하던 것을 닫는다.
  const [showArchived, setShowArchived] = useState(false);

  const filteredTournaments = useMemo(() => {
    const byPosting = postingId
      ? tournaments.filter((t) => t.jobPostingId === postingId)
      : tournaments;
    // 보관함 모드는 보관분만, 기본 모드는 활성분만 — 섞으면 "치웠는데 그대로 보인다"가 된다.
    return byPosting.filter((t) => (showArchived ? !!t.archivedAt : !t.archivedAt));
  }, [tournaments, postingId, showArchived]);

  // 토글 자체는 보관분이 존재할 때만 노출한다(빈 보관함으로 가는 버튼은 노이즈다).
  const archivedCount = useMemo(
    () =>
      (postingId ? tournaments.filter((t) => t.jobPostingId === postingId) : tournaments).filter(
        (t) => !!t.archivedAt
      ).length,
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

  // A4 복제: 완료 대회 설정으로 새 대회 생성(펍 사장 데일리 루프 "어제 대회 복제 1탭").
  // 확인 후 eventDate=오늘 KST(kstDateString 재사용 — toISOString 직접 사용 시 KST 00~09 하루 밀림 방지)로 복제,
  // 성공 시 새 대회 상세로 이동. 진행 중이면 재진입 차단(연타 방지).
  const handleDuplicate = (tournament: OpsTournament) => {
    if (duplicate.isPending) return;
    confirmAction({
      title: '대회 복제',
      message: `'${tournament.name}' 설정으로 새 대회를 만들까요?`,
      confirmText: '만들기',
      onConfirm: () =>
        duplicate.mutate(
          { sourceTournamentId: tournament.id, eventDate: kstDateString(Date.now()) },
          { onSuccess: (result) => goDetail(result.tournamentId) }
        ),
    });
  };

  const hasData = filteredTournaments.length > 0;

  // 보관함 진입/이탈 토글. 운영 허브 + 보관분이 있을 때만(빈 보관함 버튼은 노이즈).
  const archiveToggle =
    !postingId && (archivedCount > 0 || showArchived) ? (
      <Pressable
        onPress={() => setShowArchived((v) => !v)}
        accessibilityRole="button"
        testID="ops-archive-toggle"
        className="mb-3 min-h-[44px] flex-row items-center justify-center gap-2 rounded-lg border border-divider active:bg-secondary-100 dark:active:bg-surface-hover"
      >
        <ArchiveOutlineIcon
          size={16}
          color={isDark ? SECONDARY_PALETTE[400] : SECONDARY_PALETTE[500]}
        />
        <Text className="text-sm text-content-secondary dark:text-secondary-400">
          {showArchived ? '활성 대회 보기' : `보관함 보기 (${archivedCount})`}
        </Text>
      </Pressable>
    ) : null;

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
      <StackHeader
        title="라이브 운영"
        // 공고에서 넘어온 진입(`?postingId=`)이면 그 공고로 돌려보낸다 — 히스토리가 없는
        // 콜드/딥링크 진입에서 홈으로 떨구면 사장은 관리하던 공고를 다시 찾아야 한다.
        fallbackHref={opsFallbackHref(postingId, '/(app)/(tabs)/home-jobs')}
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
      ) : !hasData && showArchived ? (
        // 보관함이 비었을 때 생성 온보딩을 띄우면 안 된다 — 사용자는 "치운 것"을 보러 왔다.
        // 이탈 경로(토글)가 반드시 남아 있어야 데드엔드가 아니다.
        <View className="flex-1 items-center gap-3 px-4 py-12">
          <ArchiveOutlineIcon size={28} color={SECONDARY_PALETTE[500]} />
          <Text className="text-center text-content-secondary dark:text-secondary-400">
            보관한 대회가 없어요.
          </Text>
          {archiveToggle}
        </View>
      ) : !hasData ? (
        postingId ? (
          <PostingEmpty onCreate={goCreate} />
        ) : (
          // ⚠️ 전 대회가 보관된 상태에서 온보딩만 띄우면 **보관함으로 갈 길이 사라진다**(데드엔드).
          //    빈 상태에서도 토글을 함께 남긴다(archiveToggle 은 보관분 0건이면 null 이라 무해).
          <View className="flex-1">
            <EmptyOnboarding onCreate={goCreate} />
            {archiveToggle ? <View className="px-4 pb-4">{archiveToggle}</View> : null}
          </View>
        )
      ) : (
        <AppFlashList
          data={filteredTournaments}
          keyExtractor={(t: OpsTournament) => t.id}
          estimatedItemSize={88}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={pullRefreshing}
              onRefresh={onPullRefresh}
              tintColor={getLayoutColor(isDark, 'refreshTint')}
              colors={[getLayoutColor(isDark, 'refreshTint')]}
            />
          }
          ListHeaderComponent={
            error || resume || archiveToggle ? (
              <View>
                {error ? <ErrorBanner onRetry={handleRetry} /> : null}
                {resume ? (
                  <ResumeCard tournament={resume} onPress={() => goDetail(resume.id)} />
                ) : null}
                {archiveToggle}
              </View>
            ) : null
          }
          renderItem={({ item }: { item: OpsTournament }) => (
            <TournamentCard
              tournament={item}
              onPress={() => goDetail(item.id)}
              // 복제는 완료 대회 + 운영 허브(피커 아님)에서만 노출.
              onDuplicate={
                !postingId && item.status === 'completed' ? () => handleDuplicate(item) : undefined
              }
              isDuplicating={duplicate.isPending}
              // 보관은 운영 허브에서만(피커는 선택 전용 화면이라 정리 액션이 어울리지 않는다).
              showArchiveAction={!postingId}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}
