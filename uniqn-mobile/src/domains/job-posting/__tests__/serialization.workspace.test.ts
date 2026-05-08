import { serializeJobPostingV3 } from '../serialization';
import type { CreateJobPostingInput } from '@/types/jobPosting';

function createMinimalInput(): CreateJobPostingInput {
  return {
    postingType: 'regular',
    title: '테스트 공고',
    location: {
      name: 'Seoul',
      district: 'Gangnam',
      detailedAddress: '101',
    },
    schedule: {
      kind: 'dated',
      primaryDate: '2026-06-01',
      allDates: ['2026-06-01'],
      requirements: [
        {
          date: '2026-06-01',
          timeSlots: [
            {
              id: 'slot-1',
              startTime: '09:00',
              roles: [{ id: 'dealer-1', role: 'dealer', count: 1, filled: 0 }],
            },
          ],
        },
      ],
    },
    roleCatalog: [{ role: 'dealer', salary: { type: 'hourly', amount: 12000 } }],
    compensation: {
      mode: 'shared',
      defaultSalary: { type: 'hourly', amount: 12000 },
    },
    questions: { items: [] },
  };
}

describe('serializeJobPostingV3 — workspaceId 주입 (Phase 0 N1 hotfix)', () => {
  it('options.workspaceId 가 있으면 결과 객체에 workspaceId 가 포함된다', () => {
    const result = serializeJobPostingV3(createMinimalInput(), {
      ownerId: 'owner-uuid-1',
      ownerName: '테스트 오너',
      workspaceId: 'workspace-uuid-1',
    });

    expect((result as { workspaceId?: string }).workspaceId).toBe('workspace-uuid-1');
  });

  it('options.workspaceId 가 없으면 workspaceId 필드는 누락된다', () => {
    const result = serializeJobPostingV3(createMinimalInput(), {
      ownerId: 'owner-uuid-1',
      ownerName: '테스트 오너',
    });

    expect((result as { workspaceId?: string }).workspaceId).toBeUndefined();
  });

  it('빈 문자열 workspaceId 는 누락 처리 (공백/falsy 가드)', () => {
    const result = serializeJobPostingV3(createMinimalInput(), {
      ownerId: 'owner-uuid-1',
      ownerName: '테스트 오너',
      workspaceId: '',
    });

    expect((result as { workspaceId?: string }).workspaceId).toBeUndefined();
  });
});
