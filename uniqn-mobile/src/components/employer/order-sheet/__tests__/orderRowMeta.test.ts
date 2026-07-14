import { zodResolver } from '@hookform/resolvers/zod';
import {
  getRowState,
  firstUnsetRow,
  ORDER_GROUPS,
  errorRowTargets,
  errorMessageForRow,
  summarizeGroupDates,
} from '../orderRowMeta';
import { orderSheetValuesSchema } from '@/schemas/orderSheet.schema';
import type { OrderSheetFormValues } from '@/schemas/orderSheet.schema';

const emptyValues: OrderSheetFormValues = {
  postingType: 'regular',
  title: '',
  location: null,
  contactPhone: '010-1234-5678',
  description: '',
  scheduleGroups: [{ dates: [], timeSlots: [], grouped: false }],
  salary: { type: 'hourly', amount: 0 },
  useSameSalary: true,
  roleSalaries: [],
  allowances: {},
  conditions: {},
  usesPreQuestions: false,
  preQuestions: [],
};
const filled: OrderSheetFormValues = {
  ...emptyValues,
  title: '주말 딜러 구합니다',
  // 지역 필수(2026-07-15) — 완성 픽스처는 유효 slug 를 포함해야 place 행이 set 된다(H5)
  location: { name: '라운더스 홀덤펍', region: '서울 강남구' },
  scheduleGroups: [
    {
      dates: ['2026-07-14'],
      timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] }],
      grouped: false,
    },
  ],
  salary: { type: 'hourly', amount: 20000 },
};

const twoGroups: OrderSheetFormValues = {
  ...filled,
  scheduleGroups: [
    {
      dates: ['2026-07-14'],
      timeSlots: [{ startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] }],
      grouped: false,
    },
    {
      dates: ['2026-07-20', '2026-07-21'],
      timeSlots: [{ startTime: '21:00', roles: [{ role: 'floor', count: 1 }] }],
      grouped: true,
    },
  ],
};

describe('ORDER_GROUPS', () => {
  it('그룹 순서 = 기본정보 → 일정·모집 → 급여 → 조건 → 사전질문', () => {
    expect(ORDER_GROUPS.map((g) => g.title)).toEqual([
      '기본 정보',
      '일정 · 모집',
      '급여',
      '조건',
      '사전질문',
    ]);
  });
});

describe('getRowState (그룹 스코프 — S1)', () => {
  it('필수 미입력 행은 unset=true', () => {
    expect(getRowState(emptyValues, 'title').unset).toBe(true);
    expect(getRowState(emptyValues, 'dates').unset).toBe(true);
  });
  it('선택 행은 값 없어도 unset=false, value="없음"', () => {
    const s = getRowState(emptyValues, 'welfare');
    expect(s.unset).toBe(false);
    expect(s.value).toBe('없음');
    expect(s.optional).toBe(true);
  });
  it('역할 요약은 "딜러 2" 형식으로 합산 표기', () => {
    expect(getRowState(filled, 'roles').value).toBe('딜러 2');
  });
  it('시간 요약은 "출근 19:00"', () => {
    expect(getRowState(filled, 'time').value).toBe('출근 19:00');
  });
  it('연락처는 프로필 프리필이 있으면 unset=false', () => {
    expect(getRowState(emptyValues, 'contact').unset).toBe(false);
  });
  it('groupIndex로 해당 그룹의 일정 행만 판정한다', () => {
    expect(getRowState(twoGroups, 'time', 1).value).toBe('출근 21:00');
    expect(getRowState(twoGroups, 'roles', 1).value).toBe('플로어 1');
    expect(getRowState(twoGroups, 'dates', 1).unset).toBe(false);
    // 그룹1이 채워져도 그룹0 스코프 판정은 독립
    const g0Empty = {
      ...twoGroups,
      scheduleGroups: [
        { dates: [] as string[], timeSlots: [], grouped: false },
        twoGroups.scheduleGroups![1]!,
      ],
    };
    expect(getRowState(g0Empty, 'dates', 0).unset).toBe(true);
    expect(getRowState(g0Empty, 'dates', 1).unset).toBe(false);
  });
  it('빈 startTime 슬롯이 하나라도 있으면 해당 그룹 time 행은 unset (죽은 등록버튼 방지 — H5)', () => {
    const partial: OrderSheetFormValues = {
      ...filled,
      scheduleGroups: [
        {
          dates: ['2026-07-14'],
          timeSlots: [
            { startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] },
            { startTime: '', roles: [{ role: 'dealer', count: 1 }] },
          ],
          grouped: false,
        },
      ],
    };
    expect(getRowState(partial, 'time').unset).toBe(true);
  });
  it('역할 없는 슬롯이 하나라도 있으면 해당 그룹 roles 행은 unset', () => {
    const partial: OrderSheetFormValues = {
      ...filled,
      scheduleGroups: [
        {
          dates: ['2026-07-14'],
          timeSlots: [
            { startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] },
            { startTime: '21:00', roles: [] },
          ],
          grouped: false,
        },
      ],
    };
    expect(getRowState(partial, 'roles').unset).toBe(true);
  });
  it("협의(other) 급여는 '협의'로 표기되고 unset=false", () => {
    const s = getRowState({ ...filled, salary: { type: 'other', amount: 0 } }, 'salary');
    expect(s.unset).toBe(false);
    expect(s.value).toBe('협의');
  });
  it('by_role인데 급여 없는 역할이 있으면 salary 행은 unset', () => {
    const byRole = { ...filled, useSameSalary: false, roleSalaries: [] };
    expect(getRowState(byRole, 'salary').unset).toBe(true);
  });
  it('useSameSalary 미지정(undefined)은 by_role로 판정한다 — zod 기본값 false와 3자 일치(Eng-H2)', () => {
    const { useSameSalary: _omit, ...rest } = filled;
    expect(getRowState(rest, 'salary').unset).toBe(true);
  });
  it('by_role 커버 판정·요약은 전 그룹 순회 합집합이다', () => {
    const byRole: OrderSheetFormValues = {
      ...twoGroups,
      useSameSalary: false,
      roleSalaries: [
        { role: 'dealer', salary: { type: 'hourly', amount: 20000 } },
        { role: 'floor', salary: { type: 'hourly', amount: 30000 } },
      ],
    };
    const s = getRowState(byRole, 'salary');
    expect(s.unset).toBe(false);
    expect(s.value).toBe('딜러 20,000 · 플로어 30,000');
    // 그룹1(floor) 미커버면 unset
    const partial = { ...byRole, roleSalaries: [byRole.roleSalaries![0]!] };
    expect(getRowState(partial, 'salary').unset).toBe(true);
  });
  it('by_role 역할 3개+면 첫 항목 + 개수 축약 (금액 truncation 금지 — impeccable §26)', () => {
    const byRole: OrderSheetFormValues = {
      ...filled,
      useSameSalary: false,
      scheduleGroups: [
        {
          dates: ['2026-07-14'],
          timeSlots: [
            {
              startTime: '19:00',
              roles: [
                { role: 'dealer', count: 2 },
                { role: 'floor', count: 1 },
                { role: 'serving', count: 1 },
              ],
            },
          ],
          grouped: false,
        },
      ],
      roleSalaries: [
        { role: 'dealer', salary: { type: 'hourly', amount: 20000 } },
        { role: 'floor', salary: { type: 'hourly', amount: 30000 } },
        { role: 'serving', salary: { type: 'hourly', amount: 20000 } },
      ],
    };
    expect(getRowState(byRole, 'salary').value).toBe('딜러 20,000 외 2개 역할');
  });
});

describe('firstUnsetRow (그룹 스코프 순서)', () => {
  it('빈 값이면 그룹 순서상 첫 필수 행(title)', () => {
    expect(firstUnsetRow(emptyValues)).toEqual({ key: 'title', groupIndex: 0 });
  });
  it('전부 채우면 null', () => {
    expect(firstUnsetRow(filled)).toBeNull();
  });
  it('그룹0 완성·그룹1 시간 미설정이면 {time, 1}', () => {
    const partial: OrderSheetFormValues = {
      ...twoGroups,
      scheduleGroups: [
        twoGroups.scheduleGroups![0]!,
        { dates: ['2026-07-20'], timeSlots: [{ startTime: '', roles: [] }], grouped: false },
      ],
    };
    expect(firstUnsetRow(partial)).toEqual({ key: 'time', groupIndex: 1 });
  });
  it('그룹 순회는 그룹0 전체(dates→time→roles) 후 그룹1로 진행한다', () => {
    const partial: OrderSheetFormValues = {
      ...twoGroups,
      scheduleGroups: [
        { dates: ['2026-07-14'], timeSlots: [], grouped: false }, // 그룹0 time 미설정
        { dates: [], timeSlots: [], grouped: false }, // 그룹1 dates 미설정
      ],
    };
    expect(firstUnsetRow(partial)).toEqual({ key: 'time', groupIndex: 0 });
  });
});

describe('errorRowTargets — RHF 에러 경로 워커 (리뷰 Eng-H1)', () => {
  // zodResolver 실측 — 배열 루트/중첩 에러의 실제 형상을 고정한다(§3c: message vs root).
  const resolver = zodResolver(orderSheetValuesSchema);
  const resolve = async (values: OrderSheetFormValues) =>
    (await resolver(values, undefined, { fields: {}, shouldUseNativeValidation: false })).errors;

  it('그룹 간 중복 날짜 에러는 뒤 그룹의 dates 행으로 매핑된다 (E1 실측)', async () => {
    const errors = await resolve({
      ...filled,
      scheduleGroups: [
        filled.scheduleGroups![0]!,
        {
          dates: ['2026-07-14'],
          timeSlots: [{ startTime: '21:00', roles: [{ role: 'floor', count: 1 }] }],
          grouped: false,
        },
      ],
    });
    const targets = errorRowTargets(errors as Record<string, unknown>);
    expect(targets).toContainEqual({ key: 'dates', groupIndex: 1 });
    expect(errorMessageForRow(errors as Record<string, unknown>, 'dates', 1)).toBe(
      '이미 다른 일정에 포함된 날짜예요'
    );
  });

  it('그룹 timeSlots min(1) 에러는 해당 그룹 time 행으로 매핑된다 (실측)', async () => {
    const errors = await resolve({
      ...filled,
      scheduleGroups: [{ dates: ['2026-07-14'], timeSlots: [], grouped: false }],
    });
    expect(errorRowTargets(errors as Record<string, unknown>)).toContainEqual({
      key: 'time',
      groupIndex: 0,
    });
  });

  it('슬롯 roles min(1) 에러는 해당 그룹 roles 행으로 매핑된다 (중첩 실측)', async () => {
    const errors = await resolve({
      ...filled,
      scheduleGroups: [
        { dates: ['2026-07-14'], timeSlots: [{ startTime: '19:00', roles: [] }], grouped: false },
      ],
    });
    expect(errorRowTargets(errors as Record<string, unknown>)).toContainEqual({
      key: 'roles',
      groupIndex: 0,
    });
  });

  it('scheduleGroups 배열 루트 에러(min 1)는 그룹0 dates 행으로 폴백 매핑된다 (실측 — message/root 형상 무관)', async () => {
    const errors = await resolve({ ...filled, scheduleGroups: [] });
    expect(errorRowTargets(errors as Record<string, unknown>)).toContainEqual({
      key: 'dates',
      groupIndex: 0,
    });
  });

  it('roleSalaries 커버 게이트 에러는 salary 행으로 매핑된다', async () => {
    const errors = await resolve({ ...filled, useSameSalary: false, roleSalaries: [] });
    expect(errorRowTargets(errors as Record<string, unknown>)).toContainEqual({
      key: 'salary',
      groupIndex: 0,
    });
  });

  it('중첩 roleSalaries 금액 에러 메시지도 salary 행에서 읽힌다 (S2 리뷰 L-2 해소)', async () => {
    const errors = await resolve({
      ...filled,
      useSameSalary: false,
      roleSalaries: [{ role: 'dealer', salary: { type: 'hourly', amount: 100_000_001 } }],
    });
    expect(errorMessageForRow(errors as Record<string, unknown>, 'salary', 0)).toBe(
      '금액이 너무 큽니다'
    );
  });
});

describe('place 행 — 지역 필수 정렬 (2026-07-15)', () => {
  const baseValues = {
    postingType: 'regular',
    title: '제목',
    location: { name: '라운더스 홀덤펍' },
    contactPhone: '010-1234-5678',
    scheduleGroups: [],
    salary: { type: 'hourly', amount: 0 },
  } as unknown as OrderSheetFormValues;

  it('region 없는 location은 unset (zod 통과 가능성과 정렬 — H5)', () => {
    const state = getRowState(baseValues, 'place');
    expect(state.unset).toBe(true);
  });

  it('region 있는 location은 set', () => {
    const state = getRowState(
      { ...baseValues, location: { name: '라운더스 홀덤펍', region: '서울 강남구' } },
      'place'
    );
    expect(state.unset).toBe(false);
    expect(state.value).toBe('라운더스 홀덤펍');
  });

  it('errors.location.region 중첩 메시지가 place 행 배지로 흐른다', () => {
    const msg = errorMessageForRow(
      { location: { region: { message: '지역을 선택해주세요' } } },
      'place',
      0
    );
    expect(msg).toBe('지역을 선택해주세요');
  });

  it('errors.location 루트 메시지(장소 null)는 기존대로 흐른다', () => {
    const msg = errorMessageForRow({ location: { message: '장소를 선택해주세요' } }, 'place', 0);
    expect(msg).toBe('장소를 선택해주세요');
  });
});

describe('summarizeGroupDates — 그룹 날짜 요약 표기', () => {
  it('연속이면 범위 표기 7/20~21', () => {
    expect(summarizeGroupDates(['2026-07-20', '2026-07-21'])).toBe('7/20~21');
  });
  it('월 경계 연속은 7/31~8/1', () => {
    expect(summarizeGroupDates(['2026-07-31', '2026-08-01'])).toBe('7/31~8/1');
  });
  it('비연속이면 7/20 외 2일', () => {
    expect(summarizeGroupDates(['2026-07-20', '2026-07-22', '2026-07-25'])).toBe('7/20 외 2일');
  });
  it('단일 날짜는 7/20', () => {
    expect(summarizeGroupDates(['2026-07-20'])).toBe('7/20');
  });
  it('빈 배열은 빈 문자열', () => {
    expect(summarizeGroupDates([])).toBe('');
  });
});
