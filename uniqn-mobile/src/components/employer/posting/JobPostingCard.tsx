import React, { memo, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { TournamentStatusBadge } from '@/components/jobs/TournamentStatusBadge';
import { PostingCardSurface } from '@/components/jobs/shared/PostingCardSurface';
import { PostingStatusBadge } from '@/components/jobs/shared/PostingStatusBadge';
import { QrCodeIcon, UsersIcon } from '@/components/icons';
import { Card } from '@/components/ui/Card';
import { STATUS } from '@/constants';
import { toJobPostingCard } from '@/domains/job-posting';
import type { JobPosting, TournamentApprovalStatus } from '@/types';

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

  return (
    <Card variant="elevated" padding="none" className="mx-4 mb-3 overflow-hidden">
      <PostingCardSurface
        card={card}
        onPress={() => onPress(posting)}
        pressableClassName="p-4"
        accessibilityLabel={`${posting.title} 공고 상세보기`}
        footer={
          <View className="mt-2 flex-row items-center justify-between border-t border-gray-100 px-4 pt-2 dark:border-surface-overlay">
            <View className="flex-row items-center">
              <UsersIcon size={14} color="#9333EA" />
              <Text className="ml-1 text-xs text-gray-600 dark:text-gray-400">
                지원자 {posting.applicationCount || 0}
              </Text>
            </View>

            <View className="flex-row items-center gap-2">
              <Pressable
                onPress={() => onShowQR(posting)}
                className="p-1.5 active:opacity-70"
                accessibilityLabel="현장 QR 표시"
                accessibilityRole="button"
              >
                <QrCodeIcon size={18} color="#9333EA" />
              </Pressable>

              {card.workflow.isTournament && posting.tournamentConfig?.approvalStatus ? (
                <TournamentStatusBadge
                  status={posting.tournamentConfig.approvalStatus as TournamentApprovalStatus}
                  rejectionReason={posting.tournamentConfig.rejectionReason}
                  postingId={posting.id}
                  size="sm"
                />
              ) : null}

              <PostingStatusBadge status={posting.status} size="sm" />

              {posting.status === STATUS.JOB_POSTING.ACTIVE ? (
                <Pressable
                  onPress={() => onClose(posting.id)}
                  disabled={isClosing}
                  className="rounded-md bg-gray-100 px-3 py-1.5 active:opacity-70 dark:bg-surface"
                  accessibilityLabel={`${posting.title} 공고 마감하기`}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isClosing }}
                >
                  <Text className="text-xs font-medium text-gray-700 dark:text-gray-300">
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
                >
                  <Text className="text-xs font-medium text-primary-600 dark:text-primary-400">
                    {isReopening ? '처리중...' : '재오픈'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        }
      />
    </Card>
  );
});

export default JobPostingCard;
