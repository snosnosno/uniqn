/**
 * UNIQN Mobile - ReportEvidenceGallery 컴포넌트
 *
 * @description 관리자 신고 상세에서 증빙 이미지 썸네일 + 풀스크린 프리뷰
 *
 * 1:1 문의 첨부 갤러리(`InquiryAttachmentGallery`)와 동일한 열람 방식:
 * 비공개 버킷이라 URL 을 저장하지 않고 **열람 시점에 서명 URL 을 발급**한다.
 * 차이는 데이터 모양뿐 — 신고는 JSONB 객체가 아니라 `evidence_urls` text[] 에 경로를 담는다.
 */

import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, Modal, StatusBar } from 'react-native';
import { Image } from 'expo-image';
import { XIcon } from '@/components/icons';
import { useReportEvidenceUrl } from '@/hooks/useReportEvidence';

export interface ReportEvidenceGalleryProps {
  /** Storage 경로(신규) 또는 http(s) 절대 URL(과거 데이터) 목록 */
  refs: string[];
}

interface ThumbnailProps {
  evidenceRef: string;
  index: number;
  onPress: (index: number) => void;
}

function EvidenceThumbnail({ evidenceRef, index, onPress }: ThumbnailProps) {
  const { data: url, isLoading } = useReportEvidenceUrl(evidenceRef);

  return (
    <Pressable
      onPress={() => onPress(index)}
      accessibilityRole="button"
      accessibilityLabel={`증빙 이미지 ${index + 1} 크게 보기`}
      className="h-20 w-20 overflow-hidden rounded-lg bg-surface-overlay dark:bg-surface-elevated"
    >
      {url ? (
        <Image
          source={{ uri: url }}
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
  refs: string[];
  initialIndex: number;
  onClose: () => void;
}

function FullScreenPreview({ refs, initialIndex, onClose }: FullScreenPreviewProps) {
  const { data: url } = useReportEvidenceUrl(refs[initialIndex]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
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
          {url && (
            <Image
              source={{ uri: url }}
              style={{ width: '100%', height: '80%' }}
              contentFit="contain"
              transition={200}
            />
          )}
          <Text className="mt-4 text-sm text-white/70 font-sans">
            {initialIndex + 1} / {refs.length}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

export function ReportEvidenceGallery({ refs }: ReportEvidenceGalleryProps) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const handleOpen = useCallback((index: number) => {
    setPreviewIndex(index);
  }, []);

  const handleClose = useCallback(() => {
    setPreviewIndex(null);
  }, []);

  if (!refs || refs.length === 0) return null;

  return (
    <View className="mt-4 pt-4 border-t border-secondary-100 dark:border-surface-overlay">
      <Text className="mb-2 text-micro uppercase tracking-wider text-content-muted font-sans-bold">
        증빙 사진 ({refs.length})
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {refs.map((evidenceRef, index) => (
          <EvidenceThumbnail
            key={evidenceRef}
            evidenceRef={evidenceRef}
            index={index}
            onPress={handleOpen}
          />
        ))}
      </View>

      {previewIndex !== null && (
        <FullScreenPreview refs={refs} initialIndex={previewIndex} onClose={handleClose} />
      )}
    </View>
  );
}
