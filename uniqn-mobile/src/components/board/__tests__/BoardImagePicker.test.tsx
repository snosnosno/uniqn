import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { BoardImagePicker, getBoardImagePickerTileSize } from '../BoardImagePicker';

jest.mock('expo-image', () => {
  const ReactNative = jest.requireActual('react-native') as typeof import('react-native');

  return {
    Image: () => <ReactNative.View />,
  };
});

describe('BoardImagePicker', () => {
  const images = [
    { id: 'image-1', url: 'https://example.com/1.png', storagePath: 'board/1.png', order: 0 },
  ];

  it('derives tile size from the measured container width and clamps extremes', () => {
    expect(getBoardImagePickerTileSize(328)).toBe(104);
    expect(getBoardImagePickerTileSize(240)).toBe(84);
    expect(getBoardImagePickerTileSize(420)).toBe(120);
  });

  it('shows board-specific copy and add/remove only controls', () => {
    const onAddImages = jest.fn();
    const onRemoveImage = jest.fn();
    const { getByText, getByRole, queryByLabelText } = render(
      <BoardImagePicker
        images={images}
        uploadingIndex={null}
        uploadProgress={0}
        onAddImages={onAddImages}
        onRemoveImage={onRemoveImage}
      />
    );

    expect(getByText('1/10장')).toBeTruthy();
    expect(getByText('커뮤니티 글에 첨부할 이미지를 선택하세요.')).toBeTruthy();
    expect(queryByLabelText('위로 이동')).toBeNull();
    expect(queryByLabelText('아래로 이동')).toBeNull();

    fireEvent.press(getByRole('button', { name: '게시글 이미지 추가' }));
    fireEvent.press(getByRole('button', { name: '첨부 이미지 1 삭제' }));

    expect(onAddImages).toHaveBeenCalledTimes(1);
    expect(onRemoveImage).toHaveBeenCalledWith('image-1');
  });
});
