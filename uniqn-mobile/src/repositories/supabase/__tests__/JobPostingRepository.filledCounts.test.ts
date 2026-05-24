import { buildSlotRoleKey } from '@/repositories/supabase/JobPostingRepository';

describe('buildSlotRoleKey', () => {
  it('TBA 슬롯 + dealer 키', () => {
    expect(buildSlotRoleKey('2026-05-23', '미정', 'dealer')).toBe('2026-05-23__미정__dealer');
  });
  it('other 역할은 customRole 포함', () => {
    expect(buildSlotRoleKey('2026-05-23', '14:00', 'other:바텐더')).toBe('2026-05-23__14:00__other:바텐더');
  });
});
