import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { BoardImageGrid, getBoardImageLayoutVariant } from '../BoardImageGrid';

jest.mock('expo-image', () => {
  const ReactNative = jest.requireActual('react-native') as typeof import('react-native');

  return {
    Image: ({ children }: { children?: React.ReactNode }) => (
      <ReactNative.View>{children}</ReactNative.View>
    ),
  };
});

describe('BoardImageGrid', () => {
  const images = [
    { id: 'image-1', url: 'https://example.com/1.png', storagePath: 'board/1.png', order: 0 },
    { id: 'image-2', url: 'https://example.com/2.png', storagePath: 'board/2.png', order: 1 },
    { id: 'image-3', url: 'https://example.com/3.png', storagePath: 'board/3.png', order: 2 },
  ];

  it('returns the expected layout variant for each image count', () => {
    expect(getBoardImageLayoutVariant(1)).toBe('single');
    expect(getBoardImageLayoutVariant(2)).toBe('double');
    expect(getBoardImageLayoutVariant(3)).toBe('grid');
    expect(getBoardImageLayoutVariant(6)).toBe('grid');
  });

  it('exposes accessible buttons when image press is enabled', () => {
    const onPressImage = jest.fn();
    const { getByRole } = render(
      <BoardImageGrid images={images.slice(0, 2)} onPressImage={onPressImage} />
    );

    const firstThumbnail = getByRole('button', { name: '1번째 이미지 보기' });
    const secondThumbnail = getByRole('button', { name: '2번째 이미지 보기' });

    expect(firstThumbnail.props.accessibilityHint).toBe(
      '총 2장 중 1번째 이미지입니다. 누르면 전체 화면 이미지 뷰어가 열립니다.'
    );
    expect(secondThumbnail.props.accessibilityHint).toBe(
      '총 2장 중 2번째 이미지입니다. 누르면 전체 화면 이미지 뷰어가 열립니다.'
    );

    fireEvent.press(secondThumbnail);

    expect(onPressImage).toHaveBeenCalledWith(1);
  });

  it('does not expose button semantics when image press is disabled', () => {
    const { queryByRole } = render(<BoardImageGrid images={images.slice(0, 2)} />);

    expect(queryByRole('button', { name: '1번째 이미지 보기' })).toBeNull();
    expect(queryByRole('button', { name: '2번째 이미지 보기' })).toBeNull();
  });
});
