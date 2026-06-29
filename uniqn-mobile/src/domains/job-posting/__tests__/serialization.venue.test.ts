/**
 * serializeJobPostingV3 / deserializeJobPostingDocument — venueId 보존 회귀 가드.
 *
 * 배경: 주간 배치 그리드 "공고 열기" 는 일반 공고를 input.venueId(=운영처 컨테이너 id)와 함께
 * 생성한다. 직렬화/역직렬화 경계에서 venueId 가 silent drop 되면(=#194 region 유실 동일 클래스)
 * 신규 공고가 venue_id NULL 고아로 INSERT 되어 venue_span_posting_ids(venue_id=:V OR id=:V)의
 * venue_id 암(arm)에 영영 안 잡히고, 편집 진입 시 venue 연결이 왕복 불가가 된다.
 */
import { serializeJobPostingV3, deserializeJobPostingDocument } from '../serialization';
import type { CreateJobPostingInput, JobPosting } from '@/types/jobPosting';

const VENUE_ID = '123e4567-e89b-42d3-a456-426614174000';

function createInput(venueId?: string): CreateJobPostingInput {
  return {
    postingType: 'regular',
    title: '테스트 공고',
    location: { name: 'Seoul', district: '서울 강남구 역삼동', detailedAddress: '101' },
    ...(venueId ? { venueId } : {}),
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
    compensation: { mode: 'shared', defaultSalary: { type: 'hourly', amount: 12000 } },
    questions: { items: [] },
  };
}

describe('serializeJobPostingV3 — venueId 보존', () => {
  it('"공고 열기" 생성: input.venueId 를 직렬화 문서에 보존한다(create INSERT venue_id 보장)', () => {
    const doc = serializeJobPostingV3(createInput(VENUE_ID), {
      ownerId: 'owner-uuid-1',
      ownerName: '테스트 오너',
    });
    expect(doc.venueId).toBe(VENUE_ID);
  });

  it('일반 생성: venueId 미지정 시 키 자체를 생략한다(venue_id 미기록 무회귀)', () => {
    const doc = serializeJobPostingV3(createInput(), {
      ownerId: 'owner-uuid-1',
      ownerName: '테스트 오너',
    });
    expect(doc.venueId).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(doc, 'venueId')).toBe(false);
  });

  it('편집/정산 재직렬화: input 에 venueId 가 없어도 current.venueId 로 보존한다', () => {
    const current: Partial<JobPosting> = { id: 'p1', venueId: VENUE_ID };
    const doc = serializeJobPostingV3(createInput(), {
      ownerId: 'owner-uuid-1',
      current,
    });
    expect(doc.venueId).toBe(VENUE_ID);
  });

  it('직렬화→역직렬화 라운드트립에서 venueId 가 유지된다', () => {
    const doc = serializeJobPostingV3(createInput(VENUE_ID), {
      ownerId: 'owner-uuid-1',
      ownerName: '테스트 오너',
    });
    const runtime = deserializeJobPostingDocument(doc);
    expect(runtime.venueId).toBe(VENUE_ID);
  });

  it('venueId 없는 문서의 역직렬화는 venueId 를 만들지 않는다', () => {
    const doc = serializeJobPostingV3(createInput(), {
      ownerId: 'owner-uuid-1',
      ownerName: '테스트 오너',
    });
    const runtime = deserializeJobPostingDocument(doc);
    expect(runtime.venueId).toBeUndefined();
  });
});
