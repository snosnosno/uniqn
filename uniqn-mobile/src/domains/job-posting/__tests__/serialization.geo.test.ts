/**
 * serializeJobPostingV3 / deserializeJobPostingDocument — 근무지 좌표 3상 회귀 가드 (B2).
 *
 * 배경: 좌표는 `location` jsonb 가 아니라 **최상위 컬럼**(geo_lat/geo_lng)에 산다 — jsonb 안에
 * 새 키를 넣으면 구버전 앱의 `.strict()` 파스가 문서를 통째로 거부해 공고가 목록에서 증발한다
 * (#194 클래스). 그래서 venueId·salary*Max 와 같은 직렬화 경계 규율이 그대로 적용된다.
 *
 * 여기서 고정하는 실패는 세 가지다:
 *   1. 편집 저장 한 번에 좌표가 조용히 사라지는 것(= current 보존 분기 유실)
 *   2. **주소를 바꿨는데 옛 좌표가 남는 것** — 길찾기가 틀린 곳을 자신 있게 안내한다.
 *      좌표가 없는 것보다 나쁘다(없으면 주소 텍스트로 폴백한다)
 *   3. 반쪽 좌표가 새어 나가 DB `chk_job_postings_geo_pair` 로 **공고 저장 전체**를 깨는 것
 */
import {
  serializeJobPostingV3,
  deserializeJobPostingDocument,
  mergeJobPostingInput,
} from '../serialization';
import type { CreateJobPostingInput, JobPosting } from '@/types/jobPosting';

// 실측값(2026-08-03 prod 지오코딩): '서울 강남구 테헤란로 152'
const GANGNAM = { lat: 37.5000242405515, lng: 127.036508620542 };
const PANGYO = { lat: 37.402048486442, lng: 127.108690978068 };

function createInput(geo?: CreateJobPostingInput['geo']): CreateJobPostingInput {
  return {
    postingType: 'regular',
    title: '테스트 공고',
    location: { name: '라운더스', district: '서울 강남구 테헤란로 152' },
    ...(geo !== undefined ? { geo } : {}),
    schedule: {
      kind: 'dated',
      primaryDate: '2026-06-01',
      allDates: ['2026-06-01'],
      requirements: [
        {
          date: '2026-06-01',
          timeSlots: [
            { id: 'slot-1', startTime: '09:00', roles: [{ id: 'd1', role: 'dealer', count: 1 }] },
          ],
        },
      ],
    },
    roleCatalog: [{ role: 'dealer', salary: { type: 'hourly', amount: 12000 } }],
    compensation: { mode: 'shared', defaultSalary: { type: 'hourly', amount: 12000 } },
    questions: { items: [] },
  };
}

const OWNER = { ownerId: 'owner-uuid-1', ownerName: '테스트 오너' };

describe('serializeJobPostingV3 — 좌표 3상', () => {
  it('좌표를 주면 최상위 geoLat/geoLng 로 싣는다', () => {
    const doc = serializeJobPostingV3(createInput(GANGNAM), OWNER);

    expect(doc.geoLat).toBe(GANGNAM.lat);
    expect(doc.geoLng).toBe(GANGNAM.lng);
  });

  it('🔴 좌표를 location jsonb 안에 넣지 않는다 — 구버전 앱에서 공고가 증발한다', () => {
    const doc = serializeJobPostingV3(createInput(GANGNAM), OWNER);

    expect(doc.location).toEqual({ name: '라운더스', district: '서울 강남구 테헤란로 152' });
    expect(Object.prototype.hasOwnProperty.call(doc.location, 'coordinates')).toBe(false);
  });

  it('미지정(신규·좌표 없음)이면 키 자체를 생략한다', () => {
    const doc = serializeJobPostingV3(createInput(), OWNER);

    expect(Object.prototype.hasOwnProperty.call(doc, 'geoLat')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(doc, 'geoLng')).toBe(false);
  });

  it('미지정(편집)이면 current 의 좌표를 보존한다 — 저장 한 번에 사라지면 안 된다', () => {
    const current: Partial<JobPosting> = { id: 'p1', geoLat: GANGNAM.lat, geoLng: GANGNAM.lng };
    const doc = serializeJobPostingV3(createInput(), { ...OWNER, current });

    expect(doc.geoLat).toBe(GANGNAM.lat);
    expect(doc.geoLng).toBe(GANGNAM.lng);
  });

  it('🔴 null 이면 current 가 있어도 지운다 — 주소가 바뀌었는데 지오코딩이 실패한 경우', () => {
    const current: Partial<JobPosting> = { id: 'p1', geoLat: GANGNAM.lat, geoLng: GANGNAM.lng };
    const doc = serializeJobPostingV3(createInput(null), { ...OWNER, current });

    expect(doc.geoLat).toBeNull();
    expect(doc.geoLng).toBeNull();
  });

  it('새 좌표는 current 를 덮어쓴다', () => {
    const current: Partial<JobPosting> = { id: 'p1', geoLat: GANGNAM.lat, geoLng: GANGNAM.lng };
    const doc = serializeJobPostingV3(createInput(PANGYO), { ...OWNER, current });

    expect(doc.geoLat).toBe(PANGYO.lat);
    expect(doc.geoLng).toBe(PANGYO.lng);
  });

  it('🔴 유한하지 않은 값이 오면 둘 다 비운다 — 반쪽 좌표는 DB 짝 제약으로 저장 전체를 깬다', () => {
    const doc = serializeJobPostingV3(createInput({ lat: Number.NaN, lng: 127 }), OWNER);

    expect(doc.geoLat).toBeNull();
    expect(doc.geoLng).toBeNull();
  });

  it('current 에 한쪽만 있으면 보존 분기가 아무것도 싣지 않는다(반쪽 유출 차단)', () => {
    const current = { id: 'p1', geoLat: GANGNAM.lat } as Partial<JobPosting>;
    const doc = serializeJobPostingV3(createInput(), { ...OWNER, current });

    expect(Object.prototype.hasOwnProperty.call(doc, 'geoLat')).toBe(false);
  });
});

/**
 * 실제 수정 경로는 서비스가 판정한 `geo` 를 `mergeJobPostingInput` 에 통과시킨 뒤에야
 * `serializeJobPostingV3` 에 닿는다. 병합에서 키가 떨어지면 위 3상 테스트가 전부 green 인데도
 * 결과는 "항상 유지"로 무너진다 — `toCreateJobPostingInput` 이 canonical location 만 남겨
 * `address`·`coordinates` 를 떨구는 것과 정확히 같은 클래스의 조용한 유실이다.
 */
describe('mergeJobPostingInput — 좌표 의견 전달', () => {
  function currentPosting(): JobPosting {
    return deserializeJobPostingDocument(serializeJobPostingV3(createInput(GANGNAM), OWNER));
  }

  it('patch 의 좌표가 병합 결과까지 온다', () => {
    expect(mergeJobPostingInput(currentPosting(), { geo: PANGYO }).geo).toEqual(PANGYO);
  });

  it('🔴 patch 의 null(지움)이 병합에서 사라지지 않는다', () => {
    expect(mergeJobPostingInput(currentPosting(), { geo: null }).geo).toBeNull();
  });

  it('좌표에 의견이 없는 patch(정산 설정 저장 등)는 키를 만들지 않는다', () => {
    const merged = mergeJobPostingInput(currentPosting(), { title: '제목만 변경' });

    expect(merged.geo).toBeUndefined();
    // 그리고 그 결과를 직렬화하면 current 의 좌표가 보존된다(= 정산 설정 저장이 좌표를 안 지운다).
    const doc = serializeJobPostingV3(merged, { ...OWNER, current: currentPosting() });
    expect(doc.geoLat).toBe(GANGNAM.lat);
  });
});

describe('deserializeJobPostingDocument — 좌표 하이드레이션', () => {
  it('직렬화→역직렬화 라운드트립에서 좌표가 유지된다', () => {
    const doc = serializeJobPostingV3(createInput(GANGNAM), OWNER);
    const runtime = deserializeJobPostingDocument(doc);

    expect(runtime.geoLat).toBe(GANGNAM.lat);
    expect(runtime.geoLng).toBe(GANGNAM.lng);
  });

  it('좌표 없는 문서는 좌표를 만들어내지 않는다', () => {
    const runtime = deserializeJobPostingDocument(serializeJobPostingV3(createInput(), OWNER));

    expect(runtime.geoLat).toBeUndefined();
    expect(runtime.geoLng).toBeUndefined();
  });

  it('🔴 편집 왕복(읽기→재직렬화)에서 좌표가 살아남는다', () => {
    const stored = serializeJobPostingV3(createInput(GANGNAM), OWNER);
    const runtime = deserializeJobPostingDocument(stored);

    // 편집 저장 경로와 같은 모양: 좌표에 의견이 없는 입력 + current = 방금 읽은 런타임 문서
    const resaved = serializeJobPostingV3(createInput(), { ...OWNER, current: runtime });

    expect(resaved.geoLat).toBe(GANGNAM.lat);
    expect(resaved.geoLng).toBe(GANGNAM.lng);
  });
});
