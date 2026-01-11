/**
 * UNIQN Mobile - 템플릿 불러오기 모달
 *
 * @description 저장된 템플릿 목록 조회 및 선택
 * @version 1.0.0
 */

import React from 'react';
import { View, Text, Pressable, TouchableOpacity, ActivityIndicator } from 'react-native';
import { logger } from '@/utils/logger';
import { FlashList } from '@shopify/flash-list';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { TrashIcon } from '@/components/icons';
import type { JobPostingTemplate, JobPostingFormData } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface LoadTemplateModalProps {
  visible: boolean;
  onClose: () => void;
  templates: JobPostingTemplate[];
  templatesLoading: boolean;
  onLoadTemplate: (template: JobPostingTemplate) => Promise<Partial<JobPostingFormData>>;
  onDeleteTemplate: (id: string, name: string) => Promise<boolean>;
  isLoadingTemplate?: boolean;
  isDeletingTemplate?: boolean;
}

// ============================================================================
// TemplateCard Component
// ============================================================================

interface TemplateCardProps {
  template: JobPostingTemplate;
  onLoad: () => void;
  onDelete: () => void;
  isLoading?: boolean;
  isDeleting?: boolean;
}

function TemplateCard({ template, onLoad, onDelete, isLoading, isDeleting }: TemplateCardProps) {
  const { name, description, templateData, createdAt, usageCount } = template;

  // 날짜 포맷
  const formatDate = (timestamp: { toDate?: () => Date; seconds?: number }) => {
    if (!timestamp) return '';
    const date = timestamp.toDate?.() ?? new Date(timestamp.seconds! * 1000);
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  // 지역 추출
  const location = templateData?.location
    ? typeof templateData.location === 'string'
      ? templateData.location
      : templateData.location.name || '미지정'
    : '미지정';

  // 급여 정보 추출
  const salaryText = (() => {
    if (!templateData?.salary) return null;
    const { type, amount } = templateData.salary;
    if (!amount) return null;
    const typeLabel = type === 'hourly' ? '시급' : type === 'daily' ? '일급' : '월급';
    return `${typeLabel} ${amount.toLocaleString()}원`;
  })();

  // 삭제 버튼 클릭
  const handleDeletePress = () => {
    onDelete();
  };

  return (
    <View className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-3">
      {/* 헤더 */}
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1 mr-2">
          <Text className="text-base font-semibold text-gray-900 dark:text-white" numberOfLines={1}>
            {name}
          </Text>
          {description && (
            <Text className="text-sm text-gray-500 dark:text-gray-400 mt-0.5" numberOfLines={1}>
              {description}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={handleDeletePress}
          disabled={isDeleting}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{
            width: 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            backgroundColor: isDeleting ? '#FEE2E2' : '#FEF2F2',
            opacity: isDeleting ? 0.5 : 1,
          }}
          accessibilityRole="button"
          accessibilityLabel="템플릿 삭제"
        >
          <TrashIcon size={18} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {/* 태그 */}
      <View className="flex-row flex-wrap gap-2 mb-3">
        {/* 지역 */}
        <View className="bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-md">
          <Text className="text-xs text-gray-600 dark:text-gray-300">{location}</Text>
        </View>

        {/* 급여 */}
        {salaryText && (
          <View className="bg-green-100 dark:bg-green-900/40 px-2.5 py-1 rounded-md">
            <Text className="text-xs text-green-700 dark:text-green-300">{salaryText}</Text>
          </View>
        )}

        {/* 공고 타입 */}
        {templateData?.postingType && (
          <View className="bg-blue-100 dark:bg-blue-900/40 px-2.5 py-1 rounded-md">
            <Text className="text-xs text-blue-700 dark:text-blue-300">
              {templateData.postingType === 'regular'
                ? '지원'
                : templateData.postingType === 'fixed'
                ? '고정'
                : templateData.postingType === 'tournament'
                ? '대회'
                : '긴급'}
            </Text>
          </View>
        )}
      </View>

      {/* 푸터 */}
      <View className="flex-row items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
        <Text className="text-xs text-gray-400 dark:text-gray-500">
          {formatDate(createdAt)} 생성 {usageCount ? `/ ${usageCount}회 사용` : ''}
        </Text>
        <Pressable
          onPress={onLoad}
          disabled={isLoading}
          className={`px-4 py-2 rounded-lg ${isLoading ? 'bg-gray-300' : 'bg-blue-600'}`}
          accessibilityRole="button"
          accessibilityLabel="템플릿 불러오기"
        >
          {isLoading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text className="text-white text-sm font-medium">불러오기</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ============================================================================
// EmptyState Component
// ============================================================================

function EmptyState() {
  return (
    <View className="items-center justify-center py-12">
      <Text className="text-4xl mb-4">📋</Text>
      <Text className="text-gray-500 dark:text-gray-400 text-center mb-2">
        저장된 템플릿이 없습니다
      </Text>
      <Text className="text-gray-400 dark:text-gray-500 text-sm text-center">
        공고 작성 후 템플릿으로 저장해보세요
      </Text>
    </View>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function LoadTemplateModal({
  visible,
  onClose,
  templates,
  templatesLoading,
  onLoadTemplate,
  onDeleteTemplate,
  isLoadingTemplate = false,
  isDeletingTemplate = false,
}: LoadTemplateModalProps) {
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<{ id: string; name: string } | null>(null);

  const handleLoad = async (template: JobPostingTemplate) => {
    setLoadingId(template.id);
    try {
      await onLoadTemplate(template);
    } finally {
      setLoadingId(null);
    }
  };

  // 삭제 클릭 시 확인 모달 열기
  const handleDeleteClick = (id: string, name: string) => {
    logger.info('삭제 확인 모달 열기', { templateId: id, templateName: name });
    setDeleteTarget({ id, name });
  };

  // 삭제 확인
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await onDeleteTemplate(deleteTarget.id, deleteTarget.name);
    setDeleteTarget(null);
  };

  return (
    <>
      <Modal
        visible={visible}
        onClose={onClose}
        title="템플릿 불러오기"
        size="lg"
      >
        {/* 로딩 상태 */}
        {templatesLoading && (
          <View className="items-center justify-center py-12">
            <ActivityIndicator size="large" color="#3B82F6" />
            <Text className="text-gray-500 dark:text-gray-400 mt-3">
              템플릿 불러오는 중...
            </Text>
          </View>
        )}

        {/* 빈 상태 */}
        {!templatesLoading && templates.length === 0 && <EmptyState />}

        {/* 템플릿 목록 */}
        {!templatesLoading && templates.length > 0 && (
          <View style={{ height: 400 }}>
            <FlashList
              data={templates}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TemplateCard
                  template={item}
                  onLoad={() => handleLoad(item)}
                  onDelete={() => handleDeleteClick(item.id, item.name)}
                  isLoading={loadingId === item.id || isLoadingTemplate}
                  isDeleting={isDeletingTemplate}
                />
              )}
              // @ts-expect-error - estimatedItemSize is required in FlashList 2.x but types may be missing
              estimatedItemSize={140}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled={true}
            />

            {/* 안내 문구 */}
            <View className="bg-amber-50 dark:bg-amber-900/30 rounded-lg p-3 mt-3">
              <Text className="text-amber-700 dark:text-amber-300 text-xs text-center">
                템플릿을 불러온 후 날짜를 설정해주세요
              </Text>
            </View>
          </View>
        )}
      </Modal>

      {/* 삭제 확인 모달 */}
      <ConfirmModal
        visible={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="템플릿 삭제"
        message={`'${deleteTarget?.name ?? ''}' 템플릿을 삭제하시겠습니까?`}
        confirmText="삭제"
        cancelText="취소"
        isDestructive
      />
    </>
  );
}

export default LoadTemplateModal;
