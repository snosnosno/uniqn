/**
 * UNIQN Mobile - 대회공고 승인/거부 모달
 *
 * @description 관리자용 대회공고 승인 또는 거부 처리 모달
 * - 승인 모드: 간단한 확인만 필요
 * - 거부 모드: 사유 입력 필수 (최소 10자)
 *
 * @version 1.0.0
 */

import React, { memo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui';

// ============================================================================
// Types
// ============================================================================

interface ApprovalModalProps {
  /** 모달 표시 여부 */
  visible: boolean;
  /** 모드: 승인 또는 거부 */
  mode: 'approve' | 'reject';
  /** 공고 제목 */
  postingTitle: string;
  /** 확인 콜백 (거부 시 사유 전달) */
  onConfirm: (reason?: string) => void;
  /** 취소 콜백 */
  onCancel: () => void;
  /** 처리 중 여부 */
  isProcessing: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const MIN_REASON_LENGTH = 10;
const MAX_REASON_LENGTH = 500;

// ============================================================================
// Component
// ============================================================================

export const ApprovalModal = memo(function ApprovalModal({
  visible,
  mode,
  postingTitle,
  onConfirm,
  onCancel,
  isProcessing,
}: ApprovalModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isApprove = mode === 'approve';
  const trimmedReason = reason.trim();
  const isValidReason = trimmedReason.length >= MIN_REASON_LENGTH;

  // 모달 닫힐 때 상태 초기화
  useEffect(() => {
    if (!visible) {
      setReason('');
      setError(null);
    }
  }, [visible]);

  const handleConfirm = useCallback(() => {
    if (!isApprove) {
      if (!isValidReason) {
        setError(`거부 사유는 최소 ${MIN_REASON_LENGTH}자 이상이어야 합니다`);
        return;
      }
      if (trimmedReason.replace(/\s/g, '').length < MIN_REASON_LENGTH) {
        setError(`공백을 제외한 내용이 ${MIN_REASON_LENGTH}자 이상이어야 합니다`);
        return;
      }
    }
    setError(null);
    onConfirm(isApprove ? undefined : trimmedReason);
  }, [isApprove, isValidReason, trimmedReason, onConfirm]);

  const handleCancel = useCallback(() => {
    setReason('');
    setError(null);
    onCancel();
  }, [onCancel]);

  const handleReasonChange = useCallback((text: string) => {
    if (text.length <= MAX_REASON_LENGTH) {
      setReason(text);
      setError(null);
    }
  }, []);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <Pressable
          className="flex-1 bg-black/50 justify-center items-center p-4"
          onPress={handleCancel}
        >
          <Pressable
            className="bg-white dark:bg-surface rounded-xl w-full max-w-md"
            onPress={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <View className="flex-row items-center justify-between p-4 border-b border-gray-200 dark:border-surface-overlay">
              <Text
                className={`text-lg font-semibold ${
                  isApprove
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {isApprove ? '공고 승인' : '공고 거부'}
              </Text>
              <Pressable
                onPress={handleCancel}
                disabled={isProcessing}
                hitSlop={8}
                accessibilityLabel="닫기"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={24} color="#9CA3AF" />
              </Pressable>
            </View>

            {/* 본문 */}
            <View className="p-4">
              <Text className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                다음 공고를 {isApprove ? '승인' : '거부'}하시겠습니까?
              </Text>
              <View className="bg-gray-50 dark:bg-surface rounded-lg p-3 mb-4">
                <Text
                  className="text-sm font-medium text-gray-900 dark:text-gray-100"
                  numberOfLines={2}
                >
                  {postingTitle}
                </Text>
              </View>

              {/* 거부 사유 입력 */}
              {!isApprove && (
                <View className="mb-4">
                  <Text className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    거부 사유 <Text className="text-red-500">*</Text>
                  </Text>
                  <TextInput
                    value={reason}
                    onChangeText={handleReasonChange}
                    placeholder="거부 사유를 10자 이상 입력해주세요"
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={4}
                    editable={!isProcessing}
                    textAlignVertical="top"
                    className="border border-gray-300 dark:border-surface-overlay rounded-lg p-3 bg-white dark:bg-surface text-gray-900 dark:text-gray-100 min-h-[100px]"
                    accessibilityLabel="거부 사유 입력"
                    accessibilityHint="최소 10자 이상 입력해주세요"
                  />
                  <View className="flex-row justify-between mt-1">
                    <Text
                      className={`text-xs ${
                        isValidReason
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {trimmedReason.length}/{MIN_REASON_LENGTH}자 이상
                    </Text>
                    <Text className="text-xs text-gray-500 dark:text-gray-400">
                      {reason.length}/{MAX_REASON_LENGTH}
                    </Text>
                  </View>
                </View>
              )}

              {/* 승인 안내 */}
              {isApprove && (
                <View className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3 mb-4">
                  <Text className="text-sm text-green-800 dark:text-green-300">
                    승인 후 공고가 대회 탭에 즉시 노출됩니다.
                  </Text>
                </View>
              )}

              {/* 에러 메시지 */}
              {error && (
                <View className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3 mb-4">
                  <Text className="text-sm text-red-800 dark:text-red-300">{error}</Text>
                </View>
              )}
            </View>

            {/* 버튼 */}
            <View className="flex-row gap-3 p-4 border-t border-gray-200 dark:border-surface-overlay">
              <View className="flex-1">
                <Button variant="outline" onPress={handleCancel} disabled={isProcessing} fullWidth>
                  취소
                </Button>
              </View>
              <View className="flex-1">
                <Button
                  variant={isApprove ? 'primary' : 'danger'}
                  onPress={handleConfirm}
                  disabled={isProcessing || (!isApprove && !isValidReason)}
                  fullWidth
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text className="text-white font-medium">{isApprove ? '승인' : '거부'}</Text>
                  )}
                </Button>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
});

export default ApprovalModal;
