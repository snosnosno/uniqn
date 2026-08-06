/**
 * SlotRoleChips — D7(마감 표기하되 차단하지 않음) · 커스텀 역할명 닫힌 목록 계약 테스트
 *
 * 🔴 이 스위트의 존재 이유 셋:
 *    ① **선의의 차단을 막는다.** 마감 역할을 `disabled` 로 만드는 것은 직관적이지만 사용자 결정
 *       D7 위반이다 — 대회 당일 급구처럼 "정원 초과인 걸 알면서 지금 넣어야 하는" 상황이 실재한다.
 *    ② **자유 입력이 열리는 것을 막는다.** 이름은 공고가 정의한 것 + 이 행에 저장된 것뿐이다.
 *       목록 밖 이름이 저장되면 `_posting_role_key` 매칭이 영영 안 되는 유령 역할이 된다.
 *    ③ **모순 조합이 만들어지지 않게 한다.** 칩은 `{role, customRole}` 을 통째로만 통지한다.
 *
 * 🔑 마감 판정은 `selectPostingRoleAvailability` 하나로만 한다. 폐기된 `RoleChangeModal` 이
 *    쓰던 그 함수라, 같은 데이터에서 두 화면의 판정이 갈릴 수 없다. 그 함수는
 *    `remaining = count - filled` 를 계산하므로 **정원(`JobPosting`)과 실확정(`filledByRole`)이
 *    둘 다** 있어야 마감을 알 수 있다. 하나라도 없으면 표기를 생략한다(설계 §3-2-b 폴백).
 *
 * ⚠️ 선택 상태를 `accessibilityState.selected` 로 단언하지 않는다 — react-native-web 0.21.2 가
 *    처리하지 않는다. 선택 표식(체크)의 렌더 여부로 본다.
 */
import { render, screen, fireEvent } from '@testing-library/react-native';

import type { JobPosting } from '@/types';

import { SlotRoleChips, type SlotRoleSelection } from '../SlotRoleChips';

interface FixtureRole {
  id: string;
  role: string;
  count: number;
  customRole?: string;
}

/**
 * 마감 판정에 필요한 최소 공고. `roleAvailability.hydrate.test.ts` 의 픽스처를 축약했다 —
 * 정원은 `schedule.requirements[].timeSlots[].roles[].count` 에서만 나온다.
 */
function createPosting(roles: FixtureRole[]): JobPosting {
  return {
    id: 'job-1',
    schemaVersion: 3,
    title: '역할 칩 테스트',
    status: 'active',
    ownerId: 'owner-1',
    ownerName: 'Owner',
    workDate: '2026-08-10',
    workDates: ['2026-08-10'],
    totalPositions: roles.reduce((sum, role) => sum + role.count, 0),
    filledPositions: 0,
    location: { name: 'Seoul', district: 'Gangnam', detailedAddress: '101' },
    schedule: {
      kind: 'dated',
      primaryDate: '2026-08-10',
      allDates: ['2026-08-10'],
      requirements: [
        {
          date: '2026-08-10',
          timeSlots: [{ id: 'slot-1', startTime: '18:00', roles }],
        },
      ],
    },
    roleCatalog: [],
    compensation: { mode: 'shared', defaultSalary: { type: 'hourly', amount: 20000 } },
    questions: { items: [] },
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  } as JobPosting;
}

/** 플로어 정원 1명짜리 공고 — 마감 케이스의 기준 픽스처. */
const FLOOR_ONE = createPosting([
  { id: 'dealer-1', role: 'dealer', count: 2 },
  { id: 'floor-1', role: 'floor', count: 1 },
]);

/** 표준 역할 선택 한 쌍(이름은 없다 — 이 불변식이 모순 조합을 막는다). */
const at = (role: SlotRoleSelection['role']): SlotRoleSelection => ({ role, customRole: null });

describe('SlotRoleChips — D7: 마감은 표기만, 선택은 허용', () => {
  it('🔴 마감된 역할도 선택할 수 있다 (D7 — 차단하지 않는다)', () => {
    const onChange = jest.fn();
    render(
      <SlotRoleChips
        value={at('dealer')}
        current={at('dealer')}
        onChange={onChange}
        jobPosting={FLOOR_ONE}
        filledByRole={{ floor: 1 }}
      />
    );

    fireEvent.press(screen.getByLabelText('역할 플로어 (마감)'));

    expect(onChange).toHaveBeenCalledWith({ role: 'floor', customRole: null });
  });

  it('마감된 역할에 "(마감)" 을 병기한다', () => {
    render(
      <SlotRoleChips
        value={at('dealer')}
        current={at('dealer')}
        onChange={jest.fn()}
        jobPosting={FLOOR_ONE}
        filledByRole={{ floor: 1 }}
      />
    );

    expect(screen.getByLabelText('역할 플로어 (마감)')).toBeTruthy();
    // 라벨만이 아니라 **눈에도** 보여야 한다 — 색만으로 상태를 말하지 않는다.
    // ⚠️ 반드시 정규식으로 본다. RNTL 의 toHaveTextContent 는 문자열 인자를 **완전일치**로
    //    판정해서, '(마감)' 을 넘기면 칩 전체 텍스트('👔 플로어(마감)')와 달라 항상 실패하고
    //    아래 not 단언은 반대로 **항상 통과**하는 빈 가드가 된다(2026-08-06 실측).
    expect(screen.getByTestId('role-chip-floor')).toHaveTextContent(/\(마감\)/);
  });

  it('🔴 자기가 이미 맡은 역할에는 "(마감)" 을 붙이지 않는다', () => {
    // `filled` 에는 이 사람이 포함돼 있다. 예외가 없으면 정원 1명짜리 역할을 맡은 사람은
    // **자기 역할 칩에 상시 "(마감)"** 을 보게 된다 — "내가 있어서 마감"이라는 무의미한 표기다.
    // 폐기된 RoleChangeModal 이 `role !== currentRoleKey && fullRoleKeys.has(role)` 로 지켰다.
    render(
      <SlotRoleChips
        value={at('floor')}
        current={at('floor')}
        onChange={jest.fn()}
        jobPosting={FLOOR_ONE}
        filledByRole={{ floor: 1 }}
      />
    );

    expect(screen.getByLabelText('역할 플로어')).toBeTruthy();
    expect(screen.getByTestId('role-chip-floor')).not.toHaveTextContent(/마감/);
  });

  it('🔴 예외의 기준은 `current`(원래 역할)이지 `value`(고르는 중)가 아니다', () => {
    // value 를 기준으로 삼으면 고르는 칩마다 "(마감)" 이 사라져 표기가 선택을 따라다닌다.
    // 원래 딜러인 사람이 마감된 플로어를 골라 본 상태 — 플로어는 여전히 마감이어야 한다.
    render(
      <SlotRoleChips
        value={at('floor')}
        current={at('dealer')}
        onChange={jest.fn()}
        jobPosting={FLOOR_ONE}
        filledByRole={{ floor: 1 }}
      />
    );

    expect(screen.getByTestId('role-chip-floor')).toHaveTextContent(/\(마감\)/);
  });

  it('정원이 넘쳐도(초과 확정) 마감으로만 표기하고 선택은 열어 둔다', () => {
    const onChange = jest.fn();
    render(
      <SlotRoleChips
        value={at('dealer')}
        current={at('dealer')}
        onChange={onChange}
        jobPosting={FLOOR_ONE}
        filledByRole={{ floor: 3 }}
      />
    );

    fireEvent.press(screen.getByLabelText('역할 플로어 (마감)'));

    expect(onChange).toHaveBeenCalledWith({ role: 'floor', customRole: null });
  });

  it('정원이 남아 있으면(정원 2 · 확정 1) 표기하지 않는다', () => {
    // 🔴 브리프가 틀렸던 바로 그 축이다. `filled` 값이 **있다는 것만으로** 마감으로 읽으면
    //    안 된다 — 마감은 `remaining = count - filled` 가 0 일 때뿐이다.
    render(
      <SlotRoleChips
        value={at('floor')}
        current={at('floor')}
        onChange={jest.fn()}
        jobPosting={FLOOR_ONE}
        filledByRole={{ dealer: 1 }}
      />
    );

    // 딜러 정원 2 · 확정 1 → 여유 1
    expect(screen.getByLabelText('역할 딜러')).toBeTruthy();
    expect(screen.getByTestId('role-chip-dealer')).not.toHaveTextContent(/마감/);
  });

  it('filledByRole 이 없으면 마감 표기를 생략한다', () => {
    render(
      <SlotRoleChips
        value={at('dealer')}
        current={at('dealer')}
        onChange={jest.fn()}
        jobPosting={FLOOR_ONE}
      />
    );

    expect(screen.getByLabelText('역할 플로어')).toBeTruthy();
  });

  it('jobPosting 이 없으면 filledByRole 이 있어도 마감 표기를 생략한다 (= 근무표 경로)', () => {
    // 정원을 모르면 마감을 알 수 없다. RoleChangeModal 의 현행 폴백과 같은 동작이다.
    // 🔑 근무표(VenueDayPanel)가 실제로 이 경우다 — 하루치 슬롯이 행마다 다른 공고에 걸려 있고
    //    컨테이너 직속 배치는 대응 공고 자체가 없다. **결함이 아니라 설계 §3-2-b 의 의도**다.
    render(
      <SlotRoleChips
        value={at('dealer')}
        current={at('dealer')}
        onChange={jest.fn()}
        filledByRole={{ floor: 99 }}
      />
    );

    expect(screen.getByLabelText('역할 플로어')).toBeTruthy();
  });

  it('공고에 없는 역할은 마감으로 보지 않는다', () => {
    // 정원 항목이 없는 역할(서빙)은 remaining 을 계산할 근거가 없다 — 0 으로 단정하면
    // 공고에 안 적힌 역할 전부가 마감으로 보인다.
    render(
      <SlotRoleChips
        value={at('dealer')}
        current={at('dealer')}
        onChange={jest.fn()}
        jobPosting={FLOOR_ONE}
        filledByRole={{ floor: 1 }}
      />
    );

    expect(screen.getByLabelText('역할 서빙')).toBeTruthy();
  });
});

describe('SlotRoleChips — 역할 목록과 선택', () => {
  it('StaffRole 6종을 모두 렌더한다', () => {
    render(<SlotRoleChips value={at('dealer')} current={at('dealer')} onChange={jest.fn()} />);

    ['딜러', '플로어', '서빙', '매니저', '직원', '기타'].forEach((name) => {
      expect(screen.getByLabelText(`역할 ${name}`)).toBeTruthy();
    });
  });

  it('선택된 칩에만 선택 표식이 보인다', () => {
    render(<SlotRoleChips value={at('floor')} current={at('floor')} onChange={jest.fn()} />);

    expect(screen.getByTestId('role-chip-floor-selected')).toBeTruthy();
    expect(screen.queryByTestId('role-chip-dealer-selected')).toBeNull();
  });

  it('이미 선택된 칩을 다시 눌러도 같은 값으로 통지한다', () => {
    const onChange = jest.fn();
    render(<SlotRoleChips value={at('dealer')} current={at('dealer')} onChange={onChange} />);

    fireEvent.press(screen.getByLabelText('역할 딜러'));

    expect(onChange).toHaveBeenCalledWith({ role: 'dealer', customRole: null });
  });

  it('readOnly 면 눌러도 통지하지 않는다', () => {
    const onChange = jest.fn();
    render(
      <SlotRoleChips value={at('dealer')} current={at('dealer')} onChange={onChange} readOnly />
    );

    fireEvent.press(screen.getByLabelText('역할 플로어'));

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('SlotRoleChips — 커스텀 역할명 칩(닫힌 목록)', () => {
  const CUSTOM_POSTING = createPosting([
    { id: 'dealer-1', role: 'dealer', count: 2 },
    { id: 'other-1', role: 'other', customRole: '바리스타', count: 1 },
    { id: 'other-2', role: 'other', customRole: '플로어장', count: 2 },
  ]);

  it('🔴 공고가 정의한 other 이름들이 칩으로 뜬다 (기능 소실 복구)', () => {
    render(
      <SlotRoleChips
        value={at('dealer')}
        current={at('dealer')}
        onChange={jest.fn()}
        jobPosting={CUSTOM_POSTING}
      />
    );

    expect(screen.getByTestId('role-chip-custom-바리스타')).toBeTruthy();
    expect(screen.getByTestId('role-chip-custom-플로어장')).toBeTruthy();
  });

  it('🔴 이름 칩을 누르면 role=other 와 이름이 **한 쌍으로** 통지된다', () => {
    // 서버 판정표 ① 그대로다. 둘 중 하나만 보내면 ③⑤ 로 거부되는데, 칩이 쌍을 통째로
    // 만들어 내므로 그 조합 자체가 존재할 수 없다.
    const onChange = jest.fn();
    render(
      <SlotRoleChips
        value={at('dealer')}
        current={at('dealer')}
        onChange={onChange}
        jobPosting={CUSTOM_POSTING}
      />
    );

    fireEvent.press(screen.getByTestId('role-chip-custom-바리스타'));

    expect(onChange).toHaveBeenCalledWith({ role: 'other', customRole: '바리스타' });
  });

  it('🔴 표준 칩을 누르면 이름이 반드시 null 로 함께 온다 — 모순 조합이 불가능하다', () => {
    const onChange = jest.fn();
    render(
      <SlotRoleChips
        value={{ role: 'other', customRole: '바리스타' }}
        current={{ role: 'other', customRole: '바리스타' }}
        onChange={onChange}
        jobPosting={CUSTOM_POSTING}
      />
    );

    fireEvent.press(screen.getByLabelText('역할 플로어'));

    expect(onChange).toHaveBeenCalledWith({ role: 'floor', customRole: null });
  });

  it('이름이 선택되면 그 칩에만 표식이 붙고 "기타" 칩에는 붙지 않는다', () => {
    // '기타' 칩은 **이름 없는 기타**를 뜻한다. 둘 다 켜지면 무엇이 저장될지 화면이 못 말한다.
    render(
      <SlotRoleChips
        value={{ role: 'other', customRole: '바리스타' }}
        current={{ role: 'other', customRole: '바리스타' }}
        onChange={jest.fn()}
        jobPosting={CUSTOM_POSTING}
      />
    );

    expect(screen.getByTestId('role-chip-custom-바리스타-selected')).toBeTruthy();
    expect(screen.queryByTestId('role-chip-other-selected')).toBeNull();
  });

  it('🔴 저장된 이름은 공고에 없어도 칩으로 남는다 — 없으면 되돌릴 수 없다', () => {
    // 근무표 경로(jobPosting 없음)가 정확히 이 경우다. 칩이 없으면 '기타' 를 스치는 순간
    // `customRole:null` 이 실려 이름이 지워지는데 되살릴 방법이 화면에 없다.
    render(
      <SlotRoleChips
        value={{ role: 'other', customRole: '바리스타' }}
        current={{ role: 'other', customRole: '바리스타' }}
        onChange={jest.fn()}
      />
    );

    expect(screen.getByTestId('role-chip-custom-바리스타')).toBeTruthy();
    expect(screen.getByTestId('role-chip-custom-바리스타-selected')).toBeTruthy();
  });

  it('공고 이름과 저장된 이름이 같으면 칩이 한 번만 뜬다', () => {
    render(
      <SlotRoleChips
        value={{ role: 'other', customRole: '바리스타' }}
        current={{ role: 'other', customRole: '바리스타' }}
        onChange={jest.fn()}
        jobPosting={CUSTOM_POSTING}
      />
    );

    // 중복 렌더면 getBy* 가 "multiple elements" 로 던진다 — 이 단언이 곧 유일성 검사다.
    expect(screen.getByTestId('role-chip-custom-바리스타')).toBeTruthy();
  });

  it('이름 없는 other 정원은 이름 칩을 만들지 않는다 — 표준 "기타" 칩이 맡는다', () => {
    const posting = createPosting([{ id: 'other-1', role: 'other', count: 1 }]);
    render(
      <SlotRoleChips
        value={at('dealer')}
        current={at('dealer')}
        onChange={jest.fn()}
        jobPosting={posting}
        filledByRole={{ 'other:': 1 }}
      />
    );

    expect(screen.getByLabelText('역할 기타 (마감)')).toBeTruthy();
    expect(screen.queryByTestId('role-chip-custom-')).toBeNull();
  });

  it('이름 칩에도 마감이 표기된다', () => {
    // ⚠️ 축이 둘이라 헷갈리기 쉽다: `filledByRole` 의 **키는 DB `_posting_role_key`**
    //    (`other:바리스타`)이고, 칩이 비교하는 `item.key` 는 **이름 문자열**(`바리스타`)이다.
    //    selector 가 그 변환을 소유한다(`selectors.ts:105-111`) — 칩이 다시 만들지 않는다.
    render(
      <SlotRoleChips
        value={at('dealer')}
        current={at('dealer')}
        onChange={jest.fn()}
        jobPosting={CUSTOM_POSTING}
        filledByRole={{ 'other:바리스타': 1 }}
      />
    );

    expect(screen.getByTestId('role-chip-custom-바리스타')).toHaveTextContent(/\(마감\)/);
    // 정원 2 · 확정 0 인 플로어장은 여유다.
    expect(screen.getByTestId('role-chip-custom-플로어장')).not.toHaveTextContent(/마감/);
  });

  it('🔴 이름 칩의 a11y 라벨은 표준 칩과 접두사가 다르다 — 같은 이름이어도 안 겹친다', () => {
    // 공고가 other 이름을 '딜러' 로 지을 수 있다. 라벨이 같으면 스크린리더·음성제어가 두 칩을
    // 못 가르고, 테스트의 getByLabelText 도 "multiple elements" 로 죽는다.
    const posting = createPosting([{ id: 'other-1', role: 'other', customRole: '딜러', count: 1 }]);
    render(
      <SlotRoleChips
        value={at('staff')}
        current={at('staff')}
        onChange={jest.fn()}
        jobPosting={posting}
      />
    );

    expect(screen.getByLabelText('역할 딜러')).toBeTruthy();
    expect(screen.getByLabelText('기타 역할 딜러')).toBeTruthy();
  });
});
