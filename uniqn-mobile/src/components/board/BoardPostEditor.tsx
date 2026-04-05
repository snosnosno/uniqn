import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AnnouncementImagePicker } from '@/components/admin/announcements';
import { Badge, Button, Card, Input } from '@/components/ui';
import { BOARD_TYPE_LABELS, type BoardImageAttachment, type BoardType } from '@/types/board';
import { useAnnouncementImages } from '@/hooks/useAnnouncementImages';

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
  const {
    images,
    uploadingIndex,
    uploadProgress,
    isUploading,
    handleAddImages,
    handleRemoveImage,
    handleReorderImages,
  } = useAnnouncementImages({
    initialImages,
  });
  const [title, setTitle] = React.useState(initialTitle);
  const [body, setBody] = React.useState(initialBody);
  const isSubmitDisabled = isSubmitting || isUploading || !title.trim() || !body.trim();

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
    <ScrollView
      className="flex-1 bg-gray-50 dark:bg-surface-dark"
      contentContainerClassName="p-4 pb-8"
      keyboardShouldPersistTaps="handled"
    >
      <Card className="mb-4">
        <View className="mb-3 flex-row items-center gap-2">
          <Badge variant={boardType === 'tda' ? 'warning' : 'primary'} size="sm">
            {BOARD_TYPE_LABELS[boardType]}
          </Badge>
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            {mode === 'create' ? '새 글 작성' : '글 수정'}
          </Text>
        </View>

        <Input
          label="제목"
          value={title}
          onChangeText={setTitle}
          maxLength={120}
          placeholder="제목을 입력해 주세요"
        />

        <View className="mt-4">
          <Input
            label="내용"
            value={body}
            onChangeText={setBody}
            placeholder="내용을 입력해 주세요"
            multiline
            textAlignVertical="top"
            numberOfLines={8}
            maxLength={5000}
          />
        </View>
      </Card>

      <Card className="mb-4">
        <Text className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">
          이미지 첨부
        </Text>
        <AnnouncementImagePicker
          images={images}
          uploadingIndex={uploadingIndex}
          uploadProgress={uploadProgress}
          onAddImages={handleAddImages}
          onRemoveImage={handleRemoveImage}
          onReorderImages={handleReorderImages}
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
    </ScrollView>
  );
}

export default BoardPostEditor;
