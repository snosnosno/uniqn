import { buildDateLines, composeJobShareText } from '../jobShareMessage';

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

describe('composeJobShareText', () => {
  it('스크린샷 케이스: 제목=근무지면 위치 라인 생략 + 일정·역할·급여 포함', () => {
    const text = composeJobShareText({
      title: '인천 루원시티 텍사스',
      location: '인천 루원시티 텍사스',
      dateLines: ['5/23(토) 미정'],
      roleHeader: '딜러',
      roleLine: '딜러 1명',
      salary: '일급 ₩200,000',
      url: URL,
    });

    expect(text).toBe(
      [
        '[UNIQN] 인천 루원시티 텍사스 딜러 모집',
        '',
        '📅 5/23(토) 미정',
        '🙋 딜러 1명 모집',
        '💰 일급 ₩200,000',
        '',
        '👉 지원하기',
        URL,
      ].join('\n')
    );
    // 위치 라인 생략 확인
    expect(text).not.toContain('📍');
  });

  it('url 은 정확히 한 번만 포함된다 (중복 미리보기 방지)', () => {
    const text = composeJobShareText({
      title: '강남 홀덤펍',
      location: '서울 강남',
      dateLines: ['6/1(일) 오후 6시'],
      roleHeader: '딜러 플로어',
      roleLine: '딜러 2명, 플로어 1명',
      salary: '딜러 일급 ₩200,000, 플로어 일급 ₩180,000',
      url: URL,
    });

    const occurrences = text.split(URL).length - 1;
    expect(occurrences).toBe(1);
    expect(text).toContain('📍 서울 강남');
    expect(text).toContain('🙋 딜러 2명, 플로어 1명 모집');
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
