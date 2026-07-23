/**
 * OrderSheetChainScrim — 호스트 레벨 연쇄 전환 딤 (B1)
 *
 * OrderSheetScreen 밖(StackHeader·VenueSelectChips 형제)까지 덮는 전체 화면 스크림.
 * 호스트(create/edit)가 onChainSwappingChange 통지를 받아 SafeAreaView 마지막 자식으로 렌더한다.
 */
import { render } from '@testing-library/react-native';
import React from 'react';
import { OrderSheetChainScrim } from '../OrderSheetChainScrim';

describe('OrderSheetChainScrim', () => {
  it('visible 이면 전체 화면 딤을 렌더하고 터치를 막지 않는다(pointerEvents none)', () => {
    const { getByTestId } = render(<OrderSheetChainScrim visible />);
    const scrim = getByTestId('order-sheet-host-chain-scrim');
    expect(scrim.props.pointerEvents).toBe('none');
  });

  it('visible 이 아니면 아무것도 렌더하지 않는다', () => {
    const { queryByTestId } = render(<OrderSheetChainScrim visible={false} />);
    expect(queryByTestId('order-sheet-host-chain-scrim')).toBeNull();
  });
});
