import { aggregateRoles, buildScheduleBlocks, composeJobShareText } from '../jobShareMessage';

type ScheduleModel = Parameters<typeof buildScheduleBlocks>[0];
type RoleArg = Parameters<typeof aggregateRoles>[0];

const URL = 'https://uniqn.app/jobs/61880654-55f1-4d78-b182-80272ca0ca94';

describe('aggregateRoles', () => {
  it('역할별 확정/총원을 "라벨 확정/총원명" 으로 표시', () => {
    expect(
      aggregateRoles([
        { label: '딜러', count: 3, filled: 1 },
        { label: '플로어', count: 2, filled: 0 },
      ] as unknown as RoleArg)
    ).toEqual({
      header: '딜러 플로어',
      line: '딜러 1/3명, 플로어 0/2명',
    });
  });

  it('같은 역할은 확정·총원을 합산 (등장 순서 유지)', () => {
    expect(
      aggregateRoles([
        { label: '딜러', count: 3, filled: 1 },
        { label: '딜러', count: 3, filled: 2 },
      ] as unknown as RoleArg).line
    ).toBe('딜러 3/6명');
  });

  it('확정수가 0이어도 0/N 형식 유지 (fallback 일관성)', () => {
    expect(
      aggregateRoles([{ label: '딜러', count: 3, filled: 0 }] as unknown as RoleArg).line
    ).toBe('딜러 0/3명');
  });
});

describe('buildScheduleBlocks', () => {
  it('dated: 날짜/시간대별로 역할을 분해 — 날짜별 역할 페어링 (스크린샷 회귀 가드)', () => {
    // 실제 공고: 7/15 10:00 딜러 2명 플로어 1명 / 7/16 11:00 딜러 3명
    const schedule = {
      variant: 'dated',
      sections: [
        {
          label: '7/15(수)',
          timeSlots: [
            {
              timeLabel: '10:00',
              roles: [
                { label: '딜러', count: 2, filled: 0 },
                { label: '플로어', count: 1, filled: 0 },
              ],
            },
          ],
        },
        {
          label: '7/16(목)',
          timeSlots: [{ timeLabel: '11:00', roles: [{ label: '딜러', count: 3, filled: 0 }] }],
        },
      ],
    } as unknown as ScheduleModel;

    const { blocks, header } = buildScheduleBlocks(schedule);
    expect(blocks).toEqual([
      { dateLabel: '7/15(수) 10:00', roleLine: '딜러 0/2명, 플로어 0/1명' },
      { dateLabel: '7/16(목) 11:00', roleLine: '딜러 0/3명' },
    ]);
    // header 는 전체 역할 종류 (라벨 집합) — 날짜 무관 인원 합산이 아님
    expect(header).toBe('딜러 플로어');
  });

  it("dated: TBA 시간('미정')을 유지", () => {
    const schedule = {
      variant: 'dated',
      sections: [{ label: '5/23(토)', timeSlots: [{ timeLabel: '미정', roles: [] }] }],
    } as unknown as ScheduleModel;

    expect(buildScheduleBlocks(schedule).blocks).toEqual([
      { dateLabel: '5/23(토) 미정', roleLine: '' },
    ]);
  });

  it('dated: 빈 시간 라벨은 날짜만', () => {
    const schedule = {
      variant: 'dated',
      sections: [
        {
          label: '5/23(토)',
          timeSlots: [{ timeLabel: '', roles: [{ label: '딜러', count: 1, filled: 1 }] }],
        },
      ],
    } as unknown as ScheduleModel;

    expect(buildScheduleBlocks(schedule).blocks).toEqual([
      { dateLabel: '5/23(토)', roleLine: '딜러 1/1명' },
    ]);
  });

  it('fixed: 요일 + 시간 단일 블록', () => {
    const schedule = {
      variant: 'fixed',
      fixed: {
        daysLabel: '주 3일',
        timeLabel: '오후 6시',
        roles: [
          { label: '딜러', count: 3, filled: 1 },
          { label: '플로어', count: 2, filled: 0 },
        ],
      },
    } as unknown as ScheduleModel;

    const { blocks, header } = buildScheduleBlocks(schedule);
    expect(blocks).toEqual([
      { dateLabel: '주 3일 오후 6시', roleLine: '딜러 1/3명, 플로어 0/2명' },
    ]);
    expect(header).toBe('딜러 플로어');
  });

  it('legacy: 날짜 + 시간 블록 (역할 라인 없음)', () => {
    const schedule = {
      variant: 'legacy',
      dateLabel: '5/23(토)',
      timeLabel: '미정',
    } as unknown as ScheduleModel;

    expect(buildScheduleBlocks(schedule).blocks).toEqual([
      { dateLabel: '5/23(토) 미정', roleLine: '' },
    ]);
  });
});

describe('composeJobShareText', () => {
  it('날짜별 역할을 "📅 날짜 → 🙋 역할" 로 짝지어 표시 (다중 날짜)', () => {
    const text = composeJobShareText({
      title: '테스트',
      location: '강남구',
      scheduleBlocks: [
        { dateLabel: '7/15(수) 10:00', roleLine: '딜러 0/2명, 플로어 0/1명' },
        { dateLabel: '7/16(목) 11:00', roleLine: '딜러 0/3명' },
      ],
      roleHeader: '딜러 플로어',
      salary: '딜러 시급 ₩20,000, 플로어 시급 ₩30,000',
      url: URL,
    });

    expect(text).toContain('[UNIQN] 테스트 딜러 플로어 모집');
    expect(text).toContain('📅 7/15(수) 10:00\n🙋 딜러 0/2명, 플로어 0/1명');
    expect(text).toContain('📅 7/16(목) 11:00\n🙋 딜러 0/3명');
    // 각 날짜 블록이 독립 — 7/15 가 7/16 보다 먼저
    expect(text.indexOf('7/15')).toBeLessThan(text.indexOf('7/16'));
  });

  it('복리후생(🎁)·세금(🧾)을 급여 아래 각각 한 줄로 표시', () => {
    const text = composeJobShareText({
      title: '논현 로티하우스',
      location: '로티하우스 3층',
      scheduleBlocks: [{ dateLabel: '6/6(토) 19:00', roleLine: '딜러 1/3명' }],
      roleHeader: '딜러',
      salary: '딜러 시급 ₩20,000',
      allowanceLabels: ['보장 8시간', '식사제공', '교통비 10,000원'],
      taxLabel: '세금 3.3%',
      url: URL,
    });

    expect(text).toContain('[UNIQN] 논현 로티하우스 딜러 모집');
    expect(text).toContain('🙋 딜러 1/3명');
    expect(text).toContain('🎁 보장 8시간 · 식사제공 · 교통비 10,000원');
    expect(text).toContain('🧾 세금 3.3%');
    // 순서: 급여 → 복리후생 → 세금
    expect(text.indexOf('💰')).toBeLessThan(text.indexOf('🎁'));
    expect(text.indexOf('🎁')).toBeLessThan(text.indexOf('🧾'));
  });

  it('복리후생만 있고 세금이 없으면 🧾 라인 생략', () => {
    const text = composeJobShareText({
      title: '강남 홀덤펍',
      location: '서울 강남',
      scheduleBlocks: [{ dateLabel: '6/1(일) 오후 6시', roleLine: '딜러 0/2명' }],
      roleHeader: '딜러',
      salary: '시급 ₩20,000',
      allowanceLabels: ['식사제공'],
      url: URL,
    });

    expect(text).toContain('🎁 식사제공');
    expect(text).not.toContain('🧾');
  });

  it('스크린샷 케이스: 제목=근무지면 위치 라인 생략 + 일정·역할·급여 포함', () => {
    const text = composeJobShareText({
      title: '인천 루원시티 텍사스',
      location: '인천 루원시티 텍사스',
      scheduleBlocks: [{ dateLabel: '5/23(토) 미정', roleLine: '딜러 1/1명' }],
      roleHeader: '딜러',
      salary: '일급 ₩200,000',
      url: URL,
    });

    expect(text).toBe(
      [
        '[UNIQN] 인천 루원시티 텍사스 딜러 모집',
        '',
        '📅 5/23(토) 미정',
        '🙋 딜러 1/1명',
        '💰 일급 ₩200,000',
        '',
        '👉 지원하기',
        URL,
      ].join('\n')
    );
    // 위치 라인 생략 확인
    expect(text).not.toContain('📍');
    // 🙋 현황 라인에는 '모집' 미표기 (헤더에만 유지)
    expect(text).not.toContain('🙋 딜러 1/1명 모집');
    // 복리후생·세금 미전달 시 라인 생략
    expect(text).not.toContain('🎁');
    expect(text).not.toContain('🧾');
  });

  it('url 은 정확히 한 번만 포함된다 (중복 미리보기 방지)', () => {
    const text = composeJobShareText({
      title: '강남 홀덤펍',
      location: '서울 강남',
      scheduleBlocks: [{ dateLabel: '6/1(일) 오후 6시', roleLine: '딜러 0/2명, 플로어 1/1명' }],
      roleHeader: '딜러 플로어',
      salary: '딜러 일급 ₩200,000, 플로어 일급 ₩180,000',
      url: URL,
    });

    const occurrences = text.split(URL).length - 1;
    expect(occurrences).toBe(1);
    expect(text).toContain('📍 서울 강남');
    expect(text).toContain('🙋 딜러 0/2명, 플로어 1/1명');
  });

  it('역할 라인이 없으면 🙋 생략 + 헤더에 "모집" 미표기, 날짜만 표시', () => {
    const text = composeJobShareText({
      title: '인천 루원시티 텍사스',
      location: '인천 루원시티 텍사스',
      scheduleBlocks: [{ dateLabel: '5/23(토) 미정', roleLine: '' }],
      roleHeader: '',
      salary: '',
      url: URL,
    });

    expect(text.startsWith('[UNIQN] 인천 루원시티 텍사스\n')).toBe(true);
    expect(text).toContain('📅 5/23(토) 미정');
    expect(text).not.toContain('모집');
    expect(text).not.toContain('🙋');
    expect(text).not.toContain('💰');
    expect(text.endsWith(`👉 지원하기\n${URL}`)).toBe(true);
  });

  it('본문 조각이 모두 비어도 헤더+CTA+url 은 항상 포함', () => {
    const text = composeJobShareText({
      title: '',
      location: '',
      scheduleBlocks: [],
      roleHeader: '',
      salary: '',
      url: URL,
    });

    expect(text).toBe(`[UNIQN] 공고\n\n👉 지원하기\n${URL}`);
  });
});
