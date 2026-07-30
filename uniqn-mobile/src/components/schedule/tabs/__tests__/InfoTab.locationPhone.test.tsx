/**
 * InfoTab — 장소·길찾기·연락처 표기 회귀 테스트.
 *
 * 실사고 2건을 고정한다:
 *  1. 저장된 E.164 번호(`+8210…`)가 3-4-4 로 잘려 '821-0980-0903' 처럼 보였다.
 *  2. 주소가 없는 공고에서 길찾기가 장소명('홈')으로 검색돼 엉뚱한 곳을 안내했다.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { InfoTab } from '../InfoTab';
import type { ScheduleEvent } from '@/types';

const mockOpenMapSearch = jest.fn().mockResolvedValue(true);

jest.mock('@/utils/mapLink', () => ({
  ...jest.requireActual<typeof import('@/utils/mapLink')>('@/utils/mapLink'),
  openMapSearch: (...args: unknown[]) => mockOpenMapSearch(...args),
}));

jest.mock('@/stores/toastStore', () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn() }),
}));

function makeSchedule(overrides: Partial<ScheduleEvent> = {}): ScheduleEvent {
  return {
    id: 'schedule-1',
    type: 'confirmed',
    date: '2026-08-01',
    startTime: null,
    endTime: null,
    jobPostingId: 'posting-1',
    jobPostingName: '홈게임',
    location: '홈',
    role: 'dealer',
    status: 'not_started',
    sourceCollection: 'workLogs',
    sourceId: 'worklog-1',
    ...overrides,
  } as ScheduleEvent;
}

describe('InfoTab — 연락처 표기', () => {
  it('E.164 로 저장된 번호를 로컬 표기로 보여준다', () => {
    const { getByText, queryByText } = render(
      <InfoTab schedule={makeSchedule({ ownerPhone: '+821012345678' })} />
    );

    expect(getByText('010-1234-5678')).toBeTruthy();
    expect(queryByText('821-0101-2345')).toBeNull();
  });

  it('로컬 형식으로 입력된 번호도 하이픈 표기를 유지한다', () => {
    const { getByText } = render(
      <InfoTab schedule={makeSchedule({ ownerPhone: '01012345678' })} />
    );

    expect(getByText('010-1234-5678')).toBeTruthy();
  });
});

describe('InfoTab — 길찾기', () => {
  beforeEach(() => {
    mockOpenMapSearch.mockClear();
  });

  it('주소가 없으면 길찾기 대신 안내 문구를 띄운다', () => {
    const { queryByText, getByText } = render(<InfoTab schedule={makeSchedule()} />);

    expect(queryByText('길찾기')).toBeNull();
    expect(getByText(/주소가 등록되지 않아/)).toBeTruthy();
  });

  it('공고 주소가 있으면 그 주소로 지도를 연다', () => {
    const { getByText } = render(
      <InfoTab schedule={makeSchedule({ locationAddress: '서울 강남구 테헤란로 1' })} />
    );

    fireEvent.press(getByText('길찾기'));

    expect(mockOpenMapSearch).toHaveBeenCalledWith('서울 강남구 테헤란로 1');
  });

  it('상세주소가 있으면 상세주소를 우선한다', () => {
    const { getByText } = render(
      <InfoTab
        schedule={makeSchedule({
          locationAddress: '강남구',
          detailedAddress: '서울 강남구 테헤란로 1, 3층',
        })}
      />
    );

    fireEvent.press(getByText('길찾기'));

    expect(mockOpenMapSearch).toHaveBeenCalledWith('서울 강남구 테헤란로 1, 3층');
  });

  it('상세주소가 없으면 공고 주소를 장소 아래에 대신 보여준다', () => {
    const { getByText } = render(
      <InfoTab schedule={makeSchedule({ locationAddress: '서울 강남구 역삼동 123-4' })} />
    );

    expect(getByText('서울 강남구 역삼동 123-4')).toBeTruthy();
  });
});
