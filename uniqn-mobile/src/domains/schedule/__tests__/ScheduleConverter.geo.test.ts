/**
 * ScheduleConverter — 근무지 좌표 전달 회귀 가드 (주소 검색 2단계 B2).
 *
 * 좌표는 공고(job_postings.geo_lat/geo_lng)에만 있고, 그걸 쓰는 화면은 스태프 스케줄 상세다.
 * 그 사이를 잇는 유일한 통로가 이 컨버터라 여기서 끊기면 **DB·EF·링크 빌더가 다 멀쩡한데도**
 * 길찾기가 계속 텍스트 검색으로 남는다 — 아무 데도 에러가 안 나는 종류의 실패다.
 *
 * 지점 컨테이너 경로에는 좌표가 없다(공고가 아니라 컨테이너라 지오코딩 대상이 아니다).
 * 그때는 종전대로 주소 텍스트 폴백이며, 그것도 여기서 고정한다.
 */
import { ScheduleConverter, createSchedulePostingContext } from '../ScheduleConverter';
import type { JobPosting, WorkLog } from '@/types';

// 실측값(2026-08-03 prod 지오코딩): '서울 강남구 테헤란로 152'
const GANGNAM = { lat: 37.5000242405515, lng: 127.036508620542 };

function createPosting(overrides: Partial<JobPosting> = {}): JobPosting {
  return {
    id: 'job-1',
    schemaVersion: 3,
    title: '포커 이벤트',
    ownerId: 'owner-1',
    workDate: '2025-01-15',
    workDates: ['2025-01-15'],
    totalPositions: 1,
    filledPositions: 0,
    status: 'active',
    location: { name: '라운더스', district: '서울 강남구 테헤란로 152' },
    schedule: {
      kind: 'dated',
      primaryDate: '2025-01-15',
      allDates: ['2025-01-15'],
      requirements: [
        {
          date: '2025-01-15',
          timeSlots: [
            { id: 'slot-1', startTime: '09:00', roles: [{ id: 'r1', role: 'dealer', count: 1 }] },
          ],
        },
      ],
    },
    roleCatalog: [{ role: 'dealer', salary: { type: 'hourly', amount: 13000 } }],
    compensation: { mode: 'shared', defaultSalary: { type: 'hourly', amount: 13000 } },
    questions: { items: [] },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as JobPosting;
}

function createWorkLog(): WorkLog {
  return {
    id: 'wl-1',
    staffId: 'staff-1',
    jobPostingId: 'job-1',
    date: '2025-01-15',
    status: 'scheduled',
    role: 'dealer',
    timeSlot: '09:00~18:00',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as WorkLog;
}

describe('createSchedulePostingContext — 좌표', () => {
  it('공고 좌표를 컨텍스트로 옮긴다', () => {
    const context = createSchedulePostingContext(
      createPosting({ geoLat: GANGNAM.lat, geoLng: GANGNAM.lng })
    );

    expect(context.coordinates).toEqual({ lat: GANGNAM.lat, lng: GANGNAM.lng });
  });

  it('좌표 없는 공고는 컨텍스트에도 좌표가 없다(주소 텍스트 폴백)', () => {
    expect(createSchedulePostingContext(createPosting()).coordinates).toBeUndefined();
  });

  it('🔴 반쪽 좌표는 싣지 않는다 — 링크를 못 만들 뿐 아니라 DB 도 짝을 강제한다', () => {
    const context = createSchedulePostingContext(createPosting({ geoLat: GANGNAM.lat }));

    expect(context.coordinates).toBeUndefined();
  });
});

describe('ScheduleConverter — 좌표가 이벤트까지 도달한다', () => {
  it('work_log 경로에서 좌표를 잇는다', () => {
    const context = createSchedulePostingContext(
      createPosting({ geoLat: GANGNAM.lat, geoLng: GANGNAM.lng })
    );
    const event = ScheduleConverter.workLogToScheduleEvent(createWorkLog(), context);

    expect(event.coordinates).toEqual({ lat: GANGNAM.lat, lng: GANGNAM.lng });
  });

  it('공고 컨텍스트가 아예 없으면 좌표도 없다', () => {
    const event = ScheduleConverter.workLogToScheduleEvent(createWorkLog());

    expect(event.coordinates).toBeUndefined();
  });
});
