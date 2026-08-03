/**
 * jobManagementService — 지오코딩 판정 회귀 가드 (주소 검색 2단계 B2).
 *
 * 🔴 이 스위트가 지키는 것은 하나다: **옛 좌표가 새 주소에 남지 않는 것.**
 * 좌표가 없으면 길찾기가 주소 텍스트로 폴백해 대충이라도 맞는 곳을 안내한다. 그러나 옛 좌표가
 * 남으면 **틀린 곳을 자신 있게** 안내한다 — 처음 가는 근무지에 정시 도착해야 하는 스태프에게
 * 후자가 훨씬 나쁘다.
 *
 * 나머지는 비용·무회귀 축이다: 주소가 그대로면 호출 0회, 좌표에 의견이 없으면 키를 안 보낸다.
 */
import { createJobPosting, updateJobPosting } from '@/services/jobs/jobManagementService';
import type { CreateJobPostingInput, JobPosting } from '@/types';
import { JOB_POSTING_SCHEMA_VERSION } from '@/types/jobPosting';

const mockCreateWithTransaction = jest.fn();
const mockUpdateWithTransaction = jest.fn();
const mockGetGeocodeSnapshot = jest.fn();
const mockGeocodeAddress = jest.fn();

jest.mock('@/repositories', () => ({
  jobPostingRepository: {
    createWithTransaction: (...args: unknown[]) => mockCreateWithTransaction(...args),
    updateWithTransaction: (...args: unknown[]) => mockUpdateWithTransaction(...args),
    getGeocodeSnapshot: (...args: unknown[]) => mockGetGeocodeSnapshot(...args),
    getVenueContainers: jest.fn().mockResolvedValue([{ id: 'venue-1' }]),
    getOrCreateVenueContainer: jest.fn(),
    enqueueScheduleBoardSync: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../geocodingService', () => ({
  geocodeAddress: (...args: unknown[]) => mockGeocodeAddress(...args),
}));

jest.mock('@/services/workspace', () => ({
  workspaceService: {
    getDefaultWorkspaceIdForOwner: jest.fn().mockResolvedValue('ws-1'),
    isMemberOfWorkspace: jest.fn().mockResolvedValue(true),
  },
}));

const GANGNAM = { lat: 37.5000242, lng: 127.0365086 };

function makeInput(district: string): CreateJobPostingInput {
  return {
    postingType: 'regular',
    title: '테스트 공고',
    location: { name: '라운더스', district },
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
    roleCatalog: [{ role: 'dealer', salary: { type: 'hourly', amount: 12000 } }],
    compensation: { mode: 'shared', defaultSalary: { type: 'hourly', amount: 12000 } },
    questions: { items: [] },
  };
}

/** `updateWithTransaction` 이 실제로 받은 input 의 `geo` (키 유무까지 본다). */
function geoArgOfUpdate(): { hasKey: boolean; value: unknown } {
  const input = mockUpdateWithTransaction.mock.calls[0][1] as Record<string, unknown>;
  return { hasKey: Object.prototype.hasOwnProperty.call(input, 'geo'), value: input.geo };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateWithTransaction.mockResolvedValue({ id: 'p1', jobPosting: {} as JobPosting });
  mockUpdateWithTransaction.mockResolvedValue({
    id: 'p1',
    schemaVersion: JOB_POSTING_SCHEMA_VERSION,
  } as JobPosting);
});

describe('createJobPosting — 지오코딩', () => {
  it('주소를 지오코딩해 좌표를 함께 저장한다', async () => {
    mockGeocodeAddress.mockResolvedValue(GANGNAM);

    await createJobPosting(makeInput('서울 강남구 테헤란로 152'), 'owner-1', '오너', 'ws-1');

    expect(mockGeocodeAddress).toHaveBeenCalledWith('서울 강남구 테헤란로 152');
    expect(mockCreateWithTransaction.mock.calls[0][0].geo).toEqual(GANGNAM);
  });

  it('지오코딩이 실패해도 공고는 좌표 없이 저장된다 — 부가 기능이 본 기능을 막지 않는다', async () => {
    mockGeocodeAddress.mockResolvedValue(null);

    await expect(
      createJobPosting(makeInput('서울 강남구 테헤란로 152'), 'owner-1', '오너', 'ws-1')
    ).resolves.toBeDefined();

    expect(mockCreateWithTransaction.mock.calls[0][0].geo).toBeNull();
    expect(mockCreateWithTransaction).toHaveBeenCalledTimes(1);
  });
});

describe('updateJobPosting — 지오코딩 판정', () => {
  it('주소를 안 보낸 갱신(상태 변경 등)은 좌표를 건드리지 않는다 — 키 자체를 안 보낸다', async () => {
    await updateJobPosting('p1', { status: 'closed' }, 'owner-1', null);

    expect(mockGetGeocodeSnapshot).not.toHaveBeenCalled();
    expect(mockGeocodeAddress).not.toHaveBeenCalled();
    expect(geoArgOfUpdate().hasKey).toBe(false);
  });

  it('주소가 그대로이고 좌표도 이미 있으면 호출 0회로 건너뛴다', async () => {
    mockGetGeocodeSnapshot.mockResolvedValue({
      address: '서울 강남구 테헤란로 152',
      hasGeo: true,
    });

    await updateJobPosting(
      'p1',
      { location: { name: '라운더스', district: '서울 강남구 테헤란로 152' } },
      'owner-1',
      null
    );

    expect(mockGeocodeAddress).not.toHaveBeenCalled();
    expect(geoArgOfUpdate().hasKey).toBe(false);
  });

  it('주소가 그대로인데 좌표가 없으면 이번 저장에 채워 넣는다(기존 공고 백필)', async () => {
    mockGetGeocodeSnapshot.mockResolvedValue({
      address: '서울 강남구 테헤란로 152',
      hasGeo: false,
    });
    mockGeocodeAddress.mockResolvedValue(GANGNAM);

    await updateJobPosting(
      'p1',
      { location: { name: '라운더스', district: '서울 강남구 테헤란로 152' } },
      'owner-1',
      null
    );

    expect(geoArgOfUpdate().value).toEqual(GANGNAM);
  });

  it('주소가 바뀌면 새 좌표로 갱신한다', async () => {
    mockGetGeocodeSnapshot.mockResolvedValue({ address: '서울 강남구 테헤란로 1', hasGeo: true });
    mockGeocodeAddress.mockResolvedValue(GANGNAM);

    await updateJobPosting(
      'p1',
      { location: { name: '라운더스', district: '서울 강남구 테헤란로 152' } },
      'owner-1',
      null
    );

    expect(mockGeocodeAddress).toHaveBeenCalledWith('서울 강남구 테헤란로 152');
    expect(geoArgOfUpdate().value).toEqual(GANGNAM);
  });

  it('🔴 주소가 바뀌었는데 지오코딩이 실패하면 옛 좌표를 지운다(null)', async () => {
    mockGetGeocodeSnapshot.mockResolvedValue({ address: '서울 강남구 테헤란로 1', hasGeo: true });
    mockGeocodeAddress.mockResolvedValue(null);

    await updateJobPosting(
      'p1',
      { location: { name: '라운더스', district: '부산 해운대구 해운대해변로 264' } },
      'owner-1',
      null
    );

    // undefined(유지)가 아니라 null(지움)이어야 한다. 유지면 옛 좌표가 새 주소에 남는다.
    expect(geoArgOfUpdate().value).toBeNull();
  });

  it('🔴 주소를 지우면 좌표도 지운다 — 근거 없는 핀을 남기지 않는다', async () => {
    mockGetGeocodeSnapshot.mockResolvedValue({ address: '서울 강남구 테헤란로 1', hasGeo: true });

    await updateJobPosting('p1', { location: { name: '라운더스' } }, 'owner-1', null);

    expect(mockGeocodeAddress).not.toHaveBeenCalled();
    expect(geoArgOfUpdate().value).toBeNull();
  });

  it('스냅샷 조회가 실패해도 저장을 막지 않고 보수적으로 재계산한다', async () => {
    mockGetGeocodeSnapshot.mockRejectedValue(new Error('network'));
    mockGeocodeAddress.mockResolvedValue(GANGNAM);

    await expect(
      updateJobPosting(
        'p1',
        { location: { name: '라운더스', district: '서울 강남구 테헤란로 152' } },
        'owner-1',
        null
      )
    ).resolves.toBeDefined();

    expect(mockGeocodeAddress).toHaveBeenCalledWith('서울 강남구 테헤란로 152');
    expect(geoArgOfUpdate().value).toEqual(GANGNAM);
  });

  it('폼이 address 로 보낸 경우에도(편집 전 canonical 붕괴 이전) 같은 주소를 쓴다', async () => {
    mockGetGeocodeSnapshot.mockResolvedValue({ address: '옛 주소', hasGeo: false });
    mockGeocodeAddress.mockResolvedValue(GANGNAM);

    await updateJobPosting(
      'p1',
      { location: { name: '라운더스', address: '서울 강남구 테헤란로 152' } },
      'owner-1',
      null
    );

    expect(mockGeocodeAddress).toHaveBeenCalledWith('서울 강남구 테헤란로 152');
  });
});
