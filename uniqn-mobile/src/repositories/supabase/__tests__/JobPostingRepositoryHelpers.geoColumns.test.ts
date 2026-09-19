/**
 * 좌표 컬럼 3곳 동시 등록 회귀 가드 (#194 클래스 — 주소 검색 2단계 B2).
 *
 * 새 DB 컬럼은 **세 곳에 동시에** 있어야 한다:
 *   ① `TABLE_COLUMNS`            — 없으면 select 에 안 실려 값이 영영 안 온다
 *   ② `ALLOWED_CAMEL_COLUMNS`    — ①에서 자동 파생
 *   ③ `jobPostingDocumentSchema` — 없으면 ②를 통과한 키가 `.strict()` 파스를 깨서
 *                                  **공고가 목록에서 통째로 사라진다**
 *
 * 이 테스트는 ①③이 어긋나는 순간 red 가 된다 — 셋 중 하나만 빼먹어도 증상이
 * "값이 안 보인다"가 아니라 "공고가 없어진다"라서 화면만 보고는 원인을 못 찾는다.
 */
import { TABLE_COLUMNS, ALLOWED_CAMEL_COLUMNS, toJobPosting } from '../JobPostingRepositoryHelpers';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

/** DB 가 돌려주는 snake_case 행 한 벌(최소 필수 필드 + 좌표). */
function makeRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'posting-1',
    schema_version: 3,
    title: '테스트 공고',
    status: 'active',
    owner_id: 'owner-1',
    workspace_id: '123e4567-e89b-42d3-a456-426614174000',
    posting_type: 'regular',
    work_date: '2026-08-10',
    work_dates: ['2026-08-10'],
    total_positions: 1,
    filled_positions: 0,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    location: { name: '라운더스', district: '서울 강남구 테헤란로 152' },
    schedule: {
      kind: 'dated',
      primaryDate: '2026-08-10',
      allDates: ['2026-08-10'],
      requirements: [
        {
          date: '2026-08-10',
          timeSlots: [
            { id: 's1', startTime: '09:00', roles: [{ id: 'r1', role: 'dealer', count: 1 }] },
          ],
        },
      ],
    },
    role_catalog: [{ role: 'dealer', salary: { type: 'hourly', amount: 12000 } }],
    compensation: { mode: 'shared', defaultSalary: { type: 'hourly', amount: 12000 } },
    questions: { items: [] },
    ...overrides,
  };
}

describe('좌표 컬럼 3곳 등록', () => {
  it('① TABLE_COLUMNS 에 geo_lat/geo_lng 가 있다 — 없으면 select 에 안 실린다', () => {
    const columns = TABLE_COLUMNS.split(',');

    expect(columns).toContain('geo_lat');
    expect(columns).toContain('geo_lng');
  });

  it('② ALLOWED_CAMEL_COLUMNS 가 자동 파생된다', () => {
    expect(ALLOWED_CAMEL_COLUMNS.has('geoLat')).toBe(true);
    expect(ALLOWED_CAMEL_COLUMNS.has('geoLng')).toBe(true);
  });

  it('③ 좌표가 실린 행이 파스를 통과하고 값이 런타임까지 온다', () => {
    const parsed = toJobPosting(makeRow({ geo_lat: 37.5000242, geo_lng: 127.0365086 }));

    // 🔴 여기서 null 이면 스키마 미등록이다 = 좌표를 가진 공고가 목록에서 사라진다.
    expect(parsed).not.toBeNull();
    expect(parsed?.geoLat).toBe(37.5000242);
    expect(parsed?.geoLng).toBe(127.0365086);
  });

  it('좌표가 NULL 인 기존 공고도 그대로 파스된다(하위호환)', () => {
    const parsed = toJobPosting(makeRow({ geo_lat: null, geo_lng: null }));

    expect(parsed).not.toBeNull();
    expect(parsed?.geoLat).toBeUndefined();
  });

  it('좌표 컬럼이 아예 없는 행(구버전 select)도 파스된다', () => {
    const parsed = toJobPosting(makeRow());

    expect(parsed).not.toBeNull();
    expect(parsed?.geoLat).toBeUndefined();
  });

  it('🔴 경계 밖 좌표라도 read 를 죽이지 않는다 — 읽기에서 범위를 걸면 공고가 증발한다', () => {
    // 범위 검증은 쓰기 경계(geocodingService)와 DB CHECK 의 몫이다. 읽기는 관대해야
    // 나중에 경계를 넓혔을 때 저장된 공고가 사라지지 않는다(region 과 같은 규율).
    const parsed = toJobPosting(makeRow({ geo_lat: 1.23, geo_lng: 4.56 }));

    expect(parsed).not.toBeNull();
    expect(parsed?.geoLat).toBe(1.23);
  });
});
