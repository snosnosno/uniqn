import React, { memo, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { TournamentStatusBadge } from '@/components/jobs/TournamentStatusBadge';
import { PostingCardSurface } from '@/components/jobs/shared/PostingCardSurface';
import { QrCodeIcon, ShareIcon, UsersIcon } from '@/components/icons';
import { Badge, Checkbox, NumericText, type CardStripeTone } from '@/components/ui';
import { STATUS } from '@/constants';
import { toJobPostingCard } from '@/domains/job-posting';
import { useShare } from '@/hooks/useShare';
import { extractPostingFilledSubmap } from '@/hooks/usePostingFilledCounts';
import { getPostingStatusMeta } from '@/components/jobs/shared/postingSurfaceModel';
import { isFixedJobPosting } from '@/utils/normalizers';
import type { JobPosting, JobPostingStatus, TournamentApprovalStatus } from '@/types';

/**
 * Job posting status → stripe tone.
 * gold: active (live) · approved (ready to publish)
 * muted: draft · capacity_full · closed · cancelled · expired
 * warning: pending (awaiting approval)
 * error: rejected
 */
const POSTING_STRIPE_TONE: Record<JobPostingStatus, CardStripeTone> = {
  draft: 'muted',
  pending: 'warning',
  approved: 'gold',
  active: 'gold',
  capacity_full: 'muted',
  closed: 'muted',
  cancelled: 'muted',
  expired: 'muted',
  rejected: 'error',
  // 운영처 컨테이너(숨김) — fail-closed 로 카드 목록에 노출되지 않으나 타입 완전성을 위해 정의.
  container: 'muted',
};

export interface JobPostingCardProps {
  posting: JobPosting;
  onPress: (posting: JobPosting) => void;
  onClose: (postingId: string) => void;
  onReopen: (postingId: string) => void;
  onShowQR: (posting: JobPosting) => void;
  isClosing: boolean;
  isReopening: boolean;
  /**
   * 전역 확정 인원 맵 (usePostingFilledCounts) — 키 `${jobPostingId}__${date}__${slot}__${role}`.
   * 카드 내부에서 posting.id 로 서브맵(`date__slot__role`)을 추출해 모델 조회 키와 맞춘다.
   */
  filledCounts?: Map<string, number>;
  /** 묶음 공유 선택 모드 — 카드 탭이 상세 이동 대신 선택 토글로 바뀐다. */
  selectionMode?: boolean;
  /** 선택 여부 (selectionMode 일 때만 의미 있음) */
  selected?: boolean;
  /** 공유 불가 공고는 선택 자체를 막는다(fail-closed) */
  selectable?: boolean;
  onToggleSelect?: (posting: JobPosting) => void;
}

export const JobPostingCard = memo(function JobPostingCard({
  posting,
  onPress,
  onClose,
  onReopen,
  onShowQR,
  isClosing,
  isReopening,
  filledCounts,
  selectionMode = false,
  selected = false,
  selectable = true,
  onToggleSelect,
}: JobPostingCardProps) {
  const card = useMemo(() => toJobPostingCard(posting), [posting]);
  // 전역맵 → 이 공고의 서브맵(`date__slot__role`) 추출. 이 변환 없이 전역맵을 넘기면
  // 모델 조회 키(postingId 접두 없음)와 미스매치해 확정 인원이 전건 0/N 으로 표시된다.
  const cardFilledCounts = useMemo(
    () => extractPostingFilledSubmap(filledCounts, posting.id),
    [filledCounts, posting.id]
  );
  const stripeTone = POSTING_STRIPE_TONE[posting.status];
  const statusLabel = getPostingStatusMeta(posting.status).label;
  const isFixed = isFixedJobPosting(posting);
  const { shareJob, isSharing } = useShare();

  // 선택 모드에서는 카드 전체가 체크박스처럼 동작한다 — 작은 체크 박스만 탭 타깃으로 두면
  // 10건을 고르는 동안 오조작이 잦다. 공유 불가 공고는 탭해도 반응하지 않는다.
  const handlePress = () => {
    if (!selectionMode) {
      onPress(posting);
      return;
    }
    if (selectable) {
      onToggleSelect?.(posting);
    }
  };

  return (
    <View className="mx-4 mb-3">
      <PostingCardSurface
        card={card}
        onPress={handlePress}
        pressableClassName="p-4"
        accessibilityLabel={
          selectionMode ? `${posting.title} 공고 선택` : `${posting.title} 공고 상세보기`
        }
        stripeTone={stripeTone}
        containerClassName={`overflow-hidden ${
          selectionMode && !selectable ? 'opacity-50' : ''
        } ${selected ? 'border-2 border-primary-500 dark:border-primary-400' : ''}`}
        filledCounts={cardFilledCounts}
        showSeatTotals
        topStatus={
          selectionMode ? (
            <Checkbox
              checked={selected}
              disabled={!selectable}
              onChange={() => onToggleSelect?.(posting)}
              size="md"
              label={selectable ? undefined : '공유할 수 없는 공고'}
              testID={`bulk-share-checkbox-${posting.id}`}
            />
          ) : undefined
        }
        footer={
          <View className="mt-2 flex-row items-center justify-between border-t border-secondary-100 px-4 pt-2 dark:border-surface-overlay">
            <View className="flex-row items-center">
              <UsersIcon size={14} color="#B8962E" />
              <NumericText className="ml-1 text-xs text-content-muted dark:text-secondary-400 font-sans">
                지원자 {posting.stats?.totalApplicants ?? 0}
              </NumericText>
            </View>

            <View className="flex-row items-center gap-2">
              {/* 선택 모드에서는 개별 액션을 감춘다 — 카드 전체가 선택 토글이라
                  안쪽 아이콘 탭이 오조작으로 이어진다. */}
              {!selectionMode ? (
                <Pressable
                  onPress={(event) => {
                    event?.stopPropagation?.();
                    void shareJob(posting);
                  }}
                  disabled={isSharing}
                  className="p-1.5 active:opacity-70"
                  accessibilityLabel="공고 공유하기"
                  accessibilityRole="button"
                >
                  <ShareIcon size={18} />
                </Pressable>
              ) : null}

              {/* 고정 공고는 QR 진입점을 노출하지 않는다. 고정 공고의 work_log 는 스태프·공고당
                  1행이고 그 행을 scheduled 로 되돌리는 코드가 없어, 2일차부터 모든 스캔이
                  "이미 퇴근 처리됐습니다"로 영구 실패한다. 행 수명 재설계는 별도 PR.
                  (헤더 QR 버튼의 동일한 게이트는 app/(employer)/my-postings/[id]/_layout.tsx 참고) */}
              {!isFixed && !selectionMode ? (
                <Pressable
                  onPress={() => onShowQR(posting)}
                  className="p-1.5 active:opacity-70"
                  accessibilityLabel="현장 QR 표시"
                  accessibilityRole="button"
                >
                  <QrCodeIcon size={18} color="#B8962E" />
                </Pressable>
              ) : null}

              {card.workflow.isTournament && posting.tournamentConfig?.approvalStatus ? (
                <TournamentStatusBadge
                  status={posting.tournamentConfig.approvalStatus as TournamentApprovalStatus}
                  rejectionReason={posting.tournamentConfig.rejectionReason}
                  jobPostingId={posting.id}
                  size="sm"
                />
              ) : null}

              <Badge variant="chip" size="sm">
                {statusLabel}
              </Badge>

              {!selectionMode &&
              (posting.status === STATUS.JOB_POSTING.ACTIVE ||
                posting.status === STATUS.JOB_POSTING.CAPACITY_FULL) ? (
                <Pressable
                  onPress={() => onClose(posting.id)}
                  disabled={isClosing}
                  className="rounded-md bg-surface-card px-3 py-1.5 active:opacity-70 dark:bg-surface"
                  accessibilityLabel={`${posting.title} 공고 마감하기`}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isClosing }}
                  testID={`employer-close-posting-${posting.id}`}
                >
                  <Text className="text-xs font-sans-medium text-content-secondary">
                    {isClosing ? '처리중...' : '마감하기'}
                  </Text>
                </Pressable>
              ) : null}

              {!selectionMode && posting.status === STATUS.JOB_POSTING.CLOSED ? (
                <Pressable
                  onPress={() => onReopen(posting.id)}
                  disabled={isReopening}
                  className="rounded-md bg-primary-50 px-3 py-1.5 active:opacity-70 dark:bg-primary-900/30"
                  accessibilityLabel={`${posting.title} 공고 재오픈하기`}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isReopening }}
                  testID={`employer-reopen-posting-${posting.id}`}
                >
                  <Text className="text-xs font-sans-medium text-primary-600 dark:text-primary-400">
                    {isReopening ? '처리중...' : '재오픈'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        }
      />
    </View>
  );
});
