/**
 * UNIQN Mobile - 공지사항 상세 페이지 (사용자용)
 *
 * @description 공지사항 상세 내용을 표시하는 페이지
 */

import { useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, Dimensions, Modal, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Image } from 'expo-image';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, Badge } from '@/components/ui';
import { MegaphoneIcon, GiftIcon, WrenchScrewdriverIcon, ArrowPathIcon } from '@/components/icons';
import { useAnnouncementDetail, useIncrementViewCount } from '@/hooks/useAnnouncement';
import type { AnnouncementCategory } from '@/types';
import { toDate, getAnnouncementImages } from '@/types';
import type { AnnouncementImage } from '@/types/announcement';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const SCREEN_WIDTH = Dimensions.get('window').width;

// 카테고리별 아이콘
const CATEGORY_ICONS: Record<AnnouncementCategory, React.ReactNode> = {
  notice: <MegaphoneIcon size={24} color="#A855F7" />,
  update: <ArrowPathIcon size={24} color="#8B5CF6" />,
  event: <GiftIcon size={24} color="#F59E0B" />,
  maintenance: <WrenchScrewdriverIcon size={24} color="#6B7280" />,
};

// 카테고리별 라벨
const CATEGORY_LABELS: Record<AnnouncementCategory, string> = {
  notice: '공지',
  update: '업데이트',
  event: '이벤트',
  maintenance: '점검',
};

// 카테고리별 배지 스타일 (BadgeVariant: default, primary, secondary, success, warning, error)
const CATEGORY_BADGE_VARIANT: Record<AnnouncementCategory, 'primary' | 'success' | 'warning' | 'default'> = {
  notice: 'primary',
  update: 'success',
  event: 'warning',
  maintenance: 'default',
};

export default function NoticeDetailPage() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: notice, isLoading, error } = useAnnouncementDetail(id ?? '');
  const { mutate: incrementView } = useIncrementViewCount();

  // 이미지 뷰어 상태
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // 조회수 증가 (페이지 진입 시 1회)
  useEffect(() => {
    if (id) {
      incrementView(id);
    }
  }, [id, incrementView]);

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: '공지사항' }} />
        <View className="flex-1 bg-gray-50 dark:bg-surface-dark items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      </>
    );
  }

  if (error || !notice) {
    return (
      <>
        <Stack.Screen options={{ title: '공지사항' }} />
        <View className="flex-1 bg-gray-50 dark:bg-surface-dark items-center justify-center px-8">
          <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
          <Text className="text-lg font-medium text-gray-700 dark:text-gray-300 mt-4">
            공지사항을 찾을 수 없습니다
          </Text>
          <Text className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
            삭제되었거나 존재하지 않는 공지사항입니다
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-6 bg-primary-600 px-6 py-3 rounded-lg"
          >
            <Text className="text-white font-medium">돌아가기</Text>
          </Pressable>
        </View>
      </>
    );
  }

  // 날짜 포맷팅 (publishedAt 또는 createdAt 사용)
  const dateValue = notice.publishedAt ?? notice.createdAt;
  const convertedDate = dateValue ? toDate(dateValue) : undefined;
  const publishedDate = convertedDate
    ? format(convertedDate, 'yyyy년 M월 d일 (EEEE) HH:mm', { locale: ko })
    : '';

  return (
    <>
      <Stack.Screen
        options={{
          title: '공지사항',
          headerBackTitle: '목록',
        }}
      />

      <ScrollView className="flex-1 bg-gray-50 dark:bg-surface-dark">
        <View className="p-4">
          {/* 헤더 카드 */}
          <Card className="mb-4">
            {/* 배지 영역 */}
            <View className="flex-row flex-wrap items-center gap-2 mb-3">
              {/* 카테고리 아이콘 */}
              {CATEGORY_ICONS[notice.category]}

              {/* 고정 배지 */}
              {notice.isPinned && (
                <Badge variant="error" size="sm">
                  고정
                </Badge>
              )}

              {/* 우선순위 배지 */}
              {notice.priority === 2 && (
                <Badge variant="error" size="sm">
                  긴급
                </Badge>
              )}
              {notice.priority === 1 && (
                <Badge variant="primary" size="sm">
                  중요
                </Badge>
              )}

              {/* 카테고리 배지 */}
              <Badge variant={CATEGORY_BADGE_VARIANT[notice.category]} size="sm">
                {CATEGORY_LABELS[notice.category]}
              </Badge>
            </View>

            {/* 제목 */}
            <Text className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {notice.title}
            </Text>

            {/* 메타 정보 */}
            <View className="flex-row items-center flex-wrap gap-x-3 gap-y-1">
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                {notice.authorName}
              </Text>
              <Text className="text-sm text-gray-400 dark:text-gray-500">•</Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                {publishedDate}
              </Text>
              <Text className="text-sm text-gray-400 dark:text-gray-500">•</Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400">
                조회 {notice.viewCount.toLocaleString()}
              </Text>
            </View>
          </Card>

          {/* 본문 카드 */}
          <Card>
            <Text className="text-base leading-7 text-gray-800 dark:text-gray-200">
              {notice.content}
            </Text>
          </Card>

          {/* 이미지 갤러리 (다중 이미지 지원) */}
          {(() => {
            const images = getAnnouncementImages(notice);
            if (images.length === 0) return null;

            return (
              <Card className="mt-4">
                {images.length === 1 ? (
                  // 단일 이미지
                  <Pressable
                    onPress={() => {
                      setSelectedImageIndex(0);
                      setImageViewerVisible(true);
                    }}
                  >
                    <Image
                      source={{ uri: images[0].url }}
                      style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 8 }}
                      contentFit="cover"
                      transition={200}
                    />
                  </Pressable>
                ) : (
                  // 다중 이미지 그리드
                  <View>
                    <View className="flex-row flex-wrap" style={{ margin: -4 }}>
                      {images.map((image: AnnouncementImage, index: number) => (
                        <Pressable
                          key={image.id}
                          onPress={() => {
                            setSelectedImageIndex(index);
                            setImageViewerVisible(true);
                          }}
                          style={{
                            width: images.length === 2 ? '50%' : '33.33%',
                            padding: 4,
                          }}
                        >
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
                          {/* 이미지 번호 표시 */}
                          <View className="absolute bottom-2 right-2 bg-black/60 rounded-full px-2 py-0.5">
                            <Text className="text-white text-xs font-medium">
                              {index + 1}/{images.length}
                            </Text>
                          </View>
                        </Pressable>
                      ))}
                    </View>
                    <Text className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
                      이미지를 탭하면 크게 볼 수 있습니다
                    </Text>
                  </View>
                )}
              </Card>
            );
          })()}
        </View>
      </ScrollView>

      {/* 이미지 뷰어 모달 */}
      {(() => {
        const images = notice ? getAnnouncementImages(notice) : [];
        if (images.length === 0) return null;

        return (
          <Modal
            visible={imageViewerVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setImageViewerVisible(false)}
          >
            <View className="flex-1 bg-black">
              {/* 헤더 */}
              <View className="flex-row items-center justify-between px-4 pt-12 pb-4">
                <Pressable
                  onPress={() => setImageViewerVisible(false)}
                  className="p-2"
                  hitSlop={8}
                >
                  <Ionicons name="close" size={28} color="white" />
                </Pressable>
                <Text className="text-white text-base font-medium">
                  {selectedImageIndex + 1} / {images.length}
                </Text>
                <View className="w-10" />
              </View>

              {/* 이미지 */}
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
                  const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                  setSelectedImageIndex(index);
                }}
                contentOffset={{ x: selectedImageIndex * SCREEN_WIDTH, y: 0 }}
              >
                {images.map((image: AnnouncementImage) => (
                  <View
                    key={image.id}
                    style={{ width: SCREEN_WIDTH }}
                    className="items-center justify-center"
                  >
                    <Image
                      source={{ uri: image.url }}
                      style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 0.75 }}
                      contentFit="contain"
                      transition={200}
                    />
                  </View>
                ))}
              </ScrollView>

              {/* 페이지 인디케이터 */}
              {images.length > 1 && (
                <View className="flex-row justify-center py-4 gap-2">
                  {images.map((_: AnnouncementImage, index: number) => (
                    <View
                      key={index}
                      className={`w-2 h-2 rounded-full ${
                        index === selectedImageIndex
                          ? 'bg-white'
                          : 'bg-white/40'
                      }`}
                    />
                  ))}
                </View>
              )}
            </View>
          </Modal>
        );
      })()}
    </>
  );
}
