/**
 * S3 — RoleChangeModal 마감 역할 표시 회귀 테스트.
 *
 * @description filledByRole 주입 시 마감(remaining 0) 역할이 비활성+"(마감)"으로 표기되고,
 * 지원자의 현재 역할은 마감이어도 "(마감)" 처리되지 않음을 고정한다. 미주입 시 기존 동작 보존.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { RoleChangeModal } from '../RoleChangeModal';
import { getRoleDisplayName } from '@/types/unified';
import type { ConfirmedStaff, JobPosting } from '@/types';

const mockUseThemeStore = jest.fn();

jest.mock('@/stores/themeStore', () => ({
  useThemeStore: (selector?: (state: { isDarkMode: boolean }) => unknown) =>
    mockUseThemeStore(selector),
}));

// Modal 셸(RNModal/SafeAreaView/애니메이션)은 본 테스트 대상이 아니므로 passthrough 로 대체.
jest.mock('@/components/ui/Modal', () => ({
  Modal: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? children : null,
}));

function createDatedPosting(): JobPosting {
  return {
    id: 'job-1',
    schemaVersion: 3,
    title: '역할 변경 마감 표시 테스트',
    status: 'active',
    ownerId: 'owner-1',
    ownerName: 'Owner',
    workDate: '2026-07-20',
    workDates: ['2026-07-20'],
    totalPositions: 3,
    filledPositions: 0,
    location: {
      name: 'Seoul',
      district: 'Gangnam',
      detailedAddress: '101',
    },
    schedule: {
      kind: 'dated',
      primaryDate: '2026-07-20',
      allDates: ['2026-07-20'],
      requirements: [
        {
          date: '2026-07-20',
          timeSlots: [
            {
              id: 'slot-1',
              startTime: '14:00',
              roles: [
                { id: 'dealer-1', role: 'dealer', count: 2 },
                { id: 'floor-1', role: 'floor', count: 1 },
              ],
            },
          ],
        },
      ],
    },
    roleCatalog: [
      { role: 'dealer', salary: { type: 'hourly', amount: 12000 } },
      { role: 'floor', salary: { type: 'daily', amount: 150000 } },
    ],
    compensation: {
      mode: 'shared',
      defaultSalary: { type: 'hourly', amount: 12000 },
    },
    questions: { items: [] },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as JobPosting;
}

function createStaff(role: string): ConfirmedStaff {
  return {
    id: 'worklog-1',
    staffId: 'staff-1',
    staffName: '김스태프',
    role,
    date: '2026-07-20',
    status: 'scheduled',
    timeSlot: '14:00',
    isRead: true,
  };
}

const dealerLabel = getRoleDisplayName('dealer');
const floorLabel = getRoleDisplayName('floor');

describe('RoleChangeModal 마감 역할 표시', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseThemeStore.mockImplementation(
      (selector?: (state: { isDarkMode: boolean }) => unknown) => {
        const state = { isDarkMode: false };
        return typeof selector === 'function' ? selector(state) : state;
      }
    );
  });

  it('filledByRole로 마감된 역할을 비활성+"(마감)"으로 표기한다', () => {
    render(
      <RoleChangeModal
        visible
        onClose={jest.fn()}
        staff={createStaff('floor')}
        jobPosting={createDatedPosting()}
        availableRoles={['dealer', 'floor']}
        filledByRole={{ dealer: 2 }}
        onSave={jest.fn()}
      />
    );

    // 마감 배지 노출
    expect(screen.getByText('마감')).toBeTruthy();

    // 마감 역할(dealer)은 접근성 라벨에 "(마감)" + disabled
    const dealerOption = screen.getByLabelText(`${dealerLabel} (마감)`);
    expect(dealerOption.props.accessibilityState.disabled).toBe(true);
  });

  it('지원자의 현재 역할은 마감이어도 "(마감)"으로 표기되지 않는다', () => {
    // dealer가 마감이지만 현재 역할이 dealer → 현재 역할 예외 유지
    render(
      <RoleChangeModal
        visible
        onClose={jest.fn()}
        staff={createStaff('dealer')}
        jobPosting={createDatedPosting()}
        availableRoles={['dealer', 'floor']}
        filledByRole={{ dealer: 2 }}
        onSave={jest.fn()}
      />
    );

    // 현재 역할(dealer)은 "(현재 역할)" 라벨, "(마감)" 아님
    expect(screen.getByLabelText(`${dealerLabel} (현재 역할)`)).toBeTruthy();
    expect(screen.queryByLabelText(`${dealerLabel} (마감)`)).toBeNull();
    // floor는 여유 → 마감 배지 없음
    expect(screen.queryByText('마감')).toBeNull();
  });

  it('custom 역할(role=other+customRole) 스태프도 현재 역할 예외가 유지된다', () => {
    // 목록 키는 raw customRole('바텐더'), 스태프는 role='other'+customRole 분리 저장 —
    // 정규화 비교 없이는 정원이 찬 본인 역할이 "(마감)" 으로 오표기된다.
    const posting = {
      ...createDatedPosting(),
      schedule: {
        kind: 'dated',
        primaryDate: '2026-07-20',
        allDates: ['2026-07-20'],
        requirements: [
          {
            date: '2026-07-20',
            timeSlots: [
              {
                id: 'slot-1',
                startTime: '14:00',
                roles: [
                  { id: 'dealer-1', role: 'dealer', count: 2 },
                  { id: 'custom-1', role: 'other', customRole: '바텐더', count: 1 },
                ],
              },
            ],
          },
        ],
      },
    } as JobPosting;
    const customLabel = getRoleDisplayName('바텐더');

    render(
      <RoleChangeModal
        visible
        onClose={jest.fn()}
        staff={{ ...createStaff('other'), customRole: '바텐더' }}
        jobPosting={posting}
        availableRoles={['dealer', '바텐더']}
        filledByRole={{ 'other:바텐더': 1 }}
        onSave={jest.fn()}
      />
    );

    // 본인 현재 역할(바텐더)은 정원이 찼어도 "(현재 역할)" — "(마감)" 아님
    expect(screen.getByLabelText(`${customLabel} (현재 역할)`)).toBeTruthy();
    expect(screen.queryByLabelText(`${customLabel} (마감)`)).toBeNull();
    // dealer 는 여유(0/2) → 마감 배지 자체가 없음
    expect(screen.queryByText('마감')).toBeNull();
  });

  it('filledByRole 미주입 시 마감 표기가 없다(기존 동작 보존)', () => {
    render(
      <RoleChangeModal
        visible
        onClose={jest.fn()}
        staff={createStaff('floor')}
        jobPosting={createDatedPosting()}
        availableRoles={['dealer', 'floor']}
        onSave={jest.fn()}
      />
    );

    expect(screen.queryByText('마감')).toBeNull();
    expect(screen.getByLabelText(dealerLabel)).toBeTruthy();
    expect(screen.getByLabelText(`${floorLabel} (현재 역할)`)).toBeTruthy();
  });
});
