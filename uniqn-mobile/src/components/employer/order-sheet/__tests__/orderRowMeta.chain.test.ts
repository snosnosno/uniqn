/**
 * orderRowMeta — 연쇄 입력용 행 순회(orderedRowTargets · nextUnsetRowAfter) 단위 테스트
 *
 * 연쇄는 "전역 첫 미설정"이 아니라 "현재 다음부터 순환"이어야 한다 — 아니면 뒤쪽 행을
 * 확정했을 때 앞쪽 미설정 행으로 되돌아가 사용자가 끌려가는 느낌을 받는다.
 */
import { orderedRowTargets, nextUnsetRowAfter, firstUnsetRow } from '../orderRowMeta';
import { initialOrderSheetValues } from '@/utils/order-sheet/mappers';
import type { OrderSheetFormValues } from '@/schemas/orderSheet.schema';

/** 필수 항목이 전부 채워진 dated 폼 — 개별 테스트가 필요한 곳만 비운다 */
const filled = (): OrderSheetFormValues => ({
  ...initialOrderSheetValues(),
  title: '주말 딜러 구합니다',
  location: { name: '강남 홀덤펍', region: '서울' },
  contactPhone: '010-1234-5678',
  scheduleGroups: [
    {
      dates: ['2026-07-24'],
      timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] }],
      grouped: false,
    },
  ],
  useSameSalary: true,
  salary: { type: 'hourly', amount: 15000 },
});

describe('orderedRowTargets', () => {
  it('기본정보 4행 → 일정·모집 3행 → 급여 3행 → 조건 → 사전질문 순서로 나열한다', () => {
    const targets = orderedRowTargets(filled());
    expect(targets.map((t) => t.key)).toEqual([
      'title',
      'place',
      'contact',
      'description',
      'dates',
      'time',
      'roles',
      'salary',
      'welfare',
      'tax',
      'conditions',
      'preQuestions',
    ]);
  });

  it('일정 그룹이 2개면 일정·모집 3행이 그룹별로 반복된다', () => {
    const base = filled();
    const values: OrderSheetFormValues = {
      ...base,
      scheduleGroups: [
        ...(base.scheduleGroups ?? []),
        { dates: [], timeSlots: [], grouped: false },
      ],
    };
    const schedule = orderedRowTargets(values).filter((t) =>
      ['dates', 'time', 'roles'].includes(t.key)
    );
    expect(schedule).toEqual([
      { key: 'dates', groupIndex: 0 },
      { key: 'time', groupIndex: 0 },
      { key: 'roles', groupIndex: 0 },
      { key: 'dates', groupIndex: 1 },
      { key: 'time', groupIndex: 1 },
      { key: 'roles', groupIndex: 1 },
    ]);
  });

  it('고정(fixed) 타입은 날짜·시간 대신 근무조건 행을 낸다', () => {
    const values: OrderSheetFormValues = {
      ...initialOrderSheetValues(),
      postingType: 'fixed',
      scheduleGroups: [],
      fixedSchedule: { daysPerWeek: 5, isStartTimeNegotiable: true, roles: [] },
    };
    const keys = orderedRowTargets(values).map((t) => t.key);
    expect(keys).toContain('workConditions');
    expect(keys).not.toContain('dates');
    expect(keys).not.toContain('time');
  });
});

describe('nextUnsetRowAfter', () => {
  it('현재 행 다음의 미설정 행을 반환한다', () => {
    const values: OrderSheetFormValues = { ...filled(), contactPhone: '' };
    expect(nextUnsetRowAfter(values, { key: 'title', groupIndex: 0 })).toEqual({
      key: 'contact',
      groupIndex: 0,
    });
  });

  it('선택 항목(설명·복지·세금·조건·사전질문)은 건너뛴다', () => {
    const values: OrderSheetFormValues = { ...filled(), salary: { type: 'hourly', amount: 0 } };
    // description 은 optional 이라 건너뛰고 salary 로 간다
    expect(nextUnsetRowAfter(values, { key: 'contact', groupIndex: 0 })).toEqual({
      key: 'salary',
      groupIndex: 0,
    });
  });

  it('현재 행 뒤에 없으면 앞쪽으로 순환해서 찾는다', () => {
    const values: OrderSheetFormValues = { ...filled(), title: '' };
    expect(nextUnsetRowAfter(values, { key: 'salary', groupIndex: 0 })).toEqual({
      key: 'title',
      groupIndex: 0,
    });
  });

  it('미설정 행이 현재 행 하나뿐이면 null 을 반환한다 (연쇄 루프 차단)', () => {
    const values: OrderSheetFormValues = { ...filled(), salary: { type: 'hourly', amount: 0 } };
    expect(nextUnsetRowAfter(values, { key: 'salary', groupIndex: 0 })).toBeNull();
  });

  it('미설정 행이 하나도 없으면 null 을 반환한다', () => {
    expect(nextUnsetRowAfter(filled(), { key: 'title', groupIndex: 0 })).toBeNull();
  });

  it('일정 그룹 스코프 — 그룹0 역할 다음은 그룹1 날짜다', () => {
    const base = filled();
    const values: OrderSheetFormValues = {
      ...base,
      scheduleGroups: [
        ...(base.scheduleGroups ?? []),
        { dates: [], timeSlots: [], grouped: false },
      ],
    };
    expect(nextUnsetRowAfter(values, { key: 'roles', groupIndex: 0 })).toEqual({
      key: 'dates',
      groupIndex: 1,
    });
  });

  it('목록에 없는 current 가 들어와도 앞에서부터 훑어 첫 미설정 행을 낸다', () => {
    const values: OrderSheetFormValues = { ...filled(), title: '' };
    // fixed 전용 키를 dated 폼에 넣은 방어 케이스
    expect(nextUnsetRowAfter(values, { key: 'workConditions', groupIndex: 0 })).toEqual({
      key: 'title',
      groupIndex: 0,
    });
  });

  it('firstUnsetRow 는 기존 동작(전역 첫 미설정)을 유지한다', () => {
    const values: OrderSheetFormValues = { ...filled(), title: '', contactPhone: '' };
    expect(firstUnsetRow(values)).toEqual({ key: 'title', groupIndex: 0 });
  });

  it('그룹1의 dates 만 미설정이면 current 자신을 "다음 미설정 행"으로 되돌리지 않는다 (findIndex groupIndex 매칭 회귀 — 무한 재오픈 차단)', () => {
    // 그룹0은 전부 채워지고, 그룹1은 dates 만 비우고 timeSlots(시간·역할)는 채운다 —
    // "그룹1의 dates 만 unset" 상태를 만들어야 groupIndex 조건절의 유무가 결과를 가른다.
    const base = filled();
    const values: OrderSheetFormValues = {
      ...base,
      scheduleGroups: [
        ...(base.scheduleGroups ?? []),
        {
          dates: [],
          timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] }],
          grouped: false,
        },
      ],
    };
    // current 자신(그룹1 dates)이 유일한 미설정 행 — 한 바퀴 돌아 제자리이므로 null 이어야 한다.
    // groupIndex 조건절이 없으면 findIndex 가 그룹0의 dates(이미 set)를 currentIndex 로 오인해
    // 시작점이 어긋나고, 순환 끝에 current 자기 자신을 "다음 미설정 행"으로 잘못 반환한다.
    expect(nextUnsetRowAfter(values, { key: 'dates', groupIndex: 1 })).toBeNull();
  });
});

describe('nextUnsetRowAfter — 한 시트가 여러 행을 커버하는 경우', () => {
  /**
   * 시간·역할은 행이 둘이지만 시트는 ScheduleSlotsSheet 하나다. 확인은 항상 roles 로 보고되므로
   * current 하나만 제외하는 가드로는 time 재오픈을 못 막는다 — 같은 시트가 무한 재오픈된다.
   * (슬롯 추가 후 시간을 안 고르고 확인하면 재현: addSlot 이 startTime:'' 슬롯을 만들고
   *  확인 버튼에 disabled 가 없다.)
   */
  const slotWithoutTime = (): OrderSheetFormValues => {
    const base = filled();
    return {
      ...base,
      scheduleGroups: [
        {
          dates: ['2026-07-24'],
          timeSlots: [
            { startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] },
            { startTime: '', roles: [{ role: 'dealer', count: 1 }] },
          ],
          grouped: false,
        },
      ],
    };
  };

  it('슬롯 시트가 커버하는 행(time·roles)은 확인 직후 다시 타깃이 되지 않는다', () => {
    const values = slotWithoutTime();
    // 전제 고정 — time 이 실제로 unset 이어야 이 테스트가 공허하지 않다
    expect(nextUnsetRowAfter(values, { key: 'dates', groupIndex: 0 })).toEqual({
      key: 'time',
      groupIndex: 0,
    });

    // 슬롯 시트 확인은 roles 로 보고되지만 time 도 함께 확정한 것이다
    expect(
      nextUnsetRowAfter(values, { key: 'roles', groupIndex: 0 }, ['time', 'roles'])
    ).toBeNull();
  });

  it('커버 범위는 같은 그룹에만 적용된다 — 다른 그룹의 동일 행은 여전히 타깃이다', () => {
    const base = slotWithoutTime();
    const values: OrderSheetFormValues = {
      ...base,
      scheduleGroups: [
        ...(base.scheduleGroups ?? []),
        {
          dates: ['2026-07-25'],
          timeSlots: [{ startTime: '', roles: [{ role: 'dealer', count: 1 }] }],
          grouped: false,
        },
      ],
    };
    expect(nextUnsetRowAfter(values, { key: 'roles', groupIndex: 0 }, ['time', 'roles'])).toEqual({
      key: 'time',
      groupIndex: 1,
    });
  });

  it('coveredKeys 를 안 넘기면 기존 동작(current 만 제외)을 유지한다', () => {
    expect(nextUnsetRowAfter(slotWithoutTime(), { key: 'roles', groupIndex: 0 })).toEqual({
      key: 'time',
      groupIndex: 0,
    });
  });
});

describe('nextUnsetRowAfter — 일정 행도 정상 타깃(확정자 잠금 폐지)', () => {
  /**
   * 옛 계약에는 `skipKeys` 인자가 있어 scheduleLocked 시 일정·역할 행을 순회에서 제외했다.
   * 잠금이 사라지면서 인자도 함께 제거됐다 — 미설정 일정 행은 예외 없이 다음 타깃이 된다.
   */
  it('미설정 dates 가 다음 타깃이 된다', () => {
    const base = filled();
    const values: OrderSheetFormValues = {
      ...base,
      scheduleGroups: [{ ...(base.scheduleGroups ?? [])[0]!, dates: [] }],
      salary: { type: 'hourly', amount: 0 },
    };
    expect(nextUnsetRowAfter(values, { key: 'contact', groupIndex: 0 })).toEqual({
      key: 'dates',
      groupIndex: 0,
    });
  });

  it('다른 그룹의 미설정 dates 도 타깃이 된다', () => {
    const base = filled();
    const values: OrderSheetFormValues = {
      ...base,
      scheduleGroups: [
        ...(base.scheduleGroups ?? []),
        {
          dates: [],
          timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] }],
          grouped: false,
        },
      ],
    };
    expect(nextUnsetRowAfter(values, { key: 'roles', groupIndex: 0 }, ['time', 'roles'])).toEqual({
      key: 'dates',
      groupIndex: 1,
    });
  });
});
