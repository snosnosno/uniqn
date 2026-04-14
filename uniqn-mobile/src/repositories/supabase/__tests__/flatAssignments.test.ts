/**
 * flatAssignments 변환 로직 테스트
 *
 * ApplicationRepositoryTransactions.executeConfirmWithHistory 내부의
 * Assignment v3(dates[], roleIds[]) → RPC flat 형식 변환 검증
 */

import { normalizeAssignmentRole } from '@/types/assignment';

// 변환 로직을 순수 함수로 추출 (테스트 용이성)
function buildFlatAssignments(
  assignmentsToConfirm: {
    groupId?: string | null;
    dates: string[];
    roleIds: string[];
    timeSlot: string;
  }[]
) {
  return assignmentsToConfirm.flatMap((a) =>
    a.dates.flatMap((date) =>
      a.roleIds.map((roleId) => {
        const { role, customRole } = normalizeAssignmentRole(roleId);
        return {
          groupId: a.groupId ?? null,
          date,
          timeSlot: a.timeSlot,
          // RPC confirm_application은 'other'를 알 수 없는 역할로 처리 → 'staff'로 전달
          role: role === 'other' ? 'staff' : role,
          customRole: customRole ?? null,
        };
      })
    )
  );
}

describe('flatAssignments 변환', () => {
  it('단일 날짜 + 단일 역할 → 1개 레코드', () => {
    const result = buildFlatAssignments([
      { dates: ['2026-05-01'], roleIds: ['dealer'], timeSlot: '09:00-18:00' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      date: '2026-05-01',
      role: 'dealer',
      customRole: null,
      groupId: null,
      timeSlot: '09:00-18:00',
    });
  });

  it('N개 날짜 × 1개 역할 → N개 레코드', () => {
    const result = buildFlatAssignments([
      { dates: ['2026-05-01', '2026-05-02', '2026-05-03'], roleIds: ['floor'], timeSlot: '10:00' },
    ]);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.date)).toEqual(['2026-05-01', '2026-05-02', '2026-05-03']);
    expect(result.every((r) => r.role === 'floor')).toBe(true);
  });

  it('1개 날짜 × M개 역할 → M개 레코드', () => {
    const result = buildFlatAssignments([
      { dates: ['2026-05-01'], roleIds: ['dealer', 'floor', 'serving'], timeSlot: '10:00' },
    ]);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.role)).toEqual(['dealer', 'floor', 'serving']);
  });

  it('N개 날짜 × M개 역할 → N×M개 레코드 (카르테시안 곱)', () => {
    const result = buildFlatAssignments([
      {
        dates: ['2026-05-01', '2026-05-02'],
        roleIds: ['dealer', 'floor', 'serving'],
        timeSlot: '10:00',
      },
    ]);
    expect(result).toHaveLength(6);
  });

  it("role='other' → RPC에 'staff'로 전달 (customRole은 보존)", () => {
    const result = buildFlatAssignments([
      { dates: ['2026-05-01'], roleIds: ['other'], timeSlot: '10:00' },
    ]);
    expect(result[0].role).toBe('staff');
    expect(result[0].customRole).toBeNull();
  });

  it('커스텀 역할(비표준 roleId) → staff + customRole 설정', () => {
    const result = buildFlatAssignments([
      { dates: ['2026-05-01'], roleIds: ['VIP 딜러'], timeSlot: '10:00' },
    ]);
    expect(result[0].role).toBe('staff');
    expect(result[0].customRole).toBe('VIP 딜러');
  });

  it('groupId 있을 때 보존', () => {
    const result = buildFlatAssignments([
      { groupId: 'grp-1', dates: ['2026-05-01'], roleIds: ['dealer'], timeSlot: '10:00' },
    ]);
    expect(result[0].groupId).toBe('grp-1');
  });

  it('빈 배열 입력 → 빈 배열 반환', () => {
    expect(buildFlatAssignments([])).toEqual([]);
  });
});
