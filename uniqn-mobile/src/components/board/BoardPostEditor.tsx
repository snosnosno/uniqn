import React from 'react';
import { Platform, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BoardImagePicker } from './BoardImagePicker';
import {
  Badge,
  Button,
  Card,
  Input,
  Skeleton,
  SkeletonButton,
  SkeletonText,
} from '@/components/ui';
import { LAYOUT } from '@/constants';
import { BOARD_TYPE_LABELS, type BoardImageAttachment, type BoardType } from '@/types/board';
import { useBoardImages } from '@/hooks/useBoardImages';

interface BoardPostEditorProps {
  boardType: Extract<BoardType, 'free' | 'tda'>;
  mode: 'create' | 'edit';
  initialTitle?: string;
  initialBody?: string;
  initialImages?: BoardImageAttachment[];
  isSubmitting?: boolean;
  onCancel: () => void;
  onSubmit: (input: {
    title: string;
    body: string;
    imageAttachments: BoardImageAttachment[];
  }) => Promise<void> | void;
}

export function BoardPostEditor({
  boardType,
  mode,
  initialTitle = '',
  initialBody = '',
  initialImages = [],
  isSubmitting = false,
  onCancel,
  onSubmit,
}: BoardPostEditorProps) {
  const insets = useSafeAreaInsets();
  const {
    images,
    uploadingIndex,
    uploadProgress,
    isUploading,
    handleAddImages,
    handleRemoveImage,
  } = useBoardImages({
    initialImages,
  });
  const [title, setTitle] = React.useState(initialTitle);
  const [body, setBody] = React.useState(initialBody);
  const isSubmitDisabled = isSubmitting || isUploading || !title.trim() || !body.trim();
  const bottomPadding = LAYOUT.TAB_BAR_HEIGHT + insets.bottom + 32;

  const handleSubmit = async () => {
    try {
      await onSubmit({
        title: title.trim(),
        body: body.trim(),
        imageAttachments: images,
      });
    } catch {
      // Mutation hooks already show user-facing toast feedback.
    }
  };

  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-secondary-50 dark:bg-surface-dark"
      contentContainerStyle={{ paddingBottom: bottomPadding }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      enableOnAndroid
      enableAutomaticScroll
      extraScrollHeight={Platform.OS === 'ios' ? 20 : 100}
      keyboardOpeningTime={0}
    >
      <View className="p-4">
        <Card className="mb-4">
          <View className="mb-3 flex-row items-center gap-2">
            <Badge variant={boardType === 'tda' ? 'warning' : 'primary'} size="sm">
              {BOARD_TYPE_LABELS[boardType]}
            </Badge>
            <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
              {mode === 'create' ? '새 글 작성' : '글 수정'}
            </Text>
          </View>

          <Input
            label="제목"
            value={title}
            onChangeText={setTitle}
            maxLength={120}
            placeholder="제목을 입력해 주세요."
          />

          <View className="mt-4">
            <Input
              label="내용"
              value={body}
              onChangeText={setBody}
              placeholder="내용을 입력해 주세요."
              multiline
              textAlignVertical="top"
              numberOfLines={8}
              maxLength={5000}
            />
          </View>
        </Card>

        <Card className="mb-4">
          <Text className="mb-3 text-base font-sans-semibold text-secondary-900 dark:text-secondary-100">
            이미지 첨부
          </Text>
          <BoardImagePicker
            images={images}
            uploadingIndex={uploadingIndex}
            uploadProgress={uploadProgress}
            onAddImages={handleAddImages}
            onRemoveImage={handleRemoveImage}
            disabled={isSubmitting || isUploading}
          />
        </Card>

        <View className="flex-row gap-3">
          <Button variant="outline" fullWidth className="flex-1" onPress={onCancel}>
            취소
          </Button>
          <Button
            fullWidth
            className="flex-1"
            loading={isSubmitting}
            disabled={isSubmitDisabled}
            onPress={() => void handleSubmit()}
          >
            {mode === 'create' ? '등록하기' : '수정하기'}
          </Button>
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
}

export default BoardPostEditor;

interface BoardPostEditorLoadingProps {
  title?: string;
}

export function BoardPostEditorLoading({
  title = '게시글 편집 화면을 준비하는 중이에요.',
}: BoardPostEditorLoadingProps) {
  const insets = useSafeAreaInsets();
  const bottomPadding = LAYOUT.TAB_BAR_HEIGHT + insets.bottom + 32;

  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-secondary-50 dark:bg-surface-dark"
      contentContainerStyle={{ paddingBottom: bottomPadding }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      enableOnAndroid
      enableAutomaticScroll
      extraScrollHeight={Platform.OS === 'ios' ? 20 : 100}
      keyboardOpeningTime={0}
    >
      <View className="p-4">
        <Card className="mb-4">
          <View className="mb-3 flex-row items-center gap-2">
            <Skeleton width={72} height={28} borderRadius={14} />
            <Skeleton width={84} height={16} />
          </View>

          <Skeleton width={56} height={14} className="mb-2" />
          <Skeleton width="100%" height={48} borderRadius={12} />

          <View className="mt-4">
            <Skeleton width={56} height={14} className="mb-2" />
            <Skeleton width="100%" height={180} borderRadius={16} />
          </View>

          <Text className="mt-4 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
            {title}
          </Text>
        </Card>

        <Card className="mb-4">
          <Skeleton width={96} height={20} className="mb-3" />
          <View className="rounded-lg border border-dashed border-secondary-200 p-5 dark:border-surface-overlay">
            <Skeleton width={52} height={52} borderRadius={26} className="mb-3" />
            <SkeletonText lines={2} lineHeight={14} lastLineWidth="55%" />
          </View>
        </Card>

        <View className="flex-row gap-3">
          <SkeletonButton width="48%" />
          <SkeletonButton width="48%" />
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
}
