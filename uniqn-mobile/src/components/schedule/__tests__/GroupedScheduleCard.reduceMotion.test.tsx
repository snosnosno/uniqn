import React from 'react';
import { AccessibilityInfo, LayoutAnimation } from 'react-native';
import { act, render, fireEvent } from '@testing-library/react-native';
import { GroupedScheduleCard } from '../GroupedScheduleCard';
import type { GroupedScheduleEvent } from '@/types';

/**
 * 다중일 그룹의 펼침 애니메이션은 OS "동작 줄이기"를 따라야 한다(impeccable v2 §16).
 *
 * 이 카드는 공용 `useReduceMotion` 훅이 애니메이션 브랜치에 있던 동안 로컬 구현을
 * 들고 있었고, 그 구현은 `useState(false)` 로 시작해 RM 사용자에게도 마운트 직후
 * 첫 프레임에 모션이 재생됐다. 공용 훅으로 교체한 뒤에도 **분기 자체가 살아 있는지**를
 * 여기서 고정한다 — 훅 교체는 리팩터링이지 동작 변경이 아니어야 한다.
 */
function createGroup(): GroupedScheduleEvent {
  return {
    id: 'grouped-rm-1',
    type: 'confirmed',
    jobPostingId: 'jp-rm',
    jobPostingName: '3일 대회',
    location: '',
    dateRange: {
      start: '2026-07-27',
      end: '2026-07-29',
      dates: ['2026-07-27', '2026-07-28', '2026-07-29'],
      totalDays: 3,
      isConsecutive: true,
    },
    roles: ['딜러'],
    timeSlot: '18:00 - 23:00',
    dateStatuses: [],
    originalEvents: [],
  } as unknown as GroupedScheduleEvent;
}

/** 훅이 마운트 시 재조회하는 Promise 를 흘려보낸다(모듈 스코프 프리페치 캐시 반영 포함). */
async function flushReduceMotionQuery() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('GroupedScheduleCard — 동작 줄이기(Reduce Motion)', () => {
  let configureNext: jest.SpyInstance;

  beforeEach(() => {
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({ remove: jest.fn() } as never);
    configureNext = jest.spyOn(LayoutAnimation, 'configureNext').mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('동작 줄이기가 켜져 있으면 펼침 애니메이션을 강행하지 않는다', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

    const { getByLabelText } = render(<GroupedScheduleCard group={createGroup()} />);
    await flushReduceMotionQuery();

    fireEvent.press(getByLabelText('날짜별 상세 펼치기'));

    expect(configureNext).not.toHaveBeenCalled();
  });

  it('대조군: 꺼져 있으면 평소대로 애니메이션한다', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);

    const { getByLabelText } = render(<GroupedScheduleCard group={createGroup()} />);
    await flushReduceMotionQuery();

    fireEvent.press(getByLabelText('날짜별 상세 펼치기'));

    expect(configureNext).toHaveBeenCalledTimes(1);
  });
});
