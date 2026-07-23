/**
 * WebSheetModal — 연쇄 진입 시 시트 제목 포커스 이동 (a11y C2, 웹 전용)
 *
 * jest 환경엔 DOM 이 없어 실제 focus() 대신 focusIfPossible 헬퍼 호출을 관찰한다
 * (헬퍼 자체의 focus 계약은 focusNode.test.ts 가 지킨다).
 * 네이티브는 RNModal 재마운트가 VoiceOver 포커스를 부분 자동 이동하므로 범위 밖.
 */
import { render, act } from '@testing-library/react-native';
import { Text } from 'react-native';
import React from 'react';
import { SheetModal } from '@/components/ui/SheetModal';
import { SheetChainContext } from '@/components/ui/SheetChainContext';
import * as focusNode from '@/utils/focusNode';

jest.mock('@/utils/platform', () => ({
  ...jest.requireActual('@/utils/platform'),
  isWeb: true,
}));

/** WebSheetModal 의 rAF 예약(이중 rAF)을 전부 소진한다 — jest 의 rAF 는 타이머 심 */
const flushRafs = async () => {
  await act(async () => {
    jest.runOnlyPendingTimers();
    jest.runOnlyPendingTimers();
    await Promise.resolve();
  });
};

describe('WebSheetModal — 연쇄 진입 포커스 이동 (a11y C2)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('연쇄 진입이면 시트 제목 노드로 포커스를 옮긴다', async () => {
    const spy = jest.spyOn(focusNode, 'focusIfPossible');
    const onEntered = jest.fn();
    render(
      <SheetChainContext.Provider value={{ entering: true, onEntered }}>
        <SheetModal visible title="장소" onClose={jest.fn()}>
          <Text>내용</Text>
        </SheetModal>
      </SheetChainContext.Provider>
    );

    await flushRafs();

    // 전제 고정 — 연쇄 진입 계약(onEntered)이 실제로 작동했음을 먼저 단언(공허 통과 차단)
    expect(onEntered).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toBeTruthy();
  });

  it('대조군: 연쇄가 아닌 일반 오픈은 포커스를 옮기지 않는다', async () => {
    const spy = jest.spyOn(focusNode, 'focusIfPossible');
    render(
      <SheetModal visible title="장소" onClose={jest.fn()}>
        <Text>내용</Text>
      </SheetModal>
    );

    await flushRafs();

    expect(spy).not.toHaveBeenCalled();
  });
});
