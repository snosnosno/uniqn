import React, { memo, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { TournamentStatusBadge } from '@/components/jobs/TournamentStatusBadge';
import { PostingCardSurface } from '@/components/jobs/shared/PostingCardSurface';
import { QrCodeIcon, ShareIcon, UsersIcon } from '@/components/icons';
import { Badge, NumericText, type CardStripeTone } from '@/components/ui';
import { STATUS } from '@/constants';
import { toJobPostingCard } from '@/domains/job-posting';
import { useShare } from '@/hooks/useShare';
import { getPostingStatusMeta } from '@/components/jobs/shared/postingSurfaceModel';
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
};

export interface JobPostingCardProps {
  posting: JobPosting;
  onPress: (posting: JobPosting) => void;
  onClose: (postingId: string) => void;
  onReopen: (postingId: string) => void;
  onShowQR: (posting: JobPosting) => void;
  isClosing: boolean;
  isReopening: boolean;
}

export const JobPostingCard = memo(function JobPostingCard({
  posting,
  onPress,
  onClose,
  onReopen,
  onShowQR,
  isClosing,
  isReopening,
}: JobPostingCardProps) {
  const card = useMemo(() => toJobPostingCard(posting), [posting]);
  const stripeTone = POSTING_STRIPE_TONE[posting.status];
  const statusLabel = getPostingStatusMeta(posting.status).label;
  const { shareJob, isSharing } = useShare();

  return (
    <View className="mx-4 mb-3">
      <PostingCardSurface
        card={card}
        onPress={() => onPress(posting)}
        pressableClassName="p-4"
        accessibilityLabel={`${posting.title} 공고 상세보기`}
        stripeTone={stripeTone}
        containerClassName="overflow-hidden"
        footer={
          <View className="mt-2 flex-row items-center justify-between border-t border-secondary-100 px-4 pt-2 dark:border-surface-overlay">
            <View className="flex-row items-center">
              <UsersIcon size={14} color="#B8962E" />
              <NumericText className="ml-1 text-xs text-content-muted dark:text-secondary-400 font-sans">
                지원자 {posting.stats?.totalApplicants ?? 0}
              </NumericText>
            </View>

            <View className="flex-row items-center gap-2">
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

              <Pressable
                onPress={() => onShowQR(posting)}
                className="p-1.5 active:opacity-70"
                accessibilityLabel="현장 QR 표시"
                accessibilityRole="button"
              >
                <QrCodeIcon size={18} color="#B8962E" />
              </Pressable>

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

              {posting.status === STATUS.JOB_POSTING.ACTIVE ? (
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

              {posting.status === STATUS.JOB_POSTING.CLOSED ? (
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

export default JobPostingCard;
