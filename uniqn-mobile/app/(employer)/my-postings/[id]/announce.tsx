/**
 * UNIQN Mobile - 공고 일괄 공지 작성 화면 (S3-2)
 *
 * @description 확정 스태프 전원에게 한 번에 보내는 공지. 발송 이력이 아래에 쌓인다.
 *
 * @note 🔑 **이력이 같은 화면에 있어야 한다.** 알림은 받는 사람 것이라 사장 쪽에는 기록이
 *   남지 않는다. 보낸 뒤 화면을 떠나면 "보냈던가?"를 확인할 방법이 없어 같은 공지를 또 보낸다.
 */

import { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View, Pressable } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackHeader } from '@/components/headers';
import { Card, ConfirmModal } from '@/components';
import { ErrorState, Loading } from '@/components';
import { useJobPostingAnnouncements } from '@/hooks/useJobPostingAnnouncements';
import { useConfirmedStaff } from '@/hooks/useConfirmedStaff';
import { useToastStore } from '@/stores/toastStore';
import { toError } from '@/errors';
import { logger } from '@/utils/logger';
import { formatRelativeDate } from '@/utils/date';
import { JobTitleSuffix, useJobDetailContext } from './_layout';

/** 서버 RPC(send_job_posting_announcement)의 한도와 같은 값이어야 한다. */
const TITLE_MAX = 50;
const BODY_MAX = 500;

export default function JobPostingAnnounceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const jobPostingId = id ?? '';
  const { job, isLoading: isJobLoading, error: jobError, refresh } = useJobDetailContext();
  const { addToast } = useToastStore();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [confirmVisible, setConfirmVisible] = useState(false);

  const { announcements, isLoading, send, isSending } = useJobPostingAnnouncements(jobPostingId);

  // 예상 수신자 수 — 실제 수는 서버가 센다. 여기서는 "누구에게 가는지"를 보여주는 용도다.
  const { grouped } = useConfirmedStaff(jobPostingId);
  const expectedRecipients = useMemo(() => {
    const ids = new Set<string>();
    grouped.forEach((group) => {
      group.staff.forEach((staff) => {
        if (staff.status !== 'cancelled' && staff.status !== 'no_show') {
          ids.add(staff.staffId);
        }
      });
    });
    return ids.size;
  }, [grouped]);

  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();
  const canSend = trimmedTitle.length > 0 && trimmedBody.length > 0 && !isSending;

  const handleSend = useCallback(async () => {
    setConfirmVisible(false);
    try {
      const count = await send(trimmedTitle, trimmedBody);
      setTitle('');
      setBody('');
      // 0명도 성공이다 — 실패처럼 보이면 사장이 같은 공지를 반복해서 보낸다.
      addToast({
        type: count > 0 ? 'success' : 'info',
        message: count > 0 ? `${count}명에게 공지를 보냈어요` : '지금은 받을 스태프가 없어요',
      });
    } catch (error) {
      logger.error('공지 발송 실패', toError(error), { jobPostingId });
      addToast({
        type: 'error',
        message: error instanceof Error && error.message ? error.message : '공지를 보내지 못했어요',
      });
    }
  }, [addToast, jobPostingId, send, trimmedBody, trimmedTitle]);

  const body_ = (() => {
    if (!jobPostingId) {
      return (
        <ErrorState error={new Error('공고를 찾을 수 없어요')} title="공고를 찾을 수 없어요" />
      );
    }
    if (isJobLoading && !job) {
      return (
        <View className="flex-1 items-center justify-center">
          <Loading size="large" />
        </View>
      );
    }
    if (jobError && !job) {
      return (
        <ErrorState
          error={jobError}
          title="공고를 불러오지 못했어요"
          onRetry={refresh}
          alwaysAllowRetry
        />
      );
    }
    return null;
  })();

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader
        title="스태프 공지"
        titleSuffix={<JobTitleSuffix jobTitle={job?.title ?? null} />}
        fallbackHref={`/(employer)/my-postings/${jobPostingId}`}
      />

      {body_ ?? (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 py-4"
          keyboardShouldPersistTaps="handled"
        >
          <Card variant="outlined" padding="md">
            <Text className="mb-1 text-base font-sans-semibold text-content-primary dark:text-off-white">
              확정 스태프에게 한 번에 보내기
            </Text>
            <Text className="mb-4 text-sm text-content-secondary font-sans">
              지금 이 공고에 배정된 {expectedRecipients}명에게 알림이 갑니다. 취소·노쇼 처리된 분은
              제외돼요.
            </Text>

            <Text className="mb-1 text-sm font-sans-medium text-content-primary dark:text-off-white">
              제목
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              maxLength={TITLE_MAX}
              placeholder="예: 내일 복장 안내"
              accessibilityLabel="공지 제목"
              className="mb-1 min-h-[44px] rounded-md border border-secondary-200 px-3 py-2 text-base text-content-primary dark:border-surface-overlay dark:text-off-white font-sans"
            />
            <Text className="mb-3 text-right text-xs text-content-muted dark:text-secondary-400 font-sans">
              {title.length}/{TITLE_MAX}
            </Text>

            <Text className="mb-1 text-sm font-sans-medium text-content-primary dark:text-off-white">
              내용
            </Text>
            <TextInput
              value={body}
              onChangeText={setBody}
              maxLength={BODY_MAX}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              placeholder="예: 검은 상의에 검은 바지로 준비해주세요."
              accessibilityLabel="공지 내용"
              className="mb-1 min-h-[120px] rounded-md border border-secondary-200 px-3 py-2 text-base text-content-primary dark:border-surface-overlay dark:text-off-white font-sans"
            />
            <Text className="mb-4 text-right text-xs text-content-muted dark:text-secondary-400 font-sans">
              {body.length}/{BODY_MAX}
            </Text>

            {/* 🔑 알림은 되돌릴 수 없다 — 삭제와 같은 등급의 확인 모달을 태운다. */}
            <Pressable
              onPress={() => setConfirmVisible(true)}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel="공지 보내기"
              accessibilityState={{ disabled: !canSend }}
              testID="announcement-send"
              className={`min-h-[48px] items-center justify-center rounded-md bg-primary-600 py-3 active:bg-primary-700 ${
                canSend ? '' : 'opacity-40'
              }`}
            >
              <Text className="text-base font-sans-semibold text-content-onGold">
                {isSending ? '보내는 중...' : '공지 보내기'}
              </Text>
            </Pressable>
          </Card>

          <Text className="mb-2 mt-6 text-base font-sans-semibold text-content-primary dark:text-off-white">
            보낸 공지
          </Text>

          {isLoading ? (
            <Loading />
          ) : announcements.length === 0 ? (
            <Text className="text-sm text-content-secondary font-sans">
              아직 보낸 공지가 없어요.
            </Text>
          ) : (
            announcements.map((announcement) => (
              <Card key={announcement.id} variant="outlined" padding="md" className="mb-2">
                <View className="mb-1 flex-row items-center justify-between">
                  <Text className="flex-1 text-sm font-sans-semibold text-content-primary dark:text-off-white">
                    {announcement.title}
                  </Text>
                  <Text className="ml-2 text-xs text-content-muted dark:text-secondary-400 font-sans">
                    {announcement.recipientCount}명
                  </Text>
                </View>
                <Text className="mb-2 text-sm text-content-secondary font-sans">
                  {announcement.body}
                </Text>
                <Text className="text-xs text-content-muted dark:text-secondary-400 font-sans">
                  {formatRelativeDate(announcement.createdAt)}
                </Text>
              </Card>
            ))
          )}
        </ScrollView>
      )}

      <ConfirmModal
        visible={confirmVisible}
        title="공지를 보낼까요?"
        message={`${expectedRecipients}명에게 알림이 갑니다. 보낸 공지는 취소할 수 없어요.`}
        confirmText="보내기"
        onConfirm={handleSend}
        onClose={() => setConfirmVisible(false)}
        isLoading={isSending}
        closeOnConfirm={false}
      />
    </SafeAreaView>
  );
}
