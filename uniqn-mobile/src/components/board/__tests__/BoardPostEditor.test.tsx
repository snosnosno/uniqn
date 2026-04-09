import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { BoardPostEditor } from '../BoardPostEditor';

jest.mock('react-native-keyboard-aware-scroll-view', () => {
  const ReactNative = jest.requireActual('react-native') as typeof import('react-native');

  return {
    KeyboardAwareScrollView: ({ children }: { children: React.ReactNode }) => (
      <ReactNative.ScrollView testID="keyboard-aware-scroll-view">
        {children}
      </ReactNative.ScrollView>
    ),
  };
});

jest.mock('@/hooks/useBoardImages', () => ({
  useBoardImages: () => ({
    images: [],
    uploadingIndex: null,
    uploadProgress: 0,
    isUploading: false,
    handleAddImages: jest.fn(),
    handleRemoveImage: jest.fn(),
  }),
}));

jest.mock('../BoardImagePicker', () => ({
  BoardImagePicker: () => {
    const ReactNative = jest.requireActual('react-native') as typeof import('react-native');

    return <ReactNative.View testID="board-image-picker" />;
  },
}));

jest.mock('@/components/ui', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const ReactNative = jest.requireActual('react-native') as typeof import('react-native');

  return {
    Badge: ({ children }: { children: React.ReactNode }) => (
      <ReactNative.Text>{children}</ReactNative.Text>
    ),
    Card: ({ children }: { children: React.ReactNode }) => (
      <ReactNative.View>{children}</ReactNative.View>
    ),
    Input: React.forwardRef(
      (
        {
          label,
          value,
          onChangeText,
          placeholder,
        }: {
          label?: string;
          value?: string;
          onChangeText?: (value: string) => void;
          placeholder?: string;
        },
        ref: React.Ref<any>
      ) => (
        <ReactNative.TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
        />
      )
    ),
    Button: ({
      children,
      onPress,
      disabled,
    }: {
      children: React.ReactNode;
      onPress?: () => void;
      disabled?: boolean;
    }) => (
      <ReactNative.Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: Boolean(disabled) }}
        disabled={disabled}
        onPress={onPress}
      >
        <ReactNative.Text>{children}</ReactNative.Text>
      </ReactNative.Pressable>
    ),
  };
});

describe('BoardPostEditor', () => {
  it('renders inside a keyboard-aware scroll view', () => {
    const { getByTestId } = render(
      <BoardPostEditor boardType="free" mode="create" onCancel={jest.fn()} onSubmit={jest.fn()} />
    );

    expect(getByTestId('keyboard-aware-scroll-view')).toBeTruthy();
  });

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
