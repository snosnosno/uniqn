/**
 * UNIQN Mobile - 공지사항 상세 페이지 (관리자)
 *
 * @description 공지사항 상세 보기 및 관리 (발행/보관/삭제)
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import {
  AlertCircleOutlineIcon,
  ArchiveOutlineIcon,
  CreateOutlineIcon,
  EyeOutlineIcon,
  PaperPlaneOutlineIcon,
  PersonOutlineIcon,
  PinIcon,
  TrashOutlineIcon,
} from '@/components/icons';
import { STATUS } from '@/constants';
import {
  useAnnouncementDetail,
  usePublishAnnouncement,
  useArchiveAnnouncement,
  useDeleteAnnouncement,
} from '@/hooks/useAnnouncement';
import {
  ANNOUNCEMENT_STATUS_CONFIG,
  ANNOUNCEMENT_CATEGORY_LABELS,
  ANNOUNCEMENT_PRIORITY_CONFIG,
  getAnnouncementImages,
} from '@/types/announcement';
import { useModal } from '@/stores/modalStore';
import { toDate, type DateInput } from '@/utils/date';

export default function AnnouncementDetailPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { showConfirm } = useModal();
  const { data: announcement, isLoading, error } = useAnnouncementDetail(id ?? '');
  const { mutate: publishAnnouncement } = usePublishAnnouncement();
  const { mutate: archiveAnnouncement } = useArchiveAnnouncement();
  const { mutate: deleteAnnouncement } = useDeleteAnnouncement();

  // Format date
  const formatDate = (timestamp: DateInput): string => {
    const date = toDate(timestamp);
    if (!date) {
      return '-';
    }

    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Handle edit
  const handleEdit = useCallback(() => {
    router.push(`/(admin)/announcements/${id}/edit`);
  }, [router, id]);

  // Handle publish
  const handlePublish = useCallback(() => {
    showConfirm('공지사항 발행', '이 공지사항을 발행하시겠습니까?', () => {
      setActionLoading('publish');
      publishAnnouncement(id!, {
        onSettled: () => setActionLoading(null),
      });
    });
  }, [id, publishAnnouncement, showConfirm]);

  // Handle archive
  const handleArchive = useCallback(() => {
    showConfirm('공지사항 보관', '이 공지사항을 보관하시겠습니까?', () => {
      setActionLoading('archive');
      archiveAnnouncement(id!, {
        onSettled: () => setActionLoading(null),
      });
    });
  }, [id, archiveAnnouncement, showConfirm]);

  // Handle delete
  const handleDelete = useCallback(() => {
    showConfirm(
      '공지사항 삭제',
      '이 공지사항을 삭제하시겠습니까?\n삭제된 공지사항은 복구할 수 없습니다.',
      () => {
        setActionLoading('delete');
        deleteAnnouncement(id!, {
          onSuccess: () => {
            router.back();
          },
          onSettled: () => setActionLoading(null),
        });
      }
    );
  }, [id, deleteAnnouncement, router, showConfirm]);

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: '공지사항 상세' }} />
        <View className="flex-1 bg-surface-page items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      </>
    );
  }

  if (error || !announcement) {
    return (
      <>
        <Stack.Screen options={{ title: '공지사항 상세' }} />
        <View className="flex-1 bg-surface-page items-center justify-center px-8">
          <AlertCircleOutlineIcon size={64} color="#EF4444" />
          <Text className="text-lg font-sans-medium text-content-secondary mt-4">
            공지사항을 찾을 수 없습니다
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-6 bg-primary-600 px-6 py-3 rounded-lg"
          >
            <Text className="text-surface-dark font-sans-medium">돌아가기</Text>
          </Pressable>
        </View>
      </>
    );
  }

  const statusConfig = ANNOUNCEMENT_STATUS_CONFIG[announcement.status];
  const priorityConfig = ANNOUNCEMENT_PRIORITY_CONFIG[announcement.priority];
  const categoryLabel = ANNOUNCEMENT_CATEGORY_LABELS[announcement.category];

  return (
    <>
      <Stack.Screen
        options={{
          title: '공지사항 상세',
          headerBackTitle: '목록',
          headerRight: () => (
            <Pressable onPress={handleEdit} className="mr-2">
              <CreateOutlineIcon size={24} color="#B8962E" />
            </Pressable>
          ),
        }}
      />

      <ScrollView className="flex-1 bg-surface-page">
        <View className="p-4">
          {/* Header Card */}
          <View className="bg-white dark:bg-surface rounded-md p-4 border border-secondary-100 dark:border-surface-overlay mb-4">
            {/* Badges */}
            <View className="flex-row flex-wrap gap-2 mb-3">
              {/* Status */}
              <View className={`px-2 py-1 rounded ${statusConfig.bgColor}`}>
                <Text className={`text-xs font-sans-medium ${statusConfig.color}`}>
                  {statusConfig.label}
                </Text>
              </View>

              {/* Priority */}
              {announcement.priority > 0 && (
                <View className={`px-2 py-1 rounded ${priorityConfig.bgColor}`}>
                  <Text className={`text-xs font-sans-medium ${priorityConfig.color}`}>
                    {priorityConfig.label}
                  </Text>
                </View>
              )}

              {/* Category */}
              <View className="px-2 py-1 rounded bg-surface-card dark:bg-surface">
                <Text className="text-xs text-content-muted dark:text-secondary-400 font-sans">
                  {categoryLabel}
                </Text>
              </View>

              {/* Pinned */}
              {announcement.isPinned && (
                <View className="px-2 py-1 rounded bg-warning-100 dark:bg-warning-900/30 flex-row items-center">
                  <PinIcon size={12} color="#D4A017" />
                  <Text className="text-xs font-sans-medium text-warning-700 dark:text-warning-300 ml-1">
                    고정
                  </Text>
                </View>
              )}
            </View>

            {/* Title */}
            <Text className="text-xl font-display text-content-primary dark:text-off-white mb-2">
              {announcement.title}
            </Text>

            {/* Meta */}
            <View className="flex-row flex-wrap gap-4">
              <View className="flex-row items-center">
                <PersonOutlineIcon size={14} color={SECONDARY_PALETTE[400]} />
                <Text className="text-sm text-secondary-500 dark:text-secondary-400 ml-1 font-sans">
                  {announcement.authorName}
                </Text>
              </View>
              <View className="flex-row items-center">
                <EyeOutlineIcon size={14} color={SECONDARY_PALETTE[400]} />
                <Text className="text-sm text-secondary-500 dark:text-secondary-400 ml-1 font-sans">
                  {announcement.viewCount.toLocaleString()}
                </Text>
              </View>
            </View>
          </View>

          {/* Content Card */}
          <View className="bg-white dark:bg-surface rounded-md p-4 border border-secondary-100 dark:border-surface-overlay mb-4">
            <Text className="text-sm font-sans-medium text-secondary-500 dark:text-secondary-400 mb-2">
              내용
            </Text>
            <Text className="text-base text-content-primary dark:text-off-white leading-6 font-sans">
              {announcement.content}
            </Text>
          </View>

          {/* Image Card (다중 이미지 지원) */}
          {(() => {
            const images = getAnnouncementImages(announcement);
            if (images.length === 0) return null;

            return (
              <View className="bg-white dark:bg-surface rounded-md p-4 border border-secondary-100 dark:border-surface-overlay mb-4">
                <Text className="text-sm font-sans-medium text-secondary-500 dark:text-secondary-400 mb-2">
                  첨부 이미지 ({images.length}장)
                </Text>
                {images.length === 1 ? (
                  // 단일 이미지
                  <Image
                    source={{ uri: images[0].url }}
                    style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 8 }}
                    contentFit="cover"
                    transition={200}
                  />
                ) : (
                  // 다중 이미지 그리드
                  <View className="flex-row flex-wrap" style={{ margin: -4 }}>
                    {images.map((image, index) => (
                      <View
                        key={image.id}
                        style={{
                          width: images.length === 2 ? '50%' : '33.33%',
                          padding: 4,
                        }}
                      >
                        <View className="relative">
                          <Image
                            source={{ uri: image.url }}
                            style={{
                              width: '100%',
                              aspectRatio: 1,
                              borderRadius: 8,
                            }}
                            contentFit="cover"
                            transition={200}
                          />
                          <View className="absolute bottom-1 right-1 bg-black/60 rounded-sm px-2 py-0.5">
                            <Text className="text-white text-xs font-sans-medium">{index + 1}</Text>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })()}

          {/* Info Card */}
          <View className="bg-white dark:bg-surface rounded-md p-4 border border-secondary-100 dark:border-surface-overlay mb-4">
            <Text className="text-sm font-sans-medium text-secondary-500 dark:text-secondary-400 mb-3">
              정보
            </Text>

            {/* Target Audience */}
            <View className="flex-row justify-between py-2 border-b border-secondary-100 dark:border-surface-overlay">
              <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                대상
              </Text>
              <Text className="text-sm text-content-primary dark:text-off-white font-sans">
                {announcement.targetAudience.type === 'all'
                  ? '전체'
                  : announcement.targetAudience.roles
                      ?.map((role) => {
                        switch (role) {
                          case 'admin':
                            return '관리자';
                          case 'employer':
                            return '구인자';
                          case 'staff':
                            return '스태프';
                          default:
                            return role;
                        }
                      })
                      .join(', ')}
              </Text>
            </View>

            {/* Created At */}
            <View className="flex-row justify-between py-2 border-b border-secondary-100 dark:border-surface-overlay">
              <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                작성일
              </Text>
              <Text className="text-sm text-content-primary dark:text-off-white font-sans">
                {formatDate(announcement.createdAt)}
              </Text>
            </View>

            {/* Published At */}
            {announcement.publishedAt && (
              <View className="flex-row justify-between py-2 border-b border-secondary-100 dark:border-surface-overlay">
                <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                  발행일
                </Text>
                <Text className="text-sm text-content-primary dark:text-off-white font-sans">
                  {formatDate(announcement.publishedAt)}
                </Text>
              </View>
            )}

            {/* Updated At */}
            <View className="flex-row justify-between py-2">
              <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                수정일
              </Text>
              <Text className="text-sm text-content-primary dark:text-off-white font-sans">
                {formatDate(announcement.updatedAt)}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="gap-3 pb-8">
            {/* Publish (draft only) */}
            {announcement.status === STATUS.ANNOUNCEMENT.DRAFT && (
              <Pressable
                onPress={handlePublish}
                disabled={!!actionLoading}
                className="bg-success-600 rounded-lg py-3 items-center flex-row justify-center"
              >
                {actionLoading === 'publish' ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <PaperPlaneOutlineIcon size={18} color="#fff" />
                    <Text className="text-white font-sans-medium ml-2">발행하기</Text>
                  </>
                )}
              </Pressable>
            )}

            {/* Archive (published only) */}
            {announcement.status === STATUS.ANNOUNCEMENT.PUBLISHED && (
              <Pressable
                onPress={handleArchive}
                disabled={!!actionLoading}
                className="bg-warning-600 rounded-lg py-3 items-center flex-row justify-center"
              >
                {actionLoading === 'archive' ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <ArchiveOutlineIcon size={18} color="#fff" />
                    <Text className="text-white font-sans-medium ml-2">보관하기</Text>
                  </>
                )}
              </Pressable>
            )}

            {/* Edit */}
            <Pressable
              onPress={handleEdit}
              disabled={!!actionLoading}
              className="bg-primary-600 rounded-lg py-3 items-center flex-row justify-center"
            >
              <CreateOutlineIcon size={18} color="#fff" />
              <Text className="text-surface-dark font-sans-medium ml-2">수정하기</Text>
            </Pressable>

            {/* Delete */}
            <Pressable
              onPress={handleDelete}
              disabled={!!actionLoading}
              className="bg-error-600 rounded-lg py-3 items-center flex-row justify-center"
            >
              {actionLoading === 'delete' ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <TrashOutlineIcon size={18} color="#fff" />
                  <Text className="text-white font-sans-medium ml-2">삭제하기</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
