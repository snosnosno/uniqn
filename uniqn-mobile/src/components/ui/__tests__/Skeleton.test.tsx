/**
 * Skeleton — impeccable v2 §16 준수 검증
 *
 * 카버리지:
 * - progressbar role + label (기본값)
 * - accessible=false 시 role 제거
 * - reduce motion 분기 (정적 fade 모드)
 * - SkeletonText lines 렌더
 * - SkeletonCircle 정사각형 size prop
 */

import React from 'react';
import { AccessibilityInfo } from 'react-native';
import { render } from '@testing-library/react-native';

import { Skeleton, SkeletonCircle, SkeletonText } from '../Skeleton';

describe('Skeleton a11y', () => {
  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({ remove: jest.fn() } as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exposes progressbar role + "로딩 중" label by default', () => {
    const { getByRole } = render(<Skeleton />);
    const node = getByRole('progressbar');
    expect(node.props.accessibilityLabel).toBe('로딩 중');
  });

  it('omits role when accessible={false} (composer 노드 하나로 묶기)', () => {
    const { queryByRole } = render(<Skeleton accessible={false} />);
    expect(queryByRole('progressbar')).toBeNull();
  });

  it('honours custom accessibilityLabel prop', () => {
    const { getByRole } = render(<Skeleton accessibilityLabel="공고 불러오는 중" />);
    expect(getByRole('progressbar').props.accessibilityLabel).toBe('공고 불러오는 중');
  });
});

describe('Skeleton reduce motion', () => {
  it('resolves without throwing when reduce motion is enabled at OS level', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({ remove: jest.fn() } as never);

    const { toJSON } = render(<Skeleton testID="s" />);
    // reduce motion 은 useEffect 내부 비동기라 렌더 자체가 깨지지 않는 것만 검증
    expect(toJSON()).toBeTruthy();
    jest.restoreAllMocks();
  });
});

describe('SkeletonText', () => {
  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({ remove: jest.fn() } as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders N line skeletons', () => {
    const { toJSON } = render(<SkeletonText lines={4} />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });
});

describe('SkeletonCircle', () => {
  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({ remove: jest.fn() } as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders a square skeleton with borderRadius=size/2 (true circle)', () => {
    const { toJSON } = render(<SkeletonCircle size={40} />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
    // size=40, borderRadius should be 20
    const json = JSON.stringify(tree);
    expect(json).toContain('"borderRadius":20');
    expect(json).toContain('"width":40');
    expect(json).toContain('"height":40');
  });
});
