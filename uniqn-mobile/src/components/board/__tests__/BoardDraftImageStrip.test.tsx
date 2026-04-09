import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { BoardDraftImageStrip } from '../BoardDraftImageStrip';

jest.mock('expo-image', () => {
  const ReactNative = jest.requireActual('react-native') as typeof import('react-native');

  return {
    Image: ({ children }: { children?: React.ReactNode }) => (
      <ReactNative.View>{children}</ReactNative.View>
    ),
  };
});

describe('BoardDraftImageStrip', () => {
  const images = [
    { id: 'image-1', url: 'https://example.com/1.png', storagePath: 'board/1.png', order: 0 },
    { id: 'image-2', url: 'https://example.com/2.png', storagePath: 'board/2.png', order: 1 },
  ];

  it('exposes accessible remove buttons for selected images', () => {
    const onRemoveImage = jest.fn();
    const { getByRole } = render(
      <BoardDraftImageStrip images={images} onRemoveImage={onRemoveImage} />
    );

    const firstRemoveButton = getByRole('button', { name: '1번째 첨부 이미지 삭제' });
    const secondRemoveButton = getByRole('button', { name: '2번째 첨부 이미지 삭제' });

    expect(firstRemoveButton.props.accessibilityHint).toBe(
      '총 2장 중 1번째 이미지입니다. 탭하면 업로드할 이미지 목록에서 제거됩니다'
    );
    expect(secondRemoveButton.props.accessibilityHint).toBe(
      '총 2장 중 2번째 이미지입니다. 탭하면 업로드할 이미지 목록에서 제거됩니다'
    );

    fireEvent.press(secondRemoveButton);

    expect(onRemoveImage).toHaveBeenCalledWith('image-2');
  });

  it('renders nothing when no draft images are selected', () => {
    const { queryByRole } = render(<BoardDraftImageStrip images={[]} onRemoveImage={jest.fn()} />);

    expect(queryByRole('button', { name: '첨부 이미지 삭제' })).toBeNull();
  });
});
