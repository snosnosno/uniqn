import React, { useMemo } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import BubbleScoreBadge from '@/components/review/BubbleScoreBadge';
import { Badge } from '@/components/ui/Badge';
import { useUserProfile } from '@/hooks/useUserProfile';
import { extractPostingFilledSubmap, usePostingFilledCounts } from '@/hooks/usePostingFilledCounts';
import { buildPostingFacts, projectPostingSurface } from '@/domains/job-posting';
import { useAuthStore } from '@/stores';
import type { JobPosting, PostingDetailViewModel } from '@/types';
import { POSTING_TYPE_LABELS } from '@/types/postingConfig';
import {
  PostingCompensationContent,
  PostingScheduleContent,
  PostingStatusBadge,
  shouldShowUrgentBadge,
} from './shared';

interface JobDetailProps {
  job: JobPosting;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-[10px] uppercase tracking-wider text-content-muted font-sans-bold mb-2">
      {children}
    </Text>
  );
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
    <View className="flex-row items-start border-b border-divider py-3">
      <Text className="mr-3 text-lg font-sans">{icon}</Text>
      <View className="flex-1">
        <Text className="mb-1 text-[10px] uppercase tracking-wider text-content-muted font-sans-bold">
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

  const { data: filledAll } = usePostingFilledCounts([job.id]);
  const filledCounts = useMemo(
    () => extractPostingFilledSubmap(filledAll, job.id),
    [filledAll, job.id]
  );

  const handleCall = () => {
    if (detail.contactPhone) {
      Linking.openURL(`tel:${detail.contactPhone}`);
    }
  };

  const showPostingTypeChip = Boolean(detail.postingType && detail.postingType !== 'regular');
  const showUrgentChip = shouldShowUrgentBadge(detail.postingType, detail.isUrgent);
  const postingTypeLabel = detail.postingType ? POSTING_TYPE_LABELS[detail.postingType] : null;

  return (
    <View className="bg-white dark:bg-surface">
      {/* Hero */}
      <View className="bg-surface-elevated dark:bg-surface-elevated px-4 py-4 border-b border-divider">
        <View className="flex-row flex-wrap items-center gap-1 mb-2">
          {showPostingTypeChip && postingTypeLabel ? (
            <Badge variant="chip">{postingTypeLabel}</Badge>
          ) : null}
          {showUrgentChip ? <Badge variant="chip">긴급</Badge> : null}
          <PostingStatusBadge status={detail.status} size="sm" />
        </View>

        <Text
          className="text-content-primary dark:text-off-white text-lg font-sans-bold"
          style={{ letterSpacing: -0.5, lineHeight: 24 }}
        >
          {detail.title || '제목 없음'}
        </Text>

        {detail.locationLabel ? (
          <Text className="text-primary-500 text-xs mt-1 font-sans-semibold">
            ◦ {detail.locationLabel}
          </Text>
        ) : null}
      </View>

      {/* 급여 */}
      <View className="px-4 py-3 border-b border-divider">
        <SectionLabel>급여</SectionLabel>
        <PostingCompensationContent
          display="detail"
          salaryDisplay={detail.salaryDisplay}
          defaultSalary={detail.defaultSalary}
          allowanceLabels={detail.allowanceLabels}
          taxLabel={detail.taxLabel}
        />
      </View>

      {/* 상세 설명 */}
      {detail.description ? (
        <View className="px-4 py-3 border-b border-divider">
          <SectionLabel>상세 설명</SectionLabel>
          <Text className="text-sm leading-6 text-content-muted dark:text-secondary-300 font-sans">
            {detail.description}
          </Text>
        </View>
      ) : null}

      {/* 근무 정보 */}
      <View className="px-4 py-3 border-b border-divider">
        <SectionLabel>근무 정보</SectionLabel>

        <InfoRow icon="" label="근무지" value={detail.locationLabel || '위치 정보 없음'} />

        <View className="border-b border-divider py-3">
          <View className="flex-row items-start">
            <Text className="mr-3 text-lg font-sans">{''}</Text>
            <View className="flex-1">
              <Text className="mb-2 text-[10px] uppercase tracking-wider text-content-muted font-sans-bold">
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
                filledCounts={filledCounts}
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
          <View className="border-b border-divider py-3">
            <View className="flex-row items-start">
              <Text className="mr-3 text-lg font-sans">{''}</Text>
              <View className="flex-1">
                <Text className="mb-1 text-[10px] uppercase tracking-wider text-content-muted font-sans-bold">
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

      {/* 사전질문 */}
      {detail.questions.length > 0 ? (
        <View className="px-4 py-3 border-b border-divider">
          <SectionLabel>사전질문 ({detail.questions.length}개)</SectionLabel>
          <View className="rounded-lg bg-surface-page dark:bg-surface p-3 dark:bg-surface">
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

      {/* 구인처 */}
      {detail.ownerName || ownerProfile?.bubbleScore ? (
        <View className="px-4 py-3 border-b border-divider">
          <SectionLabel>구인처</SectionLabel>
          <View className="flex-row items-center gap-2">
            <Text className="text-sm text-content-primary dark:text-off-white font-sans">
              {detail.ownerName ?? '구인처'}
            </Text>
            {ownerProfile?.bubbleScore ? (
              <BubbleScoreBadge score={ownerProfile.bubbleScore.score} size="sm" />
            ) : null}
          </View>
        </View>
      ) : null}

      {/* 통계 */}
      {typeof detail.viewCount === 'number' || typeof detail.totalApplicants === 'number' ? (
        <View className="px-4 py-3 border-b border-divider">
          <SectionLabel>통계</SectionLabel>
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
