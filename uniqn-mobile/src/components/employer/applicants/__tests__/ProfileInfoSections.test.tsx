import React from 'react';
import { render, screen } from '@testing-library/react-native';
import type { UserProfile } from '@/services';
import { ContactInfoSection, ProfileInfoSection } from '../ProfileInfoSections';

const createMockTimestamp = () =>
  ({
    seconds: 0,
    nanoseconds: 0,
    toDate: () => new Date('2025-01-01'),
    toMillis: () => new Date('2025-01-01').getTime(),
    isEqual: () => false,
  }) as never;

const baseUserProfile: UserProfile = {
  uid: 'user-1',
  email: 'profile@example.com',
  name: '홍길동',
  role: 'staff',
  gender: 'male',
  birthDate: '19900101',
  region: '서울',
  experienceYears: 3,
  career: '포커딜러 경력 3년',
  note: '친절하고 성실합니다',
  phone: '010-1111-2222',
  createdAt: createMockTimestamp(),
  updatedAt: createMockTimestamp(),
};

describe('ProfileInfoSections', () => {
  it('renders user profile fields', () => {
    render(<ProfileInfoSection userProfile={baseUserProfile} />);

    expect(screen.getByText('프로필 정보')).toBeTruthy();
    expect(screen.getByText('남성')).toBeTruthy();
    expect(screen.getByText('서울')).toBeTruthy();
    expect(screen.getByText('3년')).toBeTruthy();
    expect(screen.getByText('포커딜러 경력 3년')).toBeTruthy();
    expect(screen.getByText('친절하고 성실합니다')).toBeTruthy();
  });

  it('falls back to provided contact values when userProfile contact fields are missing', () => {
    const profileWithoutContacts: UserProfile = {
      ...baseUserProfile,
      email: '',
      phone: undefined,
    };

    render(
      <ContactInfoSection
        userProfile={profileWithoutContacts}
        fallbackPhone="010-9999-8888"
        fallbackEmail="fallback@example.com"
      />
    );

    expect(screen.getByText('010-9999-8888')).toBeTruthy();
    expect(screen.getByText('fallback@example.com')).toBeTruthy();
  });

  it('hides empty contact rows when no values are available', () => {
    render(<ContactInfoSection userProfile={undefined} />);

    expect(screen.getByText('연락처 정보')).toBeTruthy();
    expect(screen.queryByText('전화번호')).toBeNull();
    expect(screen.queryByText('이메일')).toBeNull();
  });
});
