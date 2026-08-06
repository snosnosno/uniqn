/**
 * ConfirmedStaffCard — 액션 줄 렌더 규칙
 *
 * 고정하는 계약 셋:
 *  1. 🔴 `allowDeleteAnyStatus` 는 **근무표 전용 탈출구**다. 근무표에는 상태 되돌리기가 없고
 *     컨테이너 직속 배치는 스태프관리 탭조차 없어서, 근태 상태로 빼기를 막으면 QR 오인식
 *     한 번에 제거 경로가 앱 전체에서 0이 된다.
 *  2. 🔴 기본값은 **그대로 좁다**. 스태프관리는 되돌리기라는 안전한 경로가 있으므로 넓히지 않는다
 *     — 이 단언이 없으면 1번을 고치다 두 화면을 함께 넓혀도 아무도 모른다.
 *  3. 그려질 액션이 하나도 없으면 액션 줄(구분선) 자체를 렌더하지 않는다.
 *
 * ⚠️ `accessibilityState` 는 react-native-web 에서 무효라 판정에 쓰지 않는다.
 */
import { render, screen } from '@testing-library/react-native';
import React from 'react';

import type { ConfirmedStaff } from '@/types';

import { ConfirmedStaffCard } from '../ConfirmedStaffCard';

jest.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: () => ({
    displayName: '김딜러',
    profilePhotoURL: undefined,
    profilePhotoURLBlurhash: null,
  }),
}));

jest.mock('@/stores/themeStore', () => ({
  useThemeStore: () => ({ isDarkMode: false }),
}));

const BASE_STAFF = {
  id: 'wl-1',
  staffId: 'staff-1',
  staffName: '김딜러',
  role: 'dealer',
  date: '2026-07-05',
  status: 'scheduled',
  timeSlot: '19:00',
} as unknown as ConfirmedStaff;

function renderCard(
  staffOverrides: Partial<ConfirmedStaff> = {},
  props: Partial<React.ComponentProps<typeof ConfirmedStaffCard>> = {}
) {
  return render(
    <ConfirmedStaffCard staff={{ ...BASE_STAFF, ...staffOverrides }} showActions {...props} />
  );
}

describe('ConfirmedStaffCard — 빼기 게이트', () => {
  it('🔴 allowDeleteAnyStatus 면 출근한 인원도 뺄 수 있다(근무표 경로)', () => {
    renderCard({ status: 'checked_in' }, { onDelete: jest.fn(), allowDeleteAnyStatus: true });

    expect(screen.getByTestId('card-delete-action')).toBeTruthy();
  });

  it('🔴 allowDeleteAnyStatus 면 노쇼 행도 뺄 수 있다', () => {
    renderCard(
      { status: 'no_show', isNoShow: true },
      { onDelete: jest.fn(), allowDeleteAnyStatus: true }
    );

    expect(screen.getByTestId('card-delete-action')).toBeTruthy();
  });

  it('🔴 기본값은 좁다 — 출근한 인원은 빼기가 안 보인다(스태프관리 규칙 보존)', () => {
    renderCard({ status: 'checked_in' }, { onDelete: jest.fn() });

    expect(screen.queryByTestId('card-delete-action')).toBeNull();
  });

  it('출근 예정 행은 기본값에서도 뺄 수 있다', () => {
    renderCard({ status: 'scheduled' }, { onDelete: jest.fn() });

    expect(screen.getByTestId('card-delete-action')).toBeTruthy();
  });
});

describe('ConfirmedStaffCard — 빈 액션 줄', () => {
  it('그려질 액션이 없으면 액션 줄(구분선)을 렌더하지 않는다', () => {
    // 콜백은 빼기 하나뿐인데 상태 게이트가 막는 조합 — 예전엔 자식 0개의 구분선만 남았다.
    renderCard({ status: 'checked_in' }, { onDelete: jest.fn() });

    expect(screen.queryByTestId('card-actions')).toBeNull();
  });

  it('대조군 — 그려질 액션이 하나라도 있으면 액션 줄이 산다', () => {
    renderCard({ status: 'checked_in' }, { onDelete: jest.fn(), allowDeleteAnyStatus: true });

    expect(screen.getByTestId('card-actions')).toBeTruthy();
  });
});
