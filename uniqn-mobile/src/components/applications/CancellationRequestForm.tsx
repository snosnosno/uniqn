/**
 * UNIQN Mobile - 취소 요청 폼 컴포넌트
 *
 * @description 확정된 지원에 대해 스태프가 취소를 요청하는 폼
 * @version 1.0.0
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { CheckIcon } from '@/components/icons';
import { cancellationRequestSchema } from '@/schemas/application.schema';
import { getRoleDisplayName } from '@/types/unified';
import { triggerHaptic } from '@/utils/haptics';
import type { Application } from '@/types';

// ============================================================================
// Helpers
// ============================================================================

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-micro uppercase tracking-wider text-content-muted font-sans-bold mb-2">
      {children}
    </Text>
  );
}

// ============================================================================
// Types
// ============================================================================

interface CancellationRequestFormProps {
  /** 취소 요청할 지원서 */
  application: Application;
  /** 모달 표시 여부 */
  visible: boolean;
  /** 제출 중 여부 */
  isSubmitting: boolean;
  /** 취소 요청 제출 */
  onSubmit: (applicationId: string, reason: string, wantsSubstitutePost: boolean) => void;
  /** 닫기 */
  onClose: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function CancellationRequestForm({
  application,
  visible,
  isSubmitting,
  onSubmit,
  onClose,
}: CancellationRequestFormProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [wantsSubstitutePost, setWantsSubstitutePost] = useState(true);

  // 제출 가능 여부 (5자 이상)
  const canSubmit = reason.trim().length >= 5 && !isSubmitting;

  // 제출 핸들러
  const handleSubmit = useCallback(async () => {
    // Zod 스키마 검증
    const result = cancellationRequestSchema.safeParse({
      applicationId: application.id,
      reason: reason.trim(),
      wantsSubstitutePost,
    });

    if (!result.success) {
      const fieldError = result.error.issues[0];
      setError(fieldError?.message ?? '입력값을 확인해주세요');
      return;
    }

    // 확정 지원 취소 — 사용자에게 경고 신호 (impeccable §17 삭제/취소 경계).
    await triggerHaptic('warning');

    setError(null);
    onSubmit(application.id, reason.trim(), wantsSubstitutePost);
  }, [application.id, reason, wantsSubstitutePost, onSubmit]);

  // 닫기 핸들러 (상태 초기화)
  const handleClose = useCallback(() => {
    setReason('');
    setError(null);
    setWantsSubstitutePost(true);
    onClose();
  }, [onClose]);

  // Footer 컨텐츠
  const footerContent = (
    <View className="flex-row gap-3">
      <Button
        onPress={handleClose}
        variant="outline"
        disabled={isSubmitting}
        className="flex-1"
        accessibilityLabel="취소 요청 닫기"
      >
        닫기
      </Button>
      <Button
        onPress={handleSubmit}
        variant="danger"
        disabled={!canSubmit}
        loading={isSubmitting}
        className="flex-1"
        accessibilityLabel="확정된 지원 취소 요청 제출"
      >
        요청 제출
      </Button>
    </View>
  );

  return (
    <SheetModal
      visible={visible}
      onClose={handleClose}
      title="취소 요청"
      footer={footerContent}
      isLoading={isSubmitting}
    >
      <View>
        {/* Hero — 경고 안내 (JobDetail 패턴: bg-surface-elevated + border-divider + uppercase 라벨) */}
        <View className="bg-surface-elevated dark:bg-surface-elevated px-4 py-4 border-b border-divider">
          <SectionLabel>경고</SectionLabel>
          <Text
            className="text-content-primary dark:text-off-white text-base font-sans-semibold"
            style={{ letterSpacing: -0.3, lineHeight: 22 }}
          >
            확정된 지원을 취소하려면 사유를 입력해주세요.
          </Text>
          <Text className="text-content-muted dark:text-secondary-300 text-xs mt-1 font-sans">
            구인자가 검토 후 승인/거절합니다.
          </Text>
        </View>

        {/* 지원 정보 */}
        <View className="px-4 py-3 border-b border-divider">
          <SectionLabel>지원 정보</SectionLabel>
          <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white mb-1">
            {application.jobPostingTitle ?? application.jobPosting?.title ?? '공고'}
          </Text>
          <Text className="text-sm text-content-muted dark:text-secondary-300 font-sans">
            {application.jobPostingDate ?? application.jobPosting?.workDate ?? '-'}
          </Text>
          <Text className="text-sm text-content-muted dark:text-secondary-300 font-sans mt-0.5">
            {getRoleDisplayName(
              application.assignments[0]?.roleIds?.[0] || 'other',
              application.customRole
            )}{' '}
            역할
          </Text>
        </View>

        {/* 취소 사유 입력 */}
        <View className="px-4 py-3 border-b border-divider">
          <SectionLabel>취소 사유</SectionLabel>
          <FormField required error={error} hint="최소 5자 이상, 최대 500자">
            {/*
              키보드 UX 주석 (Impeccable §20):
              - 키보드 회피 / keyboardShouldPersistTaps / keyboardDismissMode 는 부모 SheetModal 이
                KeyboardAvoidingView + ScrollView 로 이미 처리한다 (중복 래핑 금지).
              - 단일 multiline 필드이므로 returnKeyType 체인 불필요, blurOnSubmit=false 로 개행 허용.
              - autoFocus 미사용 (스크롤 점프 / 키보드 경합 방지).
            */}
            <TextInput
              value={reason}
              onChangeText={(text) => {
                setReason(text);
                if (error) setError(null);
              }}
              placeholder="취소하려는 이유를 상세히 입력해주세요"
              placeholderTextColor={SECONDARY_PALETTE[400]}
              multiline
              numberOfLines={5}
              maxLength={500}
              editable={!isSubmitting}
              returnKeyType="default"
              blurOnSubmit={false}
              className={`
                bg-surface-page dark:bg-surface-elevated rounded-lg p-4
                text-content-primary text-base font-sans min-h-[140px]
                ${error ? 'border-2 border-error-500' : 'border border-divider'}
              `}
              textAlignVertical="top"
            />
            <Text className="text-xs text-content-placeholder text-right mt-1 font-sans">
              {reason.length}/500
            </Text>
          </FormField>
        </View>

        {/* 대타 구인 게시글 */}
        <View className="px-4 py-3 border-b border-divider">
          <SectionLabel>대타 구인</SectionLabel>
          <Pressable
            onPress={() => setWantsSubstitutePost((prev) => !prev)}
            className="flex-row items-center bg-surface-page dark:bg-surface-elevated rounded-lg p-4 border border-divider"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: wantsSubstitutePost }}
            accessibilityLabel={`대타 구해요 글 ${wantsSubstitutePost ? '자동 게시' : '게시 안 함'}`}
          >
            <View
              className={`w-5 h-5 rounded border mr-3 items-center justify-center ${
                wantsSubstitutePost ? 'bg-primary-500 border-primary-500' : 'border-divider'
              }`}
            >
              {wantsSubstitutePost && <CheckIcon size={14} color="#09090B" />}
            </View>
            <View className="flex-1">
              <Text className="text-sm font-sans-semibold text-content-primary dark:text-off-white">
                대타 구해요 글 올리기
              </Text>
              <Text className="text-xs text-content-muted dark:text-secondary-300 mt-0.5 font-sans">
                게시판에 대타 구인 글이 자동으로 올라갑니다
              </Text>
            </View>
          </Pressable>
        </View>

        {/* 주의사항 */}
        <View className="px-4 py-3">
          <SectionLabel>주의사항</SectionLabel>
          <Text className="text-xs text-content-muted dark:text-secondary-300 leading-5 font-sans">
            • 취소 요청이 승인되면 지원이 취소됩니다.{'\n'}• 승인 시 해당 자리가 공고에 다시
            노출됩니다.{'\n'}• 구인자가 거절하면 지원은 유지됩니다.{'\n'}• 무단 취소는 평판에 영향을
            줄 수 있습니다.
          </Text>
        </View>
      </View>
    </SheetModal>
  );
}
