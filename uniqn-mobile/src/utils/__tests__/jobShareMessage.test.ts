import { buildDateLines, buildRoleLine, composeJobShareText } from '../jobShareMessage';

type ScheduleModel = Parameters<typeof buildDateLines>[0];

const URL = 'https://uniqn.app/jobs/61880654-55f1-4d78-b182-80272ca0ca94';

describe('buildDateLines', () => {
  it("TBA 시간('미정')을 유지한다 — 상세 화면·승인 프리뷰와 일치 (회귀 가드)", () => {
    const schedule = {
      variant: 'dated',
      sections: [{ label: '5/23(토)', timeSlots: [{ timeLabel: '미정', roles: [] }] }],
    } as unknown as ScheduleModel;

    expect(buildDateLines(schedule)).toEqual(['5/23(토) 미정']);
  });

  it('실제 시간은 그대로, 같은 시간 중복은 1회로', () => {
    const schedule = {
      variant: 'dated',
      sections: [
        {
          label: '5/23(토)',
          timeSlots: [
            { timeLabel: '14:00', roles: [] },
            { timeLabel: '14:00', roles: [] },
          ],
        },
      ],
    } as unknown as ScheduleModel;

    expect(buildDateLines(schedule)).toEqual(['5/23(토) 14:00']);
  });

  it('빈 시간 라벨은 날짜만', () => {
    const schedule = {
      variant: 'dated',
      sections: [{ label: '5/23(토)', timeSlots: [{ timeLabel: '', roles: [] }] }],
    } as unknown as ScheduleModel;

    expect(buildDateLines(schedule)).toEqual(['5/23(토)']);
  });

  it('fixed 변형: 요일 + 시간', () => {
    const schedule = {
      variant: 'fixed',
      fixed: { daysLabel: '주 3일', timeLabel: '오후 6시', roles: [] },
    } as unknown as ScheduleModel;

    expect(buildDateLines(schedule)).toEqual(['주 3일 오후 6시']);
  });

  it('legacy 변형: 날짜 + 시간', () => {
    const schedule = {
      variant: 'legacy',
      dateLabel: '5/23(토)',
      timeLabel: '미정',
    } as unknown as ScheduleModel;

    expect(buildDateLines(schedule)).toEqual(['5/23(토) 미정']);
  });
});

describe('buildRoleLine', () => {
  it('fixed: 역할별 확정/총원을 "라벨 확정/총원명" 으로 표시', () => {
    const schedule = {
      variant: 'fixed',
      fixed: {
        roles: [
          { label: '딜러', count: 3, filled: 1 },
          { label: '플로어', count: 2, filled: 0 },
        ],
      },
    } as unknown as ScheduleModel;

    expect(buildRoleLine(schedule)).toEqual({
      header: '딜러 플로어',
      line: '딜러 1/3명, 플로어 0/2명',
    });
  });

  it('dated: 같은 역할이 여러 날짜에 걸치면 확정·총원을 합산', () => {
    const schedule = {
      variant: 'dated',
      sections: [
        { timeSlots: [{ roles: [{ label: '딜러', count: 3, filled: 1 }] }] },
        { timeSlots: [{ roles: [{ label: '딜러', count: 3, filled: 2 }] }] },
      ],
    } as unknown as ScheduleModel;

    // filled 1+2=3, count 3+3=6
    expect(buildRoleLine(schedule).line).toBe('딜러 3/6명');
  });

  it('확정수가 0이어도 0/N 형식 유지 (fallback 일관성)', () => {
    const schedule = {
      variant: 'fixed',
      fixed: { roles: [{ label: '딜러', count: 3, filled: 0 }] },
    } as unknown as ScheduleModel;

    expect(buildRoleLine(schedule).line).toBe('딜러 0/3명');
  });
});

describe('composeJobShareText', () => {
  it('복리후생(🎁)·세금(🧾)을 급여 아래 각각 한 줄로 표시', () => {
    const text = composeJobShareText({
      title: '논현 로티하우스',
      location: '로티하우스 3층',
      dateLines: ['6/6(토) 19:00'],
      roleHeader: '딜러',
      roleLine: '딜러 1/3명',
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
      dateLines: ['6/1(일) 오후 6시'],
      roleHeader: '딜러',
      roleLine: '딜러 0/2명',
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
      dateLines: ['5/23(토) 미정'],
      roleHeader: '딜러',
      roleLine: '딜러 1/1명',
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
      dateLines: ['6/1(일) 오후 6시'],
      roleHeader: '딜러 플로어',
      roleLine: '딜러 0/2명, 플로어 1/1명',
      salary: '딜러 일급 ₩200,000, 플로어 일급 ₩180,000',
      url: URL,
    });

    const occurrences = text.split(URL).length - 1;
    expect(occurrences).toBe(1);
    expect(text).toContain('📍 서울 강남');
    expect(text).toContain('🙋 딜러 0/2명, 플로어 1/1명');
  });

  it('다중 날짜는 📅 라인을 여러 줄로 표시', () => {
    const text = composeJobShareText({
      title: '대구 토너먼트',
      location: '대구',
      dateLines: ['5/30(금) 미정', '5/31(토) 미정'],
      roleHeader: '딜러',
      roleLine: '딜러 4명',
      salary: '일급 ₩220,000',
      url: URL,
    });

    expect(text).toContain('📅 5/30(금) 미정\n📅 5/31(토) 미정');
  });

  it('역할 정보가 없으면 헤더에 "모집" 미표기 + 🙋 라인 생략', () => {
    const text = composeJobShareText({
      title: '인천 루원시티 텍사스',
      location: '인천 루원시티 텍사스',
      dateLines: ['5/23(토) 미정'],
      roleHeader: '',
      roleLine: '',
      salary: '',
      url: URL,
    });

    expect(text.startsWith('[UNIQN] 인천 루원시티 텍사스\n')).toBe(true);
    expect(text).not.toContain('모집');
    expect(text).not.toContain('🙋');
    expect(text).not.toContain('💰');
    expect(text.endsWith(`👉 지원하기\n${URL}`)).toBe(true);
  });

  it('본문 조각이 모두 비어도 헤더+CTA+url 은 항상 포함', () => {
    const text = composeJobShareText({
      title: '',
      location: '',
      dateLines: [],
      roleHeader: '',
      roleLine: '',
      salary: '',
      url: URL,
    });

    expect(text).toBe(`[UNIQN] 공고\n\n👉 지원하기\n${URL}`);
  });
});
