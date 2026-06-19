/**
 * UNIQN Mobile - InquiryAttachmentGallery 컴포넌트
 *
 * @description 조회 화면(내 문의 상세 / 관리자 상세)에서 첨부 이미지 썸네일 + 풀스크린 프리뷰
 *
 * Impeccable 룰:
 * - v2 #18: expo-image `transition={200}` + blurhash는 후속 (현재 placeholder는 surface-overlay)
 * - v1 #5: 닫기 버튼 hitSlop + 44px 터치 영역
 * - v2 #21: Pressed 대비 다크/라이트 반대 방향
 */

import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, Modal, StatusBar } from 'react-native';
import { Image } from 'expo-image';
import { XIcon } from '@/components/icons';
import { useInquiryAttachmentUrl } from '@/hooks/useInquiry';
import type { InquiryAttachment } from '@/types';

export interface InquiryAttachmentGalleryProps {
  attachments: InquiryAttachment[];
}

interface ThumbnailProps {
  attachment: InquiryAttachment;
  index: number;
  onPress: (index: number) => void;
}

function AttachmentThumbnail({ attachment, index, onPress }: ThumbnailProps) {
  const { data: signedUrl, isLoading } = useInquiryAttachmentUrl(attachment.path);

  return (
    <Pressable
      onPress={() => onPress(index)}
      accessibilityRole="button"
      accessibilityLabel={`첨부 이미지 ${index + 1} 크게 보기`}
      className="h-20 w-20 overflow-hidden rounded-lg bg-surface-overlay dark:bg-surface-elevated"
    >
      {signedUrl ? (
        <Image
          source={{ uri: signedUrl }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
      ) : (
        <View className="flex-1 items-center justify-center">
          {isLoading ? null : (
            <Text className="text-micro text-content-placeholder font-sans">불러오기 실패</Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

interface FullScreenPreviewProps {
  visible: boolean;
  attachments: InquiryAttachment[];
  initialIndex: number;
  onClose: () => void;
}

function FullScreenPreview({
  visible,
  attachments,
  initialIndex,
  onClose,
}: FullScreenPreviewProps) {
  const current = attachments[initialIndex];
  const { data: signedUrl } = useInquiryAttachmentUrl(current?.path);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <StatusBar barStyle="light-content" />
      <View className="flex-1 bg-black/95">
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="닫기"
          className="absolute right-4 top-12 z-10 h-11 w-11 items-center justify-center rounded-full bg-white/10"
        >
          <XIcon size={22} color="#FFFFFF" />
        </Pressable>
        <View className="flex-1 items-center justify-center px-4">
          {signedUrl && (
            <Image
              source={{ uri: signedUrl }}
              style={{ width: '100%', height: '80%' }}
              contentFit="contain"
              transition={200}
            />
          )}
          <Text className="mt-4 text-sm text-white/70 font-sans">
            {initialIndex + 1} / {attachments.length}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

export function InquiryAttachmentGallery({ attachments }: InquiryAttachmentGalleryProps) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const handleOpen = useCallback((index: number) => {
    setPreviewIndex(index);
  }, []);

  const handleClose = useCallback(() => {
    setPreviewIndex(null);
  }, []);

  if (!attachments || attachments.length === 0) return null;

  return (
    <View className="mt-4">
      <Text className="mb-2 text-micro uppercase tracking-wider text-content-muted font-sans-bold">
        첨부파일 ({attachments.length})
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {attachments.map((attachment, index) => (
          <AttachmentThumbnail
            key={attachment.path}
            attachment={attachment}
            index={index}
            onPress={handleOpen}
          />
        ))}
      </View>

      {previewIndex !== null && (
        <FullScreenPreview
          visible
          attachments={attachments}
          initialIndex={previewIndex}
          onClose={handleClose}
        />
      )}
    </View>
  );
}

export default InquiryAttachmentGallery;
