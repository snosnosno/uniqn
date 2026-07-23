import {
  UNKNOWN_TIME_KEY,
  roleHydrateKey,
  slotHydrateKey,
} from '@/domains/schedule/postingHydrateKeys';

describe('slotHydrateKey', () => {
  it('TBA(시간 미정) 슬롯은 "미정" 키', () => {
    expect(slotHydrateKey({ isTimeToBeAnnounced: true, startTime: '19:00' })).toBe('미정');
    expect(UNKNOWN_TIME_KEY).toBe('미정');
  });

  it('range 문자열("14:00~22:00")은 시작시각만 추출', () => {
    expect(slotHydrateKey({ startTime: '14:00~22:00' })).toBe('14:00');
  });

  it('discrete HH:MM 값은 항등', () => {
    expect(slotHydrateKey({ startTime: '19:00' })).toBe('19:00');
  });

  it('빈 startTime 은 "미정" 폴백', () => {
    expect(slotHydrateKey({ startTime: '' })).toBe('미정');
    expect(slotHydrateKey({ startTime: null })).toBe('미정');
    expect(slotHydrateKey({})).toBe('미정');
  });

  it('startTime 이 없고 time(range)만 있으면 time 에서 추출 (postingSurfaceModel 셰이프 보존)', () => {
    expect(slotHydrateKey({ time: '10:00~18:00' })).toBe('10:00');
  });
});

describe('roleHydrateKey', () => {
  it('other 역할은 custom 유무와 무관하게 "other:" 접두', () => {
    // postingSurfaceModel 셰이프
    expect(roleHydrateKey({ role: 'other', customRole: '조명' })).toBe('other:조명');
    expect(roleHydrateKey({ role: 'other' })).toBe('other:');
    // AssignmentSelector 셰이프
    expect(roleHydrateKey({ roleId: 'other', customName: '조명' })).toBe('other:조명');
    expect(roleHydrateKey({ roleId: 'other' })).toBe('other:');
  });

  it('일반 역할은 역할 id 그대로', () => {
    expect(roleHydrateKey({ role: 'dealer' })).toBe('dealer');
    expect(roleHydrateKey({ roleId: 'dealer' })).toBe('dealer');
  });

  it('role 이 없고 name 만 있으면 name 폴백 (postingSurfaceModel 셰이프 보존)', () => {
    expect(roleHydrateKey({ name: 'floor' })).toBe('floor');
  });
});
