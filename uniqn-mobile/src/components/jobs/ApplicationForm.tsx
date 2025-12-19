/**
 * UNIQN Mobile - 지원서 폼 컴포넌트
 *
 * @description 구인공고 지원 폼
 * @version 1.0.0
 */

import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Modal, ScrollView } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { JobPosting, StaffRole } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface ApplicationFormProps {
  job: JobPosting;
  visible: boolean;
  isSubmitting: boolean;
  onSubmit: (roleId: string, message?: string) => void;
  onClose: () => void;
}

// ============================================================================
// Helpers
// ============================================================================

const getRoleLabel = (role: StaffRole): string => {
  switch (role) {
    case 'dealer':
      return '딜러';
    case 'manager':
      return '매니저';
    case 'chiprunner':
      return '칩러너';
    case 'admin':
      return '관리자';
    default:
      return role;
  }
};

const formatSalary = (type: string, amount: number): string => {
  const formattedAmount = amount.toLocaleString('ko-KR');
  switch (type) {
    case 'hourly':
      return `시급 ${formattedAmount}원`;
    case 'daily':
      return `일급 ${formattedAmount}원`;
    default:
      return `${formattedAmount}원`;
  }
};

// ============================================================================
// Component
// ============================================================================

export function ApplicationForm({
  job,
  visible,
  isSubmitting,
  onSubmit,
  onClose,
}: ApplicationFormProps) {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const availableRoles = job.roles.filter((r) => r.filled < r.count);

  const handleSubmit = () => {
    if (!selectedRole) return;
    onSubmit(selectedRole, message.trim() || undefined);
  };

  const handleClose = () => {
    setSelectedRole(null);
    setMessage('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-white dark:bg-gray-900">
        {/* 헤더 */}
        <View className="flex-row items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <Pressable onPress={handleClose} className="p-2 -ml-2">
            <Text className="text-gray-600 dark:text-gray-400 text-lg">✕</Text>
          </Pressable>
          <Text className="text-lg font-semibold text-gray-900 dark:text-white">
            지원하기
          </Text>
          <View className="w-8" />
        </View>

        <ScrollView className="flex-1 p-4" showsVerticalScrollIndicator={false}>
          {/* 공고 정보 */}
          <View className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
            <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">
              {job.title}
            </Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              📍 {job.location.name}
            </Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              📅 {job.workDate} {job.timeSlot}
            </Text>
            <Text className="text-base font-bold text-primary-600 dark:text-primary-400">
              {formatSalary(job.salary.type, job.salary.amount)}
            </Text>
          </View>

          {/* 역할 선택 */}
          <View className="mb-6">
            <Text className="text-base font-semibold text-gray-900 dark:text-white mb-3">
              지원할 역할 선택 <Text className="text-error-500">*</Text>
            </Text>

            {availableRoles.length === 0 ? (
              <View className="bg-error-50 dark:bg-error-900/30 rounded-lg p-4">
                <Text className="text-error-600 dark:text-error-400 text-center">
                  모든 역할이 마감되었습니다
                </Text>
              </View>
            ) : (
              <View className="space-y-2">
                {availableRoles.map((roleReq) => {
                  const isSelected = selectedRole === roleReq.role;
                  const remaining = roleReq.count - roleReq.filled;

                  return (
                    <Pressable
                      key={roleReq.role}
                      onPress={() => setSelectedRole(roleReq.role)}
                      disabled={isSubmitting}
                      className={`
                        flex-row items-center justify-between p-4 rounded-lg border-2
                        ${isSelected
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                        }
                        ${isSubmitting ? 'opacity-50' : ''}
                      `}
                    >
                      <View className="flex-row items-center">
                        <View
                          className={`
                            w-5 h-5 rounded-full border-2 mr-3 items-center justify-center
                            ${isSelected
                              ? 'border-primary-500 bg-primary-500'
                              : 'border-gray-300 dark:border-gray-600'
                            }
                          `}
                        >
                          {isSelected && (
                            <View className="w-2 h-2 rounded-full bg-white" />
                          )}
                        </View>
                        <Text
                          className={`text-base font-medium ${
                            isSelected
                              ? 'text-primary-700 dark:text-primary-300'
                              : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          {getRoleLabel(roleReq.role)}
                        </Text>
                      </View>
                      <Badge
                        variant={remaining <= 2 ? 'warning' : 'default'}
                        size="sm"
                      >
                        {remaining}자리 남음
                      </Badge>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* 메시지 입력 (선택) */}
          <View className="mb-6">
            <Text className="text-base font-semibold text-gray-900 dark:text-white mb-2">
              자기소개 <Text className="text-gray-400">(선택)</Text>
            </Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="간단한 자기소개나 경력을 입력하세요"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              maxLength={500}
              editable={!isSubmitting}
              className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-gray-900 dark:text-white text-base min-h-[120px]"
              textAlignVertical="top"
            />
            <Text className="text-xs text-gray-400 dark:text-gray-500 text-right mt-1">
              {message.length}/500
            </Text>
          </View>

          {/* 안내 문구 */}
          <View className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
            <Text className="text-xs text-gray-500 dark:text-gray-400 leading-5">
              • 지원 후에는 구인자가 지원서를 확인합니다.{'\n'}
              • 수락 시 알림으로 안내해드립니다.{'\n'}
              • 지원 후 취소는 마이페이지에서 가능합니다.
            </Text>
          </View>
        </ScrollView>

        {/* 하단 버튼 */}
        <View className="p-4 border-t border-gray-200 dark:border-gray-700">
          <Button
            onPress={handleSubmit}
            disabled={!selectedRole || isSubmitting || availableRoles.length === 0}
            loading={isSubmitting}
            fullWidth
          >
            지원하기
          </Button>
        </View>
      </View>
    </Modal>
  );
}

export default ApplicationForm;
