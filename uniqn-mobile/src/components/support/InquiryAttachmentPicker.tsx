/**
 * UNIQN Mobile - InquiryAttachmentPicker 컴포넌트
 *
 * @description 1:1 문의 이미지 첨부 선택/프리뷰/삭제 UI
 *
 * 제약 (룰: `docs/plans/support-center-update-2026-04-21.md` §4.6.1):
 * - 이미지만 (image/jpeg, image/png, image/webp)
 * - 최대 3장, 장당 5MB
 * - 3장 도달 시 추가 버튼 비활성화
 *
 * Impeccable 룰:
 * - v1 #5 터치 44px: 삭제 버튼 `hitSlop={10}` + 24px 시각 크기
 * - v1 #11 구체 동사: "이미지 추가 (N/3)" 라벨
 * - v2 #17 Haptics: 이미지 삭제 Light
 * - v2 #18 blurhash: 향후 — 현재는 expo-image transition 200ms
 */

import React, { useCallback } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { PlusIcon, XIcon } from '@/components/icons';
import { useToastStore } from '@/stores/toastStore';
import { useThemeStore } from '@/stores/themeStore';
import { triggerHaptic } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { INQUIRY_ATTACHMENT_LIMITS } from '@/types';
import type { LocalInquiryAttachment, InquiryAttachmentMime } from '@/types';

const COMPONENT = 'InquiryAttachmentPicker';

export interface InquiryAttachmentPickerProps {
  /** 현재 선택된 로컬 이미지 배열 */
  value: LocalInquiryAttachment[];
  /** 변경 콜백 */
  onChange: (files: LocalInquiryAttachment[]) => void;
  /** 비활성화 (제출 중 등) */
  disabled?: boolean;
}

function mimeFromExt(fileName?: string, fallback?: string): InquiryAttachmentMime | null {
  const source = (fallback ?? fileName ?? '').toLowerCase();
  if (
    source.includes('jpeg') ||
    source.includes('jpg') ||
    source.endsWith('.jpg') ||
    source.endsWith('.jpeg')
  ) {
    return 'image/jpeg';
  }
  if (source.includes('png') || source.endsWith('.png')) {
    return 'image/png';
  }
  if (source.includes('webp') || source.endsWith('.webp')) {
    return 'image/webp';
  }
  return null;
}

export function InquiryAttachmentPicker({
  value,
  onChange,
  disabled = false,
}: InquiryAttachmentPickerProps) {
  const isDark = useThemeStore((state) => state.isDarkMode);
  const addToast = useToastStore((state) => state.addToast);
  const remaining = INQUIRY_ATTACHMENT_LIMITS.MAX_COUNT - value.length;
  const canAdd = !disabled && remaining > 0;

  const handlePickImages = useCallback(async () => {
    if (!canAdd) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      addToast({
        type: 'error',
        message: '사진 접근 권한이 필요해요. 설정에서 허용해주세요.',
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return;
    }

    const accepted: LocalInquiryAttachment[] = [];
    const rejections: string[] = [];

    for (const asset of result.assets) {
      const mime = mimeFromExt(asset.fileName ?? undefined, asset.mimeType ?? undefined);
      if (!mime) {
        rejections.push(`${asset.fileName ?? '이미지'}: JPG / PNG / WEBP만 허용됩니다.`);
        continue;
      }
      const size = asset.fileSize ?? 0;
      if (size <= 0 || size > INQUIRY_ATTACHMENT_LIMITS.MAX_SIZE_BYTES) {
        rejections.push(`${asset.fileName ?? '이미지'}: 5MB 이하만 첨부 가능합니다.`);
        continue;
      }
      accepted.push({
        uri: asset.uri,
        mime,
        size,
        fileName: asset.fileName ?? undefined,
        width: asset.width,
        height: asset.height,
      });
    }

    if (accepted.length === 0) {
      addToast({
        type: 'error',
        message: rejections[0] ?? '첨부할 수 있는 이미지가 없어요.',
      });
      return;
    }

    if (rejections.length > 0) {
      addToast({
        type: 'warning',
        message: rejections[0] ?? '일부 이미지는 첨부할 수 없어요.',
      });
    }

    const next = [...value, ...accepted].slice(0, INQUIRY_ATTACHMENT_LIMITS.MAX_COUNT);
    onChange(next);
    logger.info('inquiry.attachment.selected', {
      component: COMPONENT,
      accepted: accepted.length,
      rejected: rejections.length,
      total: next.length,
    });
  }, [addToast, canAdd, onChange, remaining, value]);

  const handleRemove = useCallback(
    (index: number) => {
      if (disabled) return;
      void triggerHaptic('light').catch((err) => {
        logger.debug?.('inquiry.attachment.haptic.fail', { component: COMPONENT, err });
      });
      const next = value.filter((_, i) => i !== index);
      onChange(next);
    },
    [disabled, onChange, value]
  );

  const handleRemoveWithConfirm = useCallback(
    (index: number) => {
      if (disabled) return;
      Alert.alert('이미지 삭제', '이 이미지를 첨부에서 제거할까요?', [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: () => handleRemove(index) },
      ]);
    },
    [disabled, handleRemove]
  );

  return (
    <View>
      {/* 추가 버튼 */}
      <Pressable
        onPress={handlePickImages}
        disabled={!canAdd}
        accessibilityRole="button"
        accessibilityLabel={`이미지 추가 ${value.length}/${INQUIRY_ATTACHMENT_LIMITS.MAX_COUNT}`}
        accessibilityState={{ disabled: !canAdd }}
        className={`flex-row items-center justify-center rounded-lg border border-dashed px-4 py-3 ${
          canAdd
            ? 'border-secondary-300 dark:border-surface-overlay'
            : 'border-secondary-200 dark:border-surface-overlay opacity-60'
        }`}
        style={{ minHeight: 44 }}
      >
        <PlusIcon size={18} color={isDark ? SECONDARY_PALETTE[400] : SECONDARY_PALETTE[500]} />
        <Text className="ml-2 text-sm font-sans-medium text-content-secondary">
          이미지 추가 ({value.length}/{INQUIRY_ATTACHMENT_LIMITS.MAX_COUNT})
        </Text>
      </Pressable>

      {/* 프리뷰 썸네일 */}
      {value.length > 0 && (
        <View className="mt-3 flex-row flex-wrap gap-2">
          {value.map((file, index) => (
            <View
              key={`${file.uri}-${index}`}
              className="relative h-20 w-20 overflow-hidden rounded-lg bg-surface-overlay dark:bg-surface-elevated"
            >
              <Image
                source={{ uri: file.uri }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                transition={200}
                accessibilityLabel={file.fileName ?? `첨부 이미지 ${index + 1}`}
              />
              <Pressable
                onPress={() => handleRemoveWithConfirm(index)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`${index + 1}번째 이미지 삭제`}
                disabled={disabled}
                className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-sm bg-surface-backdrop/80"
              >
                <XIcon size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* 안내 문구 */}
      <Text className="mt-2 text-xs text-content-placeholder font-sans">
        이미지 최대 {INQUIRY_ATTACHMENT_LIMITS.MAX_COUNT}장, 장당 5MB 이하 (JPG/PNG/WEBP)
      </Text>
    </View>
  );
}

export default InquiryAttachmentPicker;
