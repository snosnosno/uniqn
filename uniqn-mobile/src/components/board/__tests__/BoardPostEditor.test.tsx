import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { BoardPostEditor } from '../BoardPostEditor';

jest.mock('@/hooks/useAnnouncementImages', () => ({
  useAnnouncementImages: () => ({
    images: [],
    uploadingIndex: null,
    uploadProgress: 0,
    isUploading: false,
    handleAddImages: jest.fn(),
    handleRemoveImage: jest.fn(),
    handleReorderImages: jest.fn(),
  }),
}));

jest.mock('@/components/admin/announcements', () => ({
  AnnouncementImagePicker: () => {
    const ReactNative = jest.requireActual('react-native') as typeof import('react-native');

    return <ReactNative.View testID="announcement-image-picker" />;
  },
}));

jest.mock('@/components/ui', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => {
    const ReactNative = jest.requireActual('react-native') as typeof import('react-native');

    return <ReactNative.Text>{children}</ReactNative.Text>;
  },
  Card: ({ children }: { children: React.ReactNode }) => {
    const ReactNative = jest.requireActual('react-native') as typeof import('react-native');

    return <ReactNative.View>{children}</ReactNative.View>;
  },
  Input: ({
    label,
    value,
    onChangeText,
    placeholder,
  }: {
    label?: string;
    value?: string;
    onChangeText?: (value: string) => void;
    placeholder?: string;
  }) => {
    const ReactNative = jest.requireActual('react-native') as typeof import('react-native');

    return (
      <ReactNative.TextInput
        accessibilityLabel={label}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
      />
    );
  },
  Button: ({
    children,
    onPress,
    disabled,
  }: {
    children: React.ReactNode;
    onPress?: () => void;
    disabled?: boolean;
  }) => {
    const ReactNative = jest.requireActual('react-native') as typeof import('react-native');

    return (
      <ReactNative.Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: Boolean(disabled) }}
        disabled={disabled}
        onPress={onPress}
      >
        <ReactNative.Text>{children}</ReactNative.Text>
      </ReactNative.Pressable>
    );
  },
}));

describe('BoardPostEditor', () => {
  it('disables submit while required fields are blank', () => {
    const { getByRole } = render(
      <BoardPostEditor boardType="free" mode="create" onCancel={jest.fn()} onSubmit={jest.fn()} />
    );

    expect(getByRole('button', { name: '등록하기' }).props.accessibilityState.disabled).toBe(true);
  });

  it('trims title and body before submitting', async () => {
    const onSubmit = jest.fn();
    const { getByLabelText, getByRole } = render(
      <BoardPostEditor boardType="tda" mode="create" onCancel={jest.fn()} onSubmit={onSubmit} />
    );

    fireEvent.changeText(getByLabelText('제목'), '  제목  ');
    fireEvent.changeText(getByLabelText('내용'), '  본문  ');
    fireEvent.press(getByRole('button', { name: '등록하기' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        title: '제목',
        body: '본문',
        imageAttachments: [],
      });
    });
  });
});
