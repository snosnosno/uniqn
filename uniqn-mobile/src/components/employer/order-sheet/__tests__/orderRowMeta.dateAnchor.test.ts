/**
 * orderRowMeta — 날짜집합 앵커 좌표계 (D1/E2 · 설계 §3.9 F9, Eng F-5)
 *
 * 조건 유도 그룹핑에서는 정규화가 카드 순서를 바꾼다. 같은 렌더 사이클 안에서 계산되는
 * 좌표(에러 라우팅·제출 유도·CTA 라벨)는 인덱스로 충분하지만, **시간을 넘나드는** 좌표
 * (연쇄 예약 180ms · 시트 열림→confirm)는 인덱스가 stale 이 된다. 그 경로만 날짜집합으로
 * 기술하고 발화 시점에 현재 인덱스로 재해석한다.
 */
import { nextUnsetRowAfter, orderedRowTargets, resolveGroupIndexByDates } from '../orderRowMeta';
import type { OrderSheetFormValues } from '@/schemas/orderSheet.schema';

type Groups = NonNullable<OrderSheetFormValues['scheduleGroups']>;

const slots = (startTime: string) => [
  { startTime, roles: [{ role: 'dealer' as const, count: 1 }] },
];

const valuesWith = (scheduleGroups: Groups): OrderSheetFormValues => ({
  postingType: 'regular',
  title: '제목',
  location: { name: '장소', address: '주소', region: 'seoul-gangnam' },
  contactPhone: '010-0000-0000',
  description: '',
  scheduleGroups,
  salary: { type: 'hourly', amount: 20000 },
  useSameSalary: true,
  roleSalaries: [],
  allowances: {},
  conditions: {},
  usesPreQuestions: false,
  preQuestions: [],
});

describe('resolveGroupIndexByDates — 날짜집합으로 현재 카드 재해석', () => {
  it('카드 순서가 그대로면 같은 인덱스를 낸다', () => {
    const values = valuesWith([
      { dates: ['2026-08-10'], timeSlots: slots('19:00'), grouped: false },
      { dates: ['2026-08-12'], timeSlots: slots('21:00'), grouped: false },
    ]);
    expect(resolveGroupIndexByDates(values, ['2026-08-12'], 1)).toBe(1);
  });

  it('정규화로 카드 순서가 밀려도 날짜로 찾아낸다 (stale 인덱스 방지)', () => {
    // 시트를 열 때는 인덱스 1이었는데, 그 사이 앞에 카드가 하나 더 생겨 2로 밀린 상황
    const values = valuesWith([
      { dates: ['2026-08-01'], timeSlots: slots('18:00'), grouped: false },
      { dates: ['2026-08-10'], timeSlots: slots('19:00'), grouped: false },
      { dates: ['2026-08-12'], timeSlots: slots('21:00'), grouped: false },
    ]);
    expect(resolveGroupIndexByDates(values, ['2026-08-12'], 1)).toBe(2);
  });

  it('카드가 병합됐으면 병합된 카드를 가리킨다', () => {
    const values = valuesWith([
      { dates: ['2026-08-10', '2026-08-12'], timeSlots: slots('19:00'), grouped: false },
    ]);
    expect(resolveGroupIndexByDates(values, ['2026-08-12'], 1)).toBe(0);
  });

  it('앵커 날짜가 일부만 남아도 그 카드를 가리킨다', () => {
    const values = valuesWith([
      { dates: ['2026-08-11'], timeSlots: slots('19:00'), grouped: false },
    ]);
    expect(resolveGroupIndexByDates(values, ['2026-08-10', '2026-08-11'], 0)).toBe(0);
  });

  it('앵커 날짜가 전부 사라졌으면 null — 조용히 엉뚱한 카드에 쓰지 않는다', () => {
    const values = valuesWith([
      { dates: ['2026-08-20'], timeSlots: slots('19:00'), grouped: false },
    ]);
    expect(resolveGroupIndexByDates(values, ['2026-08-10'], 0)).toBeNull();
  });

  it('앵커가 없으면 폴백 인덱스를 쓰고, 범위를 벗어나면 null 이다', () => {
    const values = valuesWith([
      { dates: ['2026-08-10'], timeSlots: slots('19:00'), grouped: false },
    ]);
    expect(resolveGroupIndexByDates(values, undefined, 0)).toBe(0);
    expect(resolveGroupIndexByDates(values, undefined, 3)).toBeNull();
    expect(resolveGroupIndexByDates(values, [], 0)).toBe(0);
  });

  it('날짜가 없는 카드(템플릿 조건)는 폴백 인덱스로만 도달한다', () => {
    const values = valuesWith([
      { dates: [], timeSlots: slots('19:00'), grouped: false },
      { dates: [], timeSlots: slots('21:00'), grouped: false },
    ]);
    expect(resolveGroupIndexByDates(values, [], 1)).toBe(1);
  });
});

describe('행 타깃에 날짜 앵커가 실린다', () => {
  const values = valuesWith([
    { dates: ['2026-08-10'], timeSlots: slots('19:00'), grouped: false },
    { dates: ['2026-08-12'], timeSlots: [], grouped: false },
  ]);

  it('일정 행 타깃은 그 카드의 날짜집합을 함께 싣는다', () => {
    const targets = orderedRowTargets(values);
    const timeRow = targets.find((t) => t.key === 'time' && t.groupIndex === 1);
    expect(timeRow?.dates).toEqual(['2026-08-12']);
  });

  it('일정 밖 행에는 앵커가 없다 (그룹 스코프가 아니다)', () => {
    const targets = orderedRowTargets(values);
    expect(targets.find((t) => t.key === 'title')?.dates).toBeUndefined();
  });

  it('연쇄 다음 타깃도 앵커를 물고 나온다 — 180ms 뒤 재해석의 재료', () => {
    const next = nextUnsetRowAfter(values, { key: 'dates', groupIndex: 1 });
    expect(next).not.toBeNull();
    expect(next?.groupIndex).toBe(1);
    expect(next?.dates).toEqual(['2026-08-12']);
  });
});
