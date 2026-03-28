import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ApplicantProfileModal } from '../ApplicantProfileModal';
import { StaffProfileModal } from '../StaffProfileModal';

jest.mock('@/hooks/useUserProfile', () => ({
  useUserProfile: jest.fn(),
}));

jest.mock('../../../ui/SheetModal', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const { Text, View } = jest.requireActual('react-native') as typeof import('react-native');

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
  const React = jest.requireActual('react') as typeof import('react');
  const { Text } = jest.requireActual('react-native') as typeof import('react-native');

  return {
    Avatar: ({ name }: any) => <Text>{name}</Text>,
  };
});

jest.mock('../../../ui/Badge', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const { Text } = jest.requireActual('react-native') as typeof import('react-native');

  return {
    Badge: ({ children }: any) => <Text>{children}</Text>,
  };
});

jest.mock('@/utils/date', () => {
  const actual = jest.requireActual('@/utils/date');

  return {
    ...actual,
    formatRelativeTime: jest.fn(() => '1분 전'),
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

  it('renders localized applicant profile content and fallback contact info', () => {
    useUserProfile.mockReturnValue({
      userProfile: {
        uid: 'staff-1',
        email: '',
        name: '지원자',
        role: 'staff',
        gender: 'female',
        birthDate: '19920101',
        region: '서울',
        experienceYears: 2,
        career: '딜러 경력 2년',
        note: '밝고 성실합니다.',
        phone: undefined,
        createdAt: createMockTimestamp(),
        updatedAt: createMockTimestamp(),
      },
      isLoading: false,
      displayName: '지원자',
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
            applicantName: '지원자',
            applicantPhone: '010-1111-2222',
            applicantEmail: 'fallback@example.com',
            status: 'applied',
            assignments: [
              {
                roleIds: ['dealer'],
                timeSlot: '09:00',
                dates: ['2025-01-03'],
                isGrouped: false,
              },
            ],
            createdAt: new Date('2025-01-02T10:00:00'),
            message: '잘 부탁드립니다.',
          } as never
        }
      />
    );

    expect(screen.getByText('지원자 프로필')).toBeTruthy();
    expect(screen.getByText(/1분 전/)).toBeTruthy();
    expect(screen.getByText('프로필 정보')).toBeTruthy();
    expect(screen.getByText('서울')).toBeTruthy();
    expect(screen.getByText('딜러 경력 2년')).toBeTruthy();
    expect(screen.getByText('연락처 정보')).toBeTruthy();
    expect(screen.getByText('010-1111-2222')).toBeTruthy();
    expect(screen.getByText('fallback@example.com')).toBeTruthy();
    expect(screen.getByText('지원 메시지')).toBeTruthy();
    expect(screen.getByText('잘 부탁드립니다.')).toBeTruthy();
    expect(screen.getByText('지원 일정')).toBeTruthy();
    expect(screen.getByText('2025.1.3(금)')).toBeTruthy();
  });

  it('renders localized staff profile details and contact fallback', () => {
    useUserProfile.mockReturnValue({
      userProfile: {
        uid: 'staff-2',
        email: 'staff@example.com',
        name: '스태프',
        role: 'staff',
        gender: 'male',
        birthDate: '19900303',
        region: '부산',
        experienceYears: 4,
        career: '스태프 경력 4년',
        note: '체크인 안내에 익숙합니다.',
        phone: undefined,
        createdAt: createMockTimestamp(),
        updatedAt: createMockTimestamp(),
      },
      isLoading: false,
      displayName: '스태프',
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
            staffName: '스태프',
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
    expect(screen.getByText('근무 정보')).toBeTruthy();
    expect(screen.getByText('프로필 정보')).toBeTruthy();
    expect(screen.getByText('부산')).toBeTruthy();
    expect(screen.getByText('스태프 경력 4년')).toBeTruthy();
    expect(screen.getByText('연락처 정보')).toBeTruthy();
    expect(screen.getByText('010-7777-8888')).toBeTruthy();
    expect(screen.getByText('staff@example.com')).toBeTruthy();
    expect(screen.getByText('09:00 ~ 18:00')).toBeTruthy();
    expect(screen.getByText('비고')).toBeTruthy();
    expect(screen.getByText('지각 주의')).toBeTruthy();
  });
});
