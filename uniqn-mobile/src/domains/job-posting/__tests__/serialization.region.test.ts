import { serializeJobPostingV3, deserializeJobPostingDocument } from '../serialization';
import type { CreateJobPostingInput } from '@/types/jobPosting';

function createInput(region?: string): CreateJobPostingInput {
  return {
    postingType: 'regular',
    title: '테스트 공고',
    location: {
      name: 'Seoul',
      district: '서울 강남구 역삼동',
      ...(region ? { region } : {}),
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
              roles: [{ id: 'dealer-1', role: 'dealer', count: 1 }],
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

describe('serializeJobPostingV3 — location.region 보존', () => {
  it('쓰기 직렬화가 location.region 을 보존한다', () => {
    const result = serializeJobPostingV3(createInput('서울 강남구'), {
      ownerId: 'owner-uuid-1',
      ownerName: '테스트 오너',
    });
    expect((result.location as { region?: string }).region).toBe('서울 강남구');
  });

  it('region 미지정 시 location.region 필드는 누락된다', () => {
    const result = serializeJobPostingV3(createInput(), {
      ownerId: 'owner-uuid-1',
      ownerName: '테스트 오너',
    });
    expect((result.location as { region?: string }).region).toBeUndefined();
  });

  it('직렬화→역직렬화 라운드트립에서 region 이 유지된다', () => {
    const doc = serializeJobPostingV3(createInput('부산'), {
      ownerId: 'owner-uuid-1',
      ownerName: '테스트 오너',
    });
    const runtime = deserializeJobPostingDocument(doc);
    expect(runtime.location.region).toBe('부산');
  });
});
