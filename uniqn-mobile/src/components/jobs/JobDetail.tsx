import React, { useMemo } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import BubbleScoreBadge from '@/components/review/BubbleScoreBadge';
import { Badge } from '@/components/ui/Badge';
import { useUserProfile } from '@/hooks/useUserProfile';
import { buildPostingFacts, projectPostingSurface } from '@/domains/job-posting';
import { useAuthStore } from '@/stores';
import type { JobPosting, PostingDetailViewModel, PostingType } from '@/types';
import { PostingTypeBadge } from './PostingTypeBadge';
import {
  PostingCompensationContent,
  PostingScheduleContent,
  PostingStatusBadge,
  shouldShowUrgentBadge,
} from './shared';

interface JobDetailProps {
  job: JobPosting;
}

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | React.ReactNode;
  icon: string;
}) {
  return (
    <View className="flex-row items-start border-b border-secondary-100 py-3 dark:border-surface-overlay">
      <Text className="mr-3 text-lg font-sans">{icon}</Text>
      <View className="flex-1">
        <Text className="mb-1 text-xs text-secondary-500 dark:text-secondary-400 font-sans">
          {label}
        </Text>
        {typeof value === 'string' ? (
          <Text className="text-sm text-content-primary dark:text-off-white font-sans">
            {value}
          </Text>
        ) : (
          value
        )}
      </View>
    </View>
  );
}

export function JobDetail({ job }: JobDetailProps) {
  const canReadOwnerProfile = useAuthStore((state) => state.isAdmin || state.isEmployer);
  const postingFacts = useMemo(() => buildPostingFacts(job), [job]);
  const detail = useMemo(
    () =>
      projectPostingSurface(postingFacts, {
        audience: 'public',
        surface: 'detail',
      }) as PostingDetailViewModel,
    [postingFacts]
  );

  const { userProfile: ownerProfile } = useUserProfile({
    userId: detail.ownerId || '',
    enabled: canReadOwnerProfile && Boolean(detail.ownerId),
  });

  const handleCall = () => {
    if (detail.contactPhone) {
      Linking.openURL(`tel:${detail.contactPhone}`);
    }
  };

  return (
    <View className="bg-white dark:bg-surface-dark">
      <View className="bg-surface-page p-4 dark:bg-surface">
        <View className="mb-2 flex-row flex-wrap items-center">
          {detail.postingType && detail.postingType !== 'regular' ? (
            <PostingTypeBadge type={detail.postingType as PostingType} size="sm" className="mr-2" />
          ) : null}
          {shouldShowUrgentBadge(detail.postingType, detail.isUrgent) ? (
            <Badge variant="error" size="sm" className="mr-2">
              긴급
            </Badge>
          ) : null}
          <PostingStatusBadge status={detail.status} size="sm" />
        </View>

        <Text className="mb-3 text-xl font-display text-content-primary dark:text-off-white">
          {detail.title || '제목 없음'}
        </Text>

        <PostingCompensationContent
          display="detail"
          salaryDisplay={detail.salaryDisplay}
          defaultSalary={detail.defaultSalary}
          allowanceLabels={detail.allowanceLabels}
          taxLabel={detail.taxLabel}
        />
      </View>

      {detail.description ? (
        <View className="p-4">
          <Text className="mb-2 text-base font-sans-semibold text-content-primary dark:text-off-white">
            상세 설명
          </Text>
          <Text className="text-sm leading-6 text-content-muted dark:text-secondary-300 font-sans">
            {detail.description}
          </Text>
        </View>
      ) : null}

      <View className="border-t border-secondary-100 p-4 dark:border-surface-overlay">
        <Text className="mb-2 text-base font-sans-semibold text-content-primary dark:text-off-white">
          근무 정보
        </Text>

        <InfoRow icon="" label="근무지" value={detail.locationLabel || '위치 정보 없음'} />

        <View className="border-b border-secondary-100 py-3 dark:border-surface-overlay">
          <View className="flex-row items-start">
            <Text className="mr-3 text-lg font-sans">{''}</Text>
            <View className="flex-1">
              <Text className="mb-2 text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                근무 일정
              </Text>
              <PostingScheduleContent
                display="detail"
                workflow={detail.workflow}
                scheduleDisplay={detail.scheduleDisplay}
                workDate={detail.workDate}
                timeSlot={detail.timeSlot}
                daysPerWeek={detail.daysPerWeek}
                startTime={detail.startTime}
                isStartTimeNegotiable={detail.isStartTimeNegotiable}
                requiredRolesWithCount={detail.requiredRolesWithCount}
                showFilledCount={true}
              />
            </View>
          </View>
        </View>

        {detail.contactPhone ? (
          <Pressable onPress={handleCall}>
            <InfoRow icon="" label="연락처" value={detail.contactPhone} />
          </Pressable>
        ) : null}

        {detail.allowanceLabels.length > 0 ? (
          <View className="border-b border-secondary-100 py-3 dark:border-surface-overlay">
            <View className="flex-row items-start">
              <Text className="mr-3 text-lg font-sans">{''}</Text>
              <View className="flex-1">
                <Text className="mb-1 text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                  추가 수당
                </Text>
                <View className="flex-row flex-wrap">
                  {detail.allowanceLabels.map((item, index) => (
                    <Text
                      key={`${item}-${index}`}
                      className="mb-1 mr-3 text-sm text-content-primary dark:text-off-white font-sans"
                    >
                      {item}
                    </Text>
                  ))}
                </View>
              </View>
            </View>
          </View>
        ) : null}

        {detail.taxLabel ? <InfoRow icon="" label="세금" value={detail.taxLabel} /> : null}
      </View>

      {detail.questions.length > 0 ? (
        <View className="border-t border-secondary-100 p-4 dark:border-surface-overlay">
          <Text className="mb-2 text-base font-sans-semibold text-content-primary dark:text-off-white">
            사전질문 ({detail.questions.length}개)
          </Text>
          <View className="rounded-lg bg-surface-page p-3 dark:bg-surface">
            {detail.questions.slice(0, 3).map((question, index) => (
              <View key={`${question.id || index}`} className="mb-2">
                <Text className="text-sm text-content-secondary font-sans">
                  {index + 1}. {question.question}
                  {question.required ? <Text className="text-error-500 font-sans"> *</Text> : null}
                </Text>
              </View>
            ))}
            {detail.questions.length > 3 ? (
              <Text className="text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                외 {detail.questions.length - 3}개 질문
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {detail.ownerName || ownerProfile?.bubbleScore ? (
        <View className="border-t border-secondary-100 p-4 dark:border-surface-overlay">
          <View className="flex-row items-center">
            <Text className="mr-3 text-lg font-sans">{''}</Text>
            <View className="flex-1">
              <Text className="mb-1 text-xs text-secondary-500 dark:text-secondary-400 font-sans">
                구인처
              </Text>
              <View className="flex-row items-center gap-2">
                <Text className="text-sm text-content-primary dark:text-off-white font-sans">
                  {detail.ownerName ?? '구인처'}
                </Text>
                {ownerProfile?.bubbleScore ? (
                  <BubbleScoreBadge score={ownerProfile.bubbleScore.score} size="sm" />
                ) : null}
              </View>
            </View>
          </View>
        </View>
      ) : null}

      {typeof detail.viewCount === 'number' || typeof detail.totalApplicants === 'number' ? (
        <View className="border-t border-secondary-100 p-4 dark:border-surface-overlay">
          <View className="flex-row">
            {typeof detail.viewCount === 'number' ? (
              <Text className="mr-4 text-xs text-content-placeholder font-sans">
                조회 {detail.viewCount}
              </Text>
            ) : null}
            {typeof detail.totalApplicants === 'number' ? (
              <Text className="text-xs text-content-placeholder font-sans">
                지원 {detail.totalApplicants}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default JobDetail;
