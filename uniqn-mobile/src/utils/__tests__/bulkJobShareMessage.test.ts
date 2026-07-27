import {
  buildBulkJobShareText,
  buildBulkShareItem,
  composeBulkJobShareText,
  isRedundantLocation,
  sortJobsForBulkShare,
  summarizeSchedule,
  type BulkShareItem,
} from '../bulkJobShareMessage';
import type { JobPosting } from '@/types';

type ScheduleModel = Parameters<typeof summarizeSchedule>[0];

const item = (overrides: Partial<BulkShareItem> = {}): BulkShareItem => ({
  title: '강남 홀덤펍',
  location: '',
  scheduleLabel: '7/29(수) 18:00',
  roleLine: '딜러 1/4명',
  salary: '일급 ₩150,000',
  url: 'https://uniqn.app/jobs/p1',
  ...overrides,
});

// ============================================================================
// summarizeSchedule
// ============================================================================

describe('summarizeSchedule', () => {
  it('dated 1일: 날짜+시간 그대로, 역할은 합산', () => {
    const schedule = {
      variant: 'dated',
      sections: [
        {
          label: '7/29(수)',
          timeSlots: [
            {
              timeLabel: '18:00',
              roles: [
                { label: '딜러', count: 4, filled: 1 },
                { label: '플로어', count: 1, filled: 0 },
              ],
            },
          ],
        },
      ],
    } as unknown as ScheduleModel;

    expect(summarizeSchedule(schedule)).toEqual({
      scheduleLabel: '7/29(수) 18:00',
      roleLine: '딜러 1/4명, 플로어 0/1명',
    });
  });

  it('dated 2일: 두 날짜를 그대로 나열 (접지 않음)', () => {
    const schedule = {
      variant: 'dated',
      sections: [
        { label: '7/29(수)', timeSlots: [{ timeLabel: '18:00', roles: [] }] },
        { label: '7/30(목)', timeSlots: [{ timeLabel: '18:00', roles: [] }] },
      ],
    } as unknown as ScheduleModel;

    expect(summarizeSchedule(schedule).scheduleLabel).toBe('7/29(수) 18:00, 7/30(목) 18:00');
  });

  it('dated 3일 이상: "첫날 외 N일" 로 접고 인원은 전 날짜 합산', () => {
    const schedule = {
      variant: 'dated',
      sections: ['8/3(월)', '8/4(화)', '8/5(수)', '8/6(목)', '8/7(금)'].map((label) => ({
        label,
        timeSlots: [{ timeLabel: '11:00', roles: [{ label: '딜러', count: 5, filled: 1 }] }],
      })),
    } as unknown as ScheduleModel;

    expect(summarizeSchedule(schedule)).toEqual({
      // N 은 블록(날짜×시간대) 수가 아니라 날짜 수여야 한다
      scheduleLabel: '8/3(월) 11:00 외 4일',
      roleLine: '딜러 5/25명',
    });
  });

  it('하루에 시간대가 여러 개면 "시간대 N개" 로 대체', () => {
    const schedule = {
      variant: 'dated',
      sections: [
        {
          label: '8/1(토)',
          timeSlots: [
            { timeLabel: '14:00', roles: [{ label: '딜러', count: 1, filled: 0 }] },
            { timeLabel: '20:00', roles: [{ label: '딜러', count: 2, filled: 0 }] },
          ],
        },
      ],
    } as unknown as ScheduleModel;

    expect(summarizeSchedule(schedule)).toEqual({
      scheduleLabel: '8/1(토) 시간대 2개',
      roleLine: '딜러 0/3명',
    });
  });

  it('fixed: 요일 라벨 + 시간 + 역할 합산', () => {
    const schedule = {
      variant: 'fixed',
      fixed: {
        daysLabel: '매주 화·목',
        timeLabel: '18:00~24:00',
        roles: [{ label: '딜러', count: 2, filled: 1 }],
      },
    } as unknown as ScheduleModel;

    expect(summarizeSchedule(schedule)).toEqual({
      scheduleLabel: '매주 화·목 18:00~24:00',
      roleLine: '딜러 1/2명',
    });
  });

  it('legacy: 날짜/시간만, 역할 라인 없음', () => {
    const schedule = {
      variant: 'legacy',
      dateLabel: '7/29(수)',
      timeLabel: '18:00',
    } as unknown as ScheduleModel;

    expect(summarizeSchedule(schedule)).toEqual({ scheduleLabel: '7/29(수) 18:00', roleLine: '' });
  });
});

// ============================================================================
// isRedundantLocation
// ============================================================================

describe('isRedundantLocation', () => {
  it('근무지가 제목으로 시작하면 중복 (상세주소가 덧붙은 흔한 경우)', () => {
    expect(isRedundantLocation('강남 홀덤펍 역삼동 123-4', '강남 홀덤펍')).toBe(true);
  });

  it('제목이 근무지로 시작해도 중복', () => {
    expect(isRedundantLocation('강남 홀덤펍', '강남 홀덤펍 주말 딜러')).toBe(true);
  });

  it('겹치지 않으면 유지', () => {
    expect(isRedundantLocation('코엑스 이벤트홀 삼성동', 'UNIQN 서울 챔피언십')).toBe(false);
  });

  it('빈 값은 중복 아님 (라인 생략은 호출부 책임)', () => {
    expect(isRedundantLocation('', '강남 홀덤펍')).toBe(false);
  });
});

// ============================================================================
// composeBulkJobShareText
// ============================================================================

describe('composeBulkJobShareText', () => {
  it('헤더에 건수를 표기하고 항목을 번호로 나열', () => {
    const text = composeBulkJobShareText([item(), item({ title: '홍대 라운지' })]);
    expect(text).toContain('[UNIQN] 공고 2건 모집');
    expect(text).toContain('1. 강남 홀덤펍');
    expect(text).toContain('2. 홍대 라운지');
  });

  it('빈 값 라인은 통째로 생략 (링크는 항상 포함)', () => {
    const text = composeBulkJobShareText([
      item({ location: '', roleLine: '', salary: '', scheduleLabel: '' }),
    ]);
    expect(text).not.toContain('📍');
    expect(text).not.toContain('🙋');
    expect(text).not.toContain('💰');
    expect(text).not.toContain('📅');
    expect(text).toContain('👉 https://uniqn.app/jobs/p1');
  });

  it('근무지가 있으면 📍 라인을 노출', () => {
    expect(composeBulkJobShareText([item({ location: '코엑스 이벤트홀' })])).toContain(
      '📍 코엑스 이벤트홀'
    );
  });

  it('길이 상한을 넘으면 초과분을 잘라내고 "외 N건" 안내', () => {
    const text = composeBulkJobShareText([item(), item(), item()], { maxChars: 130 });
    expect(text).toContain('1. 강남 홀덤펍');
    expect(text).not.toContain('3. 강남 홀덤펍');
    expect(text).toContain('…외 2건은 앱에서 확인해주세요');
  });

  it('상한이 아무리 작아도 최소 1건은 포함 (빈 메시지 전송 방지)', () => {
    const text = composeBulkJobShareText([item(), item()], { maxChars: 1 });
    expect(text).toContain('1. 강남 홀덤펍');
    expect(text).toContain('…외 1건은 앱에서 확인해주세요');
  });
});

// ============================================================================
// 정렬 / 진입점
// ============================================================================

/**
 * 근무일 하나짜리 공고 픽스처. workDate 와 schedule 날짜를 함께 맞춘다 —
 * 둘을 따로 두면 정렬 근거(구조화된 schedule 우선)와 어긋난 픽스처가 만들어진다.
 */
const posting = (date: string, overrides: Partial<JobPosting> = {}): JobPosting =>
  ({
    schemaVersion: 3,
    id: 'p1',
    title: '공고',
    status: 'active',
    ownerId: 'owner-1',
    totalPositions: 1,
    filledPositions: 0,
    questions: { items: [] },
    location: { name: '강남 홀덤펍', district: '강남구', detailedAddress: '역삼동 123-4' },
    workDate: date,
    roleCatalog: [{ role: 'dealer', salary: { type: 'daily', amount: 150000 } }],
    schedule: {
      kind: 'dated',
      primaryDate: date,
      allDates: [date],
      requirements: [
        {
          date,
          timeSlots: [{ startTime: '18:00', roles: [{ role: 'dealer', count: 4 }] }],
        },
      ],
    },
    compensation: {
      mode: 'same',
      defaultSalary: { type: 'daily', amount: 150000 },
      taxSettings: { type: 'rate', value: 3.3 },
    },
    ...overrides,
  }) as unknown as JobPosting;

describe('sortJobsForBulkShare', () => {
  it('근무일 오름차순 (선택 순서가 아니라 날짜순)', () => {
    const sorted = sortJobsForBulkShare([
      posting('2026-08-03', { id: 'c' }),
      posting('2026-07-29', { id: 'a' }),
      posting('2026-08-01', { id: 'b' }),
    ]);
    expect(sorted.map((job) => job.id)).toEqual(['a', 'b', 'c']);
  });

  it('같은 날짜면 제목 사전순', () => {
    const sorted = sortJobsForBulkShare([
      posting('2026-08-03', { id: 'na', title: '나 공고' }),
      posting('2026-08-03', { id: 'ga', title: '가 공고' }),
    ]);
    expect(sorted.map((job) => job.id)).toEqual(['ga', 'na']);
  });

  it('근무일 없는 공고는 뒤로', () => {
    const sorted = sortJobsForBulkShare([
      posting('2026-08-03', {
        id: 'none',
        workDate: undefined,
        workDates: undefined,
        schedule: undefined,
      }),
      posting('2026-08-03', { id: 'dated' }),
    ]);
    expect(sorted.map((job) => job.id)).toEqual(['dated', 'none']);
  });
});

describe('buildBulkJobShareText', () => {
  const urlOf = (id: string) => `https://uniqn.app/jobs/${id}`;

  it('실제 파생 모델로 압축 본문을 만들고 날짜순으로 정렬', () => {
    const text = buildBulkJobShareText(
      [
        posting('2026-08-03', { id: 'later', title: '2번' }),
        posting('2026-07-29', { id: 'earlier', title: '1번' }),
      ],
      urlOf
    );

    expect(text).toContain('[UNIQN] 공고 2건 모집');
    expect(text.indexOf('1. 1번')).toBeLessThan(text.indexOf('2. 2번'));
    expect(text).toContain('🙋 딜러 0/4명');
  });

  it('확정 인원 맵을 주입하면 확정/총원으로 표시', () => {
    const text = buildBulkJobShareText([posting('2026-07-29', { id: 'p1' })], urlOf, () =>
      // 키는 `date__slot__role` (공고 접두 제거된 서브맵)
      new Map([['2026-07-29__18:00__dealer', 2]])
    );
    expect(text).toContain('🙋 딜러 2/4명');
  });
});

describe('buildBulkShareItem', () => {
  it('파생이 실패해도 제목·링크만 담아 공유를 이어간다', () => {
    // schedule/compensation 이 깨진 공고 — buildPostingFacts 단계에서 throw
    const broken = { id: 'x', title: '깨진 공고' } as unknown as JobPosting;
    expect(buildBulkShareItem(broken, 'https://uniqn.app/jobs/x')).toEqual({
      title: '깨진 공고',
      location: '',
      scheduleLabel: '',
      roleLine: '',
      salary: '',
      url: 'https://uniqn.app/jobs/x',
    });
  });
});
