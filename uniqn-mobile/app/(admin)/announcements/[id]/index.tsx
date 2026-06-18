/**
 * UNIQN Mobile - 공지사항 상세 페이지 (관리자)
 *
 * @description 공지사항 상세 보기 및 관리 (발행/보관/삭제)
 */

import { PRIMARY_COLORS, SECONDARY_PALETTE, STATUS_COLORS } from '@/constants/colors';
import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StackHeader } from '@/components/headers';
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
import { NumericText } from '@/components/ui';
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
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader title="공지사항 상세" fallbackHref="/(admin)/announcements" />
        <View className="flex-1 bg-surface-page dark:bg-surface items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !announcement) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader title="공지사항 상세" fallbackHref="/(admin)/announcements" />
        <View className="flex-1 bg-surface-page dark:bg-surface items-center justify-center px-8">
          <AlertCircleOutlineIcon size={64} color={STATUS_COLORS.error} />
          <Text className="text-lg font-sans-medium text-content-secondary mt-4">
            공지사항을 찾을 수 없습니다
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-6 bg-primary-600 px-6 py-3 rounded-lg"
          >
            <Text className="text-content-onGold font-sans-medium">돌아가기</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const statusConfig = ANNOUNCEMENT_STATUS_CONFIG[announcement.status];
  const priorityConfig = ANNOUNCEMENT_PRIORITY_CONFIG[announcement.priority];
  const categoryLabel = ANNOUNCEMENT_CATEGORY_LABELS[announcement.category];

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader
        title="공지사항 상세"
        fallbackHref="/(admin)/announcements"
        rightAction={
          <Pressable onPress={handleEdit} accessibilityLabel="공지사항 수정" hitSlop={8}>
            <CreateOutlineIcon size={24} color={PRIMARY_COLORS[600]} />
          </Pressable>
        }
      />

      <ScrollView className="flex-1 bg-surface-page dark:bg-surface">
        {/* Hero */}
        <View className="bg-surface-elevated dark:bg-surface-elevated px-4 py-4 border-b border-divider">
          {/* Badges */}
          <View className="flex-row flex-wrap gap-2 mb-2">
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
                <PinIcon size={12} color={STATUS_COLORS.warning} />
                <Text className="text-xs font-sans-medium text-warning-700 dark:text-warning-300 ml-1">
                  고정
                </Text>
              </View>
            )}
          </View>

          {/* Title */}
          <Text
            className="text-content-primary dark:text-off-white text-lg font-sans-bold"
            style={{ letterSpacing: -0.5, lineHeight: 24 }}
          >
            {announcement.title}
          </Text>

          {/* Meta */}
          <View className="flex-row flex-wrap gap-4 mt-2">
            <View className="flex-row items-center">
              <PersonOutlineIcon size={14} color={SECONDARY_PALETTE[400]} />
              <Text className="text-sm text-content-secondary ml-1 font-sans">
                {announcement.authorName}
              </Text>
            </View>
            <View className="flex-row items-center">
              <EyeOutlineIcon size={14} color={SECONDARY_PALETTE[400]} />
              <NumericText className="text-sm text-content-secondary ml-1 font-sans">
                {announcement.viewCount.toLocaleString()}
              </NumericText>
            </View>
          </View>
        </View>

        {/* 내용 */}
        <View className="px-4 py-3 border-b border-divider">
          <Text className="text-[10px] uppercase tracking-wider text-content-muted font-sans-bold mb-2">
            내용
          </Text>
          <Text className="text-base text-content-primary dark:text-off-white leading-6 font-sans">
            {announcement.content}
          </Text>
        </View>

        {/* 첨부 이미지 (다중 이미지 지원) */}
        {(() => {
          const images = getAnnouncementImages(announcement);
          if (images.length === 0) return null;

          return (
            <View className="px-4 py-3 border-b border-divider">
              <Text className="text-[10px] uppercase tracking-wider text-content-muted font-sans-bold mb-2">
                첨부 이미지 ({images.length}장)
              </Text>
              {images.length === 1 ? (
                // 단일 이미지
                <Image
                  source={{ uri: images[0].url }}
                  style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 8 }}
                  contentFit="cover"
                  placeholder={images[0].blurhash ? { blurhash: images[0].blurhash } : undefined}
                  placeholderContentFit="cover"
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
                          placeholder={image.blurhash ? { blurhash: image.blurhash } : undefined}
                          placeholderContentFit="cover"
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

        {/* 정보 */}
        <View className="px-4 py-3 border-b border-divider">
          <Text className="text-[10px] uppercase tracking-wider text-content-muted font-sans-bold mb-2">
            정보
          </Text>

          {/* Target Audience */}
          <View className="flex-row justify-between py-2 border-b border-divider">
            <Text className="text-sm text-content-secondary font-sans">대상</Text>
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
          <View className="flex-row justify-between py-2 border-b border-divider">
            <Text className="text-sm text-content-secondary font-sans">작성일</Text>
            <NumericText className="text-sm text-content-primary dark:text-off-white font-sans">
              {formatDate(announcement.createdAt)}
            </NumericText>
          </View>

          {/* Published At */}
          {announcement.publishedAt && (
            <View className="flex-row justify-between py-2 border-b border-divider">
              <Text className="text-sm text-content-secondary font-sans">발행일</Text>
              <NumericText className="text-sm text-content-primary dark:text-off-white font-sans">
                {formatDate(announcement.publishedAt)}
              </NumericText>
            </View>
          )}

          {/* Updated At */}
          <View className="flex-row justify-between py-2">
            <Text className="text-sm text-content-secondary font-sans">수정일</Text>
            <NumericText className="text-sm text-content-primary dark:text-off-white font-sans">
              {formatDate(announcement.updatedAt)}
            </NumericText>
          </View>
        </View>

        {/* Action Buttons */}
        <View className="gap-3 px-4 py-4 pb-8">
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
            <CreateOutlineIcon size={18} color="#09090B" />
            <Text className="text-content-onGold font-sans-medium ml-2">수정하기</Text>
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
      </ScrollView>
    </SafeAreaView>
  );
}
