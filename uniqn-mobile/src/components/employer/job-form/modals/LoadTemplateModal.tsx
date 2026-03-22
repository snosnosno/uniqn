import React from 'react';
import { ActivityIndicator, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { TrashIcon } from '@/components/icons';
import { toDate, type DateInput } from '@/utils/date';
import { logger } from '@/utils/logger';
import type { JobPostingFormData, JobPostingTemplate } from '@/types';

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

interface TemplateCardProps {
  template: JobPostingTemplate;
  onLoad: () => void;
  onDelete: () => void;
  isLoading?: boolean;
  isDeleting?: boolean;
}

function formatDate(timestamp: DateInput): string {
  const date = toDate(timestamp);
  if (!date) {
    return '';
  }

  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function getPostingTypeLabel(template: JobPostingTemplate): string {
  const postingType = template.templateData?.postingType;
  if (postingType === 'tournament') return '대회';
  if (postingType === 'urgent') return '긴급';
  if (postingType === 'fixed' || template.templateData?.schedule?.kind === 'fixed') {
    return '지원 중단';
  }
  return '일반';
}

function TemplateCard({ template, onLoad, onDelete, isLoading, isDeleting }: TemplateCardProps) {
  const { name, description, templateData, createdAt, usageCount } = template;
  const location = templateData?.location?.name || '미정';
  const salary =
    templateData?.compensation?.defaultSalary || templateData?.roleCatalog?.[0]?.salary;
  const isUnsupported =
    templateData?.postingType === 'fixed' || templateData?.schedule?.kind === 'fixed';

  const salaryText = salary?.amount
    ? `${salary.type === 'hourly' ? '시급' : salary.type === 'daily' ? '일급' : '급여'} ${salary.amount.toLocaleString()}원`
    : null;

  return (
    <View className="mb-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-surface-overlay dark:bg-surface">
      <View className="mb-2 flex-row items-start justify-between">
        <View className="mr-2 flex-1">
          <Text className="text-base font-semibold text-gray-900 dark:text-white" numberOfLines={1}>
            {name}
          </Text>
          {description ? (
            <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400" numberOfLines={1}>
              {description}
            </Text>
          ) : null}
        </View>

        <TouchableOpacity
          onPress={onDelete}
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

      <View className="mb-3 flex-row flex-wrap gap-2">
        <View className="rounded-md bg-gray-100 px-2.5 py-1 dark:bg-surface">
          <Text className="text-xs text-gray-600 dark:text-gray-300">{location}</Text>
        </View>

        {salaryText ? (
          <View className="rounded-md bg-green-100 px-2.5 py-1 dark:bg-green-900/40">
            <Text className="text-xs text-green-700 dark:text-green-300">{salaryText}</Text>
          </View>
        ) : null}

        <View className="rounded-md bg-primary-100 px-2.5 py-1 dark:bg-primary-900/40">
          <Text className="text-xs text-primary-700 dark:text-primary-300">
            {getPostingTypeLabel(template)}
          </Text>
        </View>
      </View>

      {isUnsupported ? (
        <View className="mb-3 rounded-lg bg-amber-50 p-3 dark:bg-amber-900/30">
          <Text className="text-xs text-amber-700 dark:text-amber-300">
            fixed 템플릿은 V3 canonical 전환 동안 불러올 수 없습니다.
          </Text>
        </View>
      ) : null}

      <View className="flex-row items-center justify-between border-t border-gray-100 pt-2 dark:border-surface-overlay">
        <Text className="text-xs text-gray-400 dark:text-gray-500">
          {formatDate(createdAt)} 생성 {usageCount ? `/ ${usageCount}회 사용` : ''}
        </Text>
        <Pressable
          onPress={onLoad}
          disabled={isLoading || isUnsupported}
          className={`rounded-lg px-4 py-2 ${
            isLoading || isUnsupported ? 'bg-gray-300' : 'bg-primary-600'
          }`}
          accessibilityRole="button"
          accessibilityLabel="템플릿 불러오기"
        >
          {isLoading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text className="text-sm font-medium text-white">
              {isUnsupported ? '사용 불가' : '불러오기'}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function EmptyState() {
  return (
    <View className="items-center justify-center py-12">
      <Text className="mb-2 text-center text-gray-500 dark:text-gray-400">
        저장한 템플릿이 없습니다
      </Text>
      <Text className="text-center text-sm text-gray-400 dark:text-gray-500">
        공고 작성 후 템플릿으로 저장해 보세요
      </Text>
    </View>
  );
}

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

  const handleDeleteClick = (id: string, name: string) => {
    logger.info('템플릿 삭제 확인 모달 열기', { templateId: id, templateName: name });
    setDeleteTarget({ id, name });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) {
      return;
    }

    await onDeleteTemplate(deleteTarget.id, deleteTarget.name);
    setDeleteTarget(null);
  };

  return (
    <>
      <Modal visible={visible} onClose={onClose} title="템플릿 불러오기" size="lg">
        {templatesLoading ? (
          <View className="items-center justify-center py-12">
            <ActivityIndicator size="large" color="#A855F7" />
            <Text className="mt-3 text-gray-500 dark:text-gray-400">템플릿을 불러오는 중...</Text>
          </View>
        ) : null}

        {!templatesLoading && templates.length === 0 ? <EmptyState /> : null}

        {!templatesLoading && templates.length > 0 ? (
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
              // @ts-expect-error FlashList v2 typing gap
              estimatedItemSize={140}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
            />

            <View className="mt-3 rounded-lg bg-amber-50 p-3 dark:bg-amber-900/30">
              <Text className="text-center text-xs text-amber-700 dark:text-amber-300">
                템플릿을 불러온 뒤에는 날짜를 다시 설정해 주세요.
              </Text>
            </View>
          </View>
        ) : null}
      </Modal>

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
