import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ApplicantProfileModal } from '../ApplicantProfileModal';
import { StaffProfileModal } from '../StaffProfileModal';

jest.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: jest.fn(),
}));

jest.mock('../../../ui/SheetModal', () => {
  const React = require('react');
  const { View, Text } = require('react-native');

  return {
    SheetModal: ({ visible, title, children }: any) =>
      visible ? (
        <View>
          <Text>{title}</Text>
          {children}
        </View>
      ) : null,
  };
});

jest.mock('../../../ui/Avatar', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    Avatar: ({ name }: any) => <Text>{name}</Text>,
  };
});

jest.mock('../../../ui/Badge', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    Badge: ({ children }: any) => <Text>{children}</Text>,
  };
});

jest.mock('@/utils/date', () => {
  const actual = jest.requireActual('@/utils/date');

  return {
    ...actual,
    formatRelativeTime: jest.fn(() => '1일 전'),
    formatTime: jest.fn((date: Date) => {
      if (!(date instanceof Date)) {
        return '00:00';
      }

      return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(
        2,
        '0'
      )}`;
    }),
  };
});

const { useUserProfile } = jest.requireMock('@/hooks/useUserProfile') as {
  useUserProfile: jest.Mock;
};

const createMockTimestamp = () =>
  ({
    seconds: 0,
    nanoseconds: 0,
    toDate: () => new Date('2025-01-01T09:00:00'),
    toMillis: () => new Date('2025-01-01T09:00:00').getTime(),
    isEqual: () => false,
  }) as never;

describe('Profile modal integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders shared profile and fallback contact info inside ApplicantProfileModal', () => {
    useUserProfile.mockReturnValue({
      userProfile: {
        uid: 'staff-1',
        email: '',
        name: '김지원',
        role: 'staff',
        gender: 'female',
        birthDate: '19920101',
        region: '서울',
        experienceYears: 2,
        career: '홀 운영 2년',
        note: '밝게 응대합니다',
        phone: undefined,
        createdAt: createMockTimestamp(),
        updatedAt: createMockTimestamp(),
      },
      isLoading: false,
      displayName: '김지원',
      profilePhotoURL: undefined,
    });

    render(
      <ApplicantProfileModal
        visible
        onClose={jest.fn()}
        applicant={
          {
            id: 'application-1',
            applicantId: 'staff-1',
            applicantName: '김지원',
            applicantPhone: '010-1111-2222',
            applicantEmail: 'fallback@example.com',
            status: 'applied',
            assignments: [],
            customRole: '딜러',
            createdAt: new Date('2025-01-02T10:00:00'),
            message: '잘 부탁드립니다',
          } as never
        }
      />
    );

    expect(screen.getByText('지원자 프로필')).toBeTruthy();
    expect(screen.getByText('프로필 정보')).toBeTruthy();
    expect(screen.getByText('서울')).toBeTruthy();
    expect(screen.getByText('홀 운영 2년')).toBeTruthy();
    expect(screen.getByText('연락처 정보')).toBeTruthy();
    expect(screen.getByText('010-1111-2222')).toBeTruthy();
    expect(screen.getByText('fallback@example.com')).toBeTruthy();
  });

  it('renders shared profile section and staff phone fallback inside StaffProfileModal', () => {
    useUserProfile.mockReturnValue({
      userProfile: {
        uid: 'staff-2',
        email: 'staff@example.com',
        name: '이스태프',
        role: 'staff',
        gender: 'male',
        birthDate: '19900303',
        region: '부산',
        experienceYears: 4,
        career: '스태프 운영 4년',
        note: '체크인 안내에 익숙합니다',
        phone: undefined,
        createdAt: createMockTimestamp(),
        updatedAt: createMockTimestamp(),
      },
      isLoading: false,
      displayName: '이스태프',
      profilePhotoURL: undefined,
    });

    render(
      <StaffProfileModal
        visible
        onClose={jest.fn()}
        staff={
          {
            id: 'worklog-1',
            staffId: 'staff-2',
            staffName: '이스태프',
            phone: '010-7777-8888',
            role: 'dealer',
            date: '2025-01-10',
            status: 'scheduled',
            checkInTime: new Date('2025-01-10T09:00:00'),
            checkOutTime: new Date('2025-01-10T18:00:00'),
            notes: '지각 주의',
          } as never
        }
      />
    );

    expect(screen.getByText('스태프 프로필')).toBeTruthy();
    expect(screen.getByText('프로필 정보')).toBeTruthy();
    expect(screen.getByText('부산')).toBeTruthy();
    expect(screen.getByText('스태프 운영 4년')).toBeTruthy();
    expect(screen.getByText('연락처 정보')).toBeTruthy();
    expect(screen.getByText('010-7777-8888')).toBeTruthy();
    expect(screen.getByText('staff@example.com')).toBeTruthy();
    expect(screen.getByText('09:00 ~ 18:00')).toBeTruthy();
  });
});
