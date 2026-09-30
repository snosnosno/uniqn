import { describe, expect, it } from 'vitest';
import { buildManagedFilter } from './postingRepository';

const U = '0a5e0000-0000-4000-8000-000000000001';
const W1 = '0a5e0000-0000-4000-8000-0000000000a1';
const W2 = '0a5e0000-0000-4000-8000-0000000000a2';

describe('buildManagedFilter', () => {
  it('워크스페이스가 없으면 내 소유만', () => {
    expect(buildManagedFilter(U, [])).toBe(`owner_id.eq.${U}`);
  });

  it('소유 ∪ 워크스페이스', () => {
    expect(buildManagedFilter(U, [W1, W2])).toBe(`owner_id.eq.${U},workspace_id.in.(${W1},${W2})`);
  });

  it('UUID 가 아니면 거부(필터 주입 방지)', () => {
    expect(() => buildManagedFilter(U, ['x),owner_id.neq.(y'])).toThrow();
    expect(() => buildManagedFilter('evil,status.eq.draft', [])).toThrow();
  });
});
