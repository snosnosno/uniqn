/**
 * UNIQN Mobile - 공지사항 상세 페이지 (관리자)
 *
 * @description 공지사항 상세 보기 및 관리 (발행/보관/삭제)
 */

import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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

export default function AnnouncementDetailPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { data: announcement, isLoading, error } = useAnnouncementDetail(id ?? '');
  const { mutate: publishAnnouncement } = usePublishAnnouncement();
  const { mutate: archiveAnnouncement } = useArchiveAnnouncement();
  const { mutate: deleteAnnouncement } = useDeleteAnnouncement();

  // Format date
  const formatDate = (timestamp: unknown): string => {
    if (!timestamp) return '-';
    try {
      const date =
        timestamp instanceof Date
          ? timestamp
          : (timestamp as { toDate: () => Date }).toDate();
      return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '-';
    }
  };

  // Handle edit
  const handleEdit = useCallback(() => {
    router.push(`/(admin)/announcements/${id}/edit`);
  }, [router, id]);

  // Handle publish
  const handlePublish = useCallback(() => {
    const doPublish = () => {
      setActionLoading('publish');
      publishAnnouncement(id!, {
        onSettled: () => setActionLoading(null),
      });
    };

    if (Platform.OS === 'web') {
      if (window.confirm('이 공지사항을 발행하시겠습니까?')) {
        doPublish();
      }
    } else {
      Alert.alert('공지사항 발행', '이 공지사항을 발행하시겠습니까?', [
        { text: '취소', style: 'cancel' },
        { text: '발행', onPress: doPublish },
      ]);
    }
  }, [id, publishAnnouncement]);

  // Handle archive
  const handleArchive = useCallback(() => {
    const doArchive = () => {
      setActionLoading('archive');
      archiveAnnouncement(id!, {
        onSettled: () => setActionLoading(null),
      });
    };

    if (Platform.OS === 'web') {
      if (window.confirm('이 공지사항을 보관하시겠습니까?')) {
        doArchive();
      }
    } else {
      Alert.alert('공지사항 보관', '이 공지사항을 보관하시겠습니까?', [
        { text: '취소', style: 'cancel' },
        { text: '보관', onPress: doArchive },
      ]);
    }
  }, [id, archiveAnnouncement]);

  // Handle delete
  const handleDelete = useCallback(() => {
    const doDelete = () => {
      setActionLoading('delete');
      deleteAnnouncement(id!, {
        onSuccess: () => {
          router.back();
        },
        onSettled: () => setActionLoading(null),
      });
    };

    if (Platform.OS === 'web') {
      if (window.confirm('이 공지사항을 삭제하시겠습니까?\n삭제된 공지사항은 복구할 수 없습니다.')) {
        doDelete();
      }
    } else {
      Alert.alert(
        '공지사항 삭제',
        '이 공지사항을 삭제하시겠습니까?\n삭제된 공지사항은 복구할 수 없습니다.',
        [
          { text: '취소', style: 'cancel' },
          { text: '삭제', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  }, [id, deleteAnnouncement, router]);

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: '공지사항 상세' }} />
        <View className="flex-1 bg-gray-50 dark:bg-gray-900 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      </>
    );
  }

  if (error || !announcement) {
    return (
      <>
        <Stack.Screen options={{ title: '공지사항 상세' }} />
        <View className="flex-1 bg-gray-50 dark:bg-gray-900 items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text className="text-lg font-medium text-gray-700 dark:text-gray-300 mt-4">
            공지사항을 찾을 수 없습니다
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-6 bg-blue-600 px-6 py-3 rounded-lg"
          >
            <Text className="text-white font-medium">돌아가기</Text>
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
              <Ionicons name="create-outline" size={24} color="#2563eb" />
            </Pressable>
          ),
        }}
      />

      <ScrollView className="flex-1 bg-gray-50 dark:bg-gray-900">
        <View className="p-4">
          {/* Header Card */}
          <View className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 mb-4">
            {/* Badges */}
            <View className="flex-row flex-wrap gap-2 mb-3">
              {/* Status */}
              <View className={`px-2 py-1 rounded ${statusConfig.bgColor}`}>
                <Text className={`text-xs font-medium ${statusConfig.color}`}>
                  {statusConfig.label}
                </Text>
              </View>

              {/* Priority */}
              {announcement.priority > 0 && (
                <View className={`px-2 py-1 rounded ${priorityConfig.bgColor}`}>
                  <Text className={`text-xs font-medium ${priorityConfig.color}`}>
                    {priorityConfig.label}
                  </Text>
                </View>
              )}

              {/* Category */}
              <View className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700">
                <Text className="text-xs text-gray-600 dark:text-gray-400">
                  {categoryLabel}
                </Text>
              </View>

              {/* Pinned */}
              {announcement.isPinned && (
                <View className="px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/30 flex-row items-center">
                  <Ionicons name="pin" size={12} color="#f59e0b" />
                  <Text className="text-xs font-medium text-amber-700 dark:text-amber-300 ml-1">
                    고정
                  </Text>
                </View>
              )}
            </View>

            {/* Title */}
            <Text className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {announcement.title}
            </Text>

            {/* Meta */}
            <View className="flex-row flex-wrap gap-4">
              <View className="flex-row items-center">
                <Ionicons name="person-outline" size={14} color="#9ca3af" />
                <Text className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                  {announcement.authorName}
                </Text>
              </View>
              <View className="flex-row items-center">
                <Ionicons name="eye-outline" size={14} color="#9ca3af" />
                <Text className="text-sm text-gray-500 dark:text-gray-400 ml-1">
                  {announcement.viewCount.toLocaleString()}
                </Text>
              </View>
            </View>
          </View>

          {/* Content Card */}
          <View className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 mb-4">
            <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              내용
            </Text>
            <Text className="text-base text-gray-900 dark:text-white leading-6">
              {announcement.content}
            </Text>
          </View>

          {/* Image Card (다중 이미지 지원) */}
          {(() => {
            const images = getAnnouncementImages(announcement);
            if (images.length === 0) return null;

            return (
              <View className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 mb-4">
                <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
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
                          <View className="absolute bottom-1 right-1 bg-black/60 rounded-full px-2 py-0.5">
                            <Text className="text-white text-xs font-medium">
                              {index + 1}
                            </Text>
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
          <View className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 mb-4">
            <Text className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
              정보
            </Text>

            {/* Target Audience */}
            <View className="flex-row justify-between py-2 border-b border-gray-100 dark:border-gray-700">
              <Text className="text-sm text-gray-500 dark:text-gray-400">대상</Text>
              <Text className="text-sm text-gray-900 dark:text-white">
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
            <View className="flex-row justify-between py-2 border-b border-gray-100 dark:border-gray-700">
              <Text className="text-sm text-gray-500 dark:text-gray-400">작성일</Text>
              <Text className="text-sm text-gray-900 dark:text-white">
                {formatDate(announcement.createdAt)}
              </Text>
            </View>

            {/* Published At */}
            {announcement.publishedAt && (
              <View className="flex-row justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <Text className="text-sm text-gray-500 dark:text-gray-400">발행일</Text>
                <Text className="text-sm text-gray-900 dark:text-white">
                  {formatDate(announcement.publishedAt)}
                </Text>
              </View>
            )}

            {/* Updated At */}
            <View className="flex-row justify-between py-2">
              <Text className="text-sm text-gray-500 dark:text-gray-400">수정일</Text>
              <Text className="text-sm text-gray-900 dark:text-white">
                {formatDate(announcement.updatedAt)}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View className="gap-3 pb-8">
            {/* Publish (draft only) */}
            {announcement.status === 'draft' && (
              <Pressable
                onPress={handlePublish}
                disabled={!!actionLoading}
                className="bg-green-600 rounded-lg py-3 items-center flex-row justify-center"
              >
                {actionLoading === 'publish' ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="paper-plane-outline" size={18} color="#fff" />
                    <Text className="text-white font-medium ml-2">발행하기</Text>
                  </>
                )}
              </Pressable>
            )}

            {/* Archive (published only) */}
            {announcement.status === 'published' && (
              <Pressable
                onPress={handleArchive}
                disabled={!!actionLoading}
                className="bg-amber-600 rounded-lg py-3 items-center flex-row justify-center"
              >
                {actionLoading === 'archive' ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="archive-outline" size={18} color="#fff" />
                    <Text className="text-white font-medium ml-2">보관하기</Text>
                  </>
                )}
              </Pressable>
            )}

            {/* Edit */}
            <Pressable
              onPress={handleEdit}
              disabled={!!actionLoading}
              className="bg-blue-600 rounded-lg py-3 items-center flex-row justify-center"
            >
              <Ionicons name="create-outline" size={18} color="#fff" />
              <Text className="text-white font-medium ml-2">수정하기</Text>
            </Pressable>

            {/* Delete */}
            <Pressable
              onPress={handleDelete}
              disabled={!!actionLoading}
              className="bg-red-600 rounded-lg py-3 items-center flex-row justify-center"
            >
              {actionLoading === 'delete' ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={18} color="#fff" />
                  <Text className="text-white font-medium ml-2">삭제하기</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
