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

const mockOpenMapDestination = jest.fn().mockResolvedValue(true);

jest.mock('@/utils/mapLink', () => ({
  ...jest.requireActual<typeof import('@/utils/mapLink')>('@/utils/mapLink'),
  openMapDestination: (...args: unknown[]) => mockOpenMapDestination(...args),
}));

// 지도 앱 취향은 MMKV 에 남아 테스트끼리 샌다 — 모듈째 갈아끼워 테스트마다 초기화한다.
let mockStoredMapApp: string | null = null;

jest.mock('@/utils/mapAppPreference', () => ({
  getMapAppPreference: () => mockStoredMapApp,
  setMapAppPreference: (app: string) => {
    mockStoredMapApp = app;
  },
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
    mockOpenMapDestination.mockClear();
    // 이미 고른 앱이 있는 상태를 기본으로 둔다 — 이 스위트가 고정하려는 것은 "무엇을 넘기는가"
    // (주소 합성 규칙·좌표 승격)이지 선택 시트가 아니다. 시트는 아래 별도 스위트에서 다룬다.
    mockStoredMapApp = 'kakao';
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

    expect(mockOpenMapDestination).toHaveBeenCalledWith(
      expect.objectContaining({ query: '서울 강남구 테헤란로 1' }),
      'kakao'
    );
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

    expect(mockOpenMapDestination).toHaveBeenCalledWith(
      expect.objectContaining({ query: '서울 강남구 테헤란로 1, 3층' }),
      'kakao'
    );
  });

  // B2 — 좌표 승격. 좌표를 안 넘기면 길찾기가 텍스트 검색으로 남아 핀이 뭉개진다.
  it('좌표가 있으면 좌표와 장소명 라벨을 함께 넘긴다', () => {
    const { getByText } = render(
      <InfoTab
        schedule={makeSchedule({
          location: '라운더스 홀덤펍',
          locationAddress: '서울 강남구 테헤란로 152',
          coordinates: { lat: 37.5000242, lng: 127.0365086 },
        })}
      />
    );

    fireEvent.press(getByText('길찾기'));

    expect(mockOpenMapDestination).toHaveBeenCalledWith(
      {
        query: '서울 강남구 테헤란로 152',
        coordinates: { lat: 37.5000242, lng: 127.0365086 },
        label: '라운더스 홀덤펍',
      },
      'kakao'
    );
  });

  // 좌표만 있고 주소 텍스트가 없어도 갈 수 있어야 한다 — 게이트가 query 만 보면 버튼이 사라진다.
  it('주소 텍스트가 없어도 좌표가 있으면 길찾기를 노출한다', () => {
    const { getByText } = render(
      <InfoTab schedule={makeSchedule({ coordinates: { lat: 37.5, lng: 127.03 } })} />
    );

    fireEvent.press(getByText('길찾기'));

    expect(mockOpenMapDestination).toHaveBeenCalledWith(
      expect.objectContaining({ query: null, coordinates: { lat: 37.5, lng: 127.03 } }),
      'kakao'
    );
  });

  // 좌표로 게이트를 연 순간 "주소도 장소명도 빈" 조합이 새로 가능해졌다.
  // `??` 로는 빈 문자열이 통과해 스크린리더가 " 길찾기" 를 읽는다.
  it('🔴 주소·장소명이 모두 비어도 접근성 라벨이 비지 않는다', () => {
    const { getByRole } = render(
      <InfoTab schedule={makeSchedule({ location: '', coordinates: { lat: 37.5, lng: 127.03 } })} />
    );

    expect(getByRole('button', { name: '근무지 길찾기' })).toBeTruthy();
  });

  it('상세주소가 없으면 공고 주소를 장소 아래에 대신 보여준다', () => {
    const { getByText } = render(
      <InfoTab schedule={makeSchedule({ locationAddress: '서울 강남구 역삼동 123-4' })} />
    );

    expect(getByText('서울 강남구 역삼동 123-4')).toBeTruthy();
  });
});

/**
 * 지도 앱 선택 — 예전에는 기기 기본 지도로만 갔다. 국내 스태프 대부분은 카카오맵·네이버지도를
 * 쓰는데 기본 지도는 국내 상호 검색이 약해, 열리긴 열려도 어디인지 모르는 상태로 끝났다.
 */
describe('InfoTab — 지도 앱 선택', () => {
  const WITH_ADDRESS = { locationAddress: '서울 강남구 테헤란로 152' };

  beforeEach(() => {
    mockOpenMapDestination.mockClear();
    mockStoredMapApp = null;
  });

  it('고른 앱이 없으면 바로 열지 않고 선택 시트를 띄운다', () => {
    const { getByText } = render(<InfoTab schedule={makeSchedule(WITH_ADDRESS)} />);

    fireEvent.press(getByText('길찾기'));

    expect(mockOpenMapDestination).not.toHaveBeenCalled();
    expect(getByText('어떤 지도로 열까요?')).toBeTruthy();
  });

  it('시트에서 고른 앱으로 열고 그 선택을 기억한다', () => {
    const { getByText } = render(<InfoTab schedule={makeSchedule(WITH_ADDRESS)} />);

    fireEvent.press(getByText('길찾기'));
    fireEvent.press(getByText('네이버지도'));

    expect(mockOpenMapDestination).toHaveBeenCalledWith(expect.anything(), 'naver');
    expect(mockStoredMapApp).toBe('naver');
  });

  // 한 번의 선택이 되돌릴 수 없는 결정이 되면 안 된다 — 바꿀 통로가 화면에 보여야 한다.
  it('고른 앱을 현재 값과 함께 보여주고 다시 고를 수 있게 한다', () => {
    mockStoredMapApp = 'kakao';
    const { getByText, getByRole } = render(<InfoTab schedule={makeSchedule(WITH_ADDRESS)} />);

    expect(getByText('카카오맵 · 변경')).toBeTruthy();

    fireEvent.press(getByRole('button', { name: '길찾기에 사용할 지도 앱 변경 (현재 카카오맵)' }));

    expect(getByText('어떤 지도로 열까요?')).toBeTruthy();
  });
});
