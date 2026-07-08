/**
 * StaffTab(1e) — STAFF 탭 렌더 분기 + 배선 회귀.
 * 무거운 의존(SelectBottomSheet=@gorhom/bottom-sheet 실물은 BottomSheetModalProvider 부재로
 * jest 렌더 불가 — DealerPickerSheet.test.tsx/TablesTab.test.tsx probe 로 이미 확인됨)과
 * StaffAddSheet/PostingPickerSheet(SheetModal 경유)는 가벼운 모킹으로 대체한다.
 * DealerPickerSheet 는 이 태스크에서 재사용하지 않는다(브리프가 허용한 대안 — 테이블 지정은
 * 스태프→테이블 방향이라 DealerPickerSheet 의 테이블→스태프 방향과 반대라 인라인 SelectBottomSheet 로 구성).
 *
 * 검증: 미연결(안내+owner 게이트+워크스페이스 스코프 안내) / 연결+빈 로스터(import CTA) /
 * 연결됨(변경/해제 owner 게이트) / 로스터 N행(이름·역할 배지·배정 테이블 배지 T{n}·source 구분) /
 * 행 탭→액션 시트(테이블 지정/삭제) 및 각 mutate 위임 / import 확인 다이얼로그 문구 + mutate 인자 /
 * staleness 캡션 / 수동 추가 시트 배선.
 *
 * import 성공 토스트의 정확한 문구("N명 추가 · M명 건너뜀")는 useOpsMutations.test.tsx 가
 * 실제 훅(react-query 실물)으로 검증한다. 이 파일은 '@/hooks/ops' 를 전부 모킹하므로 토스트는
 * 훅 내부(useImportOpsStaff onSuccess) 부수효과라 여기선 재검증하지 않는다(모킹 위 모킹의 순환 회피).
 */
import { render, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import React from 'react';
import { StaffTab } from '../StaffTab';
import {
  useOpsStaff,
  useOpsTables,
  useSetTournamentPosting,
  useImportOpsStaff,
  useRemoveOpsStaff,
  useAssignTableStaff,
} from '@/hooks/ops';
import { useMyJobPostings } from '@/hooks/useJobManagement';
import { useActiveWorkspace } from '@/hooks/workspace/useActiveWorkspace';
import { useAuthStore } from '@/stores/authStore';
import type { OpsStaff, OpsTable, OpsTournament } from '@/types/ops';

type CapturedOption = { label: string; value: string; disabled?: boolean; destructive?: boolean };

// 무거운 의존(SelectBottomSheet=@gorhom/bottom-sheet) 모킹: DealerPickerSheet.test.tsx 와 동일 문형.
jest.mock('@/components/ui', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    SelectBottomSheet: ({ visible, title, options, onSelect, onClose }: any) => {
      if (!visible) return null;
      return (
        <View>
          {title ? <Text>{title}</Text> : null}
          {options.map((o: CapturedOption) => (
            <Pressable
              key={o.value}
              accessibilityRole="button"
              disabled={o.disabled}
              onPress={() => {
                if (o.disabled) return;
                onSelect(o.value);
                onClose();
              }}
            >
              <Text>{o.label}</Text>
            </Pressable>
          ))}
        </View>
      );
    },
  };
});

let addSheetProps: Record<string, unknown> | null = null;
jest.mock('../StaffAddSheet', () => {
  const { Text } = require('react-native');
  return {
    StaffAddSheet: (props: Record<string, unknown>) => {
      addSheetProps = props;
      return props.visible ? <Text>스태프추가시트열림</Text> : null;
    },
  };
});

let postingPickerProps: Record<string, unknown> | null = null;
jest.mock('../PostingPickerSheet', () => {
  const { Text, Pressable } = require('react-native');
  return {
    PostingPickerSheet: (props: any) => {
      postingPickerProps = props;
      if (!props.visible) return null;
      return (
        <Pressable accessibilityRole="button" onPress={() => props.onSelect('posting-new')}>
          <Text>공고피커열림</Text>
        </Pressable>
      );
    },
  };
});

jest.mock('@/hooks/ops', () => ({
  useOpsStaff: jest.fn(),
  useOpsTables: jest.fn(),
  useSetTournamentPosting: jest.fn(),
  useImportOpsStaff: jest.fn(),
  useRemoveOpsStaff: jest.fn(),
  useAssignTableStaff: jest.fn(),
}));

jest.mock('@/hooks/useJobManagement', () => ({
  useMyJobPostings: jest.fn(),
}));

jest.mock('@/hooks/workspace/useActiveWorkspace', () => ({
  useActiveWorkspace: jest.fn(),
}));

jest.mock('@/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

const mockUseOpsStaff = useOpsStaff as unknown as jest.Mock;
const mockUseOpsTables = useOpsTables as unknown as jest.Mock;
const mockUseSetTournamentPosting = useSetTournamentPosting as unknown as jest.Mock;
const mockUseImportOpsStaff = useImportOpsStaff as unknown as jest.Mock;
const mockUseRemoveOpsStaff = useRemoveOpsStaff as unknown as jest.Mock;
const mockUseAssignTableStaff = useAssignTableStaff as unknown as jest.Mock;
const mockUseMyJobPostings = useMyJobPostings as unknown as jest.Mock;
const mockUseActiveWorkspace = useActiveWorkspace as unknown as jest.Mock;
const mockUseAuthStore = useAuthStore as unknown as jest.Mock;

const TID = 'trn1';
const OWNER_ID = 'owner-1';

function tournament(overrides?: Partial<OpsTournament>): OpsTournament {
  return {
    id: TID,
    ownerId: OWNER_ID,
    jobPostingId: null,
    name: '테스트 대회',
    venue: null,
    eventDate: '2026-07-10',
    gameType: 'NLH',
    status: 'upcoming',
    seatsPerTable: 9,
    startingChips: 20000,
    color: null,
    buyInChips: 20000,
    rebuyChips: 20000,
    addonChips: 20000,
    buyInCost: 100000,
    feeCost: 0,
    rebuyCost: 100000,
    addonCost: 100000,
    bountyCost: null,
    registrationOpen: true,
    autoSeatOnRegister: true,
    reentryAllowed: true,
    maxReentries: null,
    monitorToken: null,
    nextEntrySeq: 1,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function staff(overrides: Partial<OpsStaff> & { staffId: string }): OpsStaff {
  return {
    id: `os-${overrides.staffId}`,
    tournamentId: TID,
    role: 'dealer',
    customRole: null,
    staffName: '무명',
    staffNickname: null,
    source: 'manual',
    sourceWorkLogId: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

function table(overrides: Partial<OpsTable> & { tableNo: number }): OpsTable {
  return {
    id: `tb${overrides.tableNo}`,
    tournamentId: TID,
    name: null,
    status: 'open',
    assignedStaffId: null,
    lockType: 'none',
    priority: null,
    position: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

interface SetupOpts {
  roster?: OpsStaff[];
  tables?: OpsTable[];
  postings?: { id: string; title: string }[];
  activeWorkspace?: { id: string } | undefined;
  actorId?: string | undefined;
}

function setupHooks(opts?: SetupOpts) {
  mockUseOpsStaff.mockReturnValue({ data: opts?.roster ?? [], isLoading: false });
  mockUseOpsTables.mockReturnValue({ tables: opts?.tables ?? [], isLoading: false });
  mockUseMyJobPostings.mockReturnValue({ data: opts?.postings ?? [] });
  mockUseActiveWorkspace.mockReturnValue({
    activeWorkspace: 'activeWorkspace' in (opts ?? {}) ? opts?.activeWorkspace : { id: 'ws1' },
  });
  mockUseAuthStore.mockReturnValue(opts?.actorId ?? OWNER_ID);
  mockUseSetTournamentPosting.mockReturnValue({ mutate: jest.fn() });
  mockUseImportOpsStaff.mockReturnValue({ mutate: jest.fn() });
  mockUseRemoveOpsStaff.mockReturnValue({ mutate: jest.fn() });
  mockUseAssignTableStaff.mockReturnValue({ mutate: jest.fn() });
}

let alertSpy: jest.SpyInstance;

beforeEach(() => {
  addSheetProps = null;
  postingPickerProps = null;
  jest.clearAllMocks();
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
});

afterEach(() => {
  alertSpy.mockRestore();
});

describe('공고 연결 카드 — 미연결', () => {
  it('owner 에게 안내 문구와 연결 버튼을 노출한다', () => {
    setupHooks();
    const { getByText } = render(<StaffTab tournamentId={TID} tournament={tournament()} />);

    expect(getByText('공고를 연결하면 확정 스태프를 가져올 수 있어요.')).toBeTruthy();
    expect(getByText('연결')).toBeTruthy();
  });

  it('non-owner 에게는 연결 버튼을 숨긴다', () => {
    setupHooks({ actorId: 'staff-999' });
    const { queryByText } = render(<StaffTab tournamentId={TID} tournament={tournament()} />);

    expect(queryByText('연결')).toBeNull();
  });

  it('워크스페이스가 없으면 owner 라도 연결 버튼 대신 스코프 제약 안내를 노출한다', () => {
    setupHooks({ activeWorkspace: undefined });
    const { getByText, queryByText } = render(
      <StaffTab tournamentId={TID} tournament={tournament()} />
    );

    expect(queryByText('연결')).toBeNull();
    expect(getByText('워크스페이스가 없어 공고를 연결할 수 없습니다.')).toBeTruthy();
  });

  it('연결 버튼 → PostingPickerSheet 오픈 → 선택 시 공고연결 mutate 를 호출한다', () => {
    const mutate = jest.fn();
    setupHooks();
    mockUseSetTournamentPosting.mockReturnValue({ mutate });

    const { getByText } = render(<StaffTab tournamentId={TID} tournament={tournament()} />);

    fireEvent.press(getByText('연결'));
    expect(postingPickerProps).toMatchObject({ visible: true });

    fireEvent.press(getByText('공고피커열림'));
    expect(mutate).toHaveBeenCalledWith('posting-new');
  });
});

describe('공고 연결 카드 — 연결됨', () => {
  it('연결된 공고 제목과 owner 전용 변경/해제 버튼을 노출한다', () => {
    setupHooks({ postings: [{ id: 'p1', title: '주말 홀덤 대회' }] });
    const { getByText } = render(
      <StaffTab tournamentId={TID} tournament={tournament({ jobPostingId: 'p1' })} />
    );

    expect(getByText('주말 홀덤 대회')).toBeTruthy();
    expect(getByText('변경')).toBeTruthy();
    expect(getByText('해제')).toBeTruthy();
  });

  it('non-owner 에게는 변경/해제 버튼을 숨긴다', () => {
    setupHooks({ postings: [{ id: 'p1', title: '주말 홀덤 대회' }], actorId: 'staff-999' });
    const { queryByText } = render(
      <StaffTab tournamentId={TID} tournament={tournament({ jobPostingId: 'p1' })} />
    );

    expect(queryByText('변경')).toBeNull();
    expect(queryByText('해제')).toBeNull();
  });
});

describe('import CTA', () => {
  it('연결 + 빈 로스터 → import CTA 버튼을 노출한다', () => {
    setupHooks({ postings: [{ id: 'p1', title: '공고' }] });
    const { getByText } = render(
      <StaffTab tournamentId={TID} tournament={tournament({ jobPostingId: 'p1' })} />
    );

    expect(getByText('확정 스태프 가져오기')).toBeTruthy();
  });

  it('미연결이면 import CTA 버튼을 노출하지 않는다', () => {
    setupHooks();
    const { queryByText } = render(<StaffTab tournamentId={TID} tournament={tournament()} />);

    expect(queryByText('확정 스태프 가져오기')).toBeNull();
  });

  // 리뷰 후속 T8-M2 — eventDate=null 이면 handleImportPress 가 date=null(전체 기간)로 mutate 하므로
  // 캡션도 "대회일"이 아닌 "전체 기간"으로 표시해야 동작과 일치한다(구 캡션은 실제로 필터되지 않는
  // 상태를 "대회일 기준"이라 오도했다).
  it('eventDate 가 null 이면 import CTA 캡션도 "전체 기간"으로 표시한다(동작과 일치)', () => {
    setupHooks({ postings: [{ id: 'p1', title: '공고' }] });
    const { getByText, queryByText } = render(
      <StaffTab
        tournamentId={TID}
        tournament={tournament({ jobPostingId: 'p1', eventDate: null })}
      />
    );

    expect(getByText('전체 기간 기준')).toBeTruthy();
    expect(queryByText('대회일 기준')).toBeNull();
  });

  it('누르면 필수 문구가 담긴 확인 다이얼로그를 띄운다', () => {
    setupHooks({ postings: [{ id: 'p1', title: '공고' }] });
    const { getByText } = render(
      <StaffTab
        tournamentId={TID}
        tournament={tournament({ jobPostingId: 'p1', eventDate: '2026-07-10' })}
      />
    );

    fireEvent.press(getByText('확정 스태프 가져오기'));

    expect(alertSpy).toHaveBeenCalledWith(
      '확정 스태프 가져오기',
      '이미 있는 스태프는 건너뛰고, 삭제했던 스태프는 다시 추가됩니다.',
      expect.arrayContaining([
        expect.objectContaining({ text: '취소' }),
        expect.objectContaining({ text: '가져오기', onPress: expect.any(Function) }),
      ])
    );
  });

  it('확인 후 기본값(대회 event_date)으로 import mutate 를 호출한다', () => {
    const mutate = jest.fn();
    setupHooks({ postings: [{ id: 'p1', title: '공고' }] });
    mockUseImportOpsStaff.mockReturnValue({ mutate });

    const { getByText } = render(
      <StaffTab
        tournamentId={TID}
        tournament={tournament({ jobPostingId: 'p1', eventDate: '2026-07-10' })}
      />
    );

    fireEvent.press(getByText('확정 스태프 가져오기'));
    const buttons = alertSpy.mock.calls[0]?.[2] as { text: string; onPress?: () => void }[];
    buttons.find((b) => b.text === '가져오기')?.onPress?.();

    expect(mutate).toHaveBeenCalledWith('2026-07-10');
  });

  it('"전체 기간" 토글 후 확인하면 date=null 로 import mutate 를 호출한다', () => {
    const mutate = jest.fn();
    setupHooks({ postings: [{ id: 'p1', title: '공고' }] });
    mockUseImportOpsStaff.mockReturnValue({ mutate });

    const { getByText, getByLabelText } = render(
      <StaffTab
        tournamentId={TID}
        tournament={tournament({ jobPostingId: 'p1', eventDate: '2026-07-10' })}
      />
    );

    fireEvent.press(getByLabelText('전체 기간 토글'));
    fireEvent.press(getByText('확정 스태프 가져오기'));
    const buttons = alertSpy.mock.calls[0]?.[2] as { text: string; onPress?: () => void }[];
    buttons.find((b) => b.text === '가져오기')?.onPress?.();

    expect(mutate).toHaveBeenCalledWith(null);
  });
});

describe('로스터 리스트', () => {
  it('N행 — 이름·역할 배지·배정 테이블 배지(T{n})·source 구분을 렌더한다', () => {
    const roster = [
      staff({
        staffId: 'u-dealer',
        staffName: '이딜러',
        role: 'dealer',
        source: 'snapshot_import',
      }),
      staff({ staffId: 'u-floor', staffName: '김플로어', role: 'floor', source: 'manual' }),
    ];
    const tables = [table({ tableNo: 3, assignedStaffId: 'u-dealer' })];
    setupHooks({ roster, tables, postings: [{ id: 'p1', title: '공고' }] });

    const { getByText } = render(
      <StaffTab tournamentId={TID} tournament={tournament({ jobPostingId: 'p1' })} />
    );

    expect(getByText('이딜러')).toBeTruthy();
    expect(getByText('딜러')).toBeTruthy();
    expect(getByText('T3')).toBeTruthy();
    expect(getByText('가져옴')).toBeTruthy();

    expect(getByText('김플로어')).toBeTruthy();
    expect(getByText('플로어')).toBeTruthy();
    expect(getByText('수동')).toBeTruthy();
  });

  it('상단에 staleness 캡션을 렌더한다(로스터가 비어있지 않을 때)', () => {
    const roster = [staff({ staffId: 'u1', staffName: '한명' })];
    setupHooks({ roster, postings: [{ id: 'p1', title: '공고' }] });

    const { getByText } = render(
      <StaffTab tournamentId={TID} tournament={tournament({ jobPostingId: 'p1' })} />
    );

    expect(getByText('가져온 시점 기준 명단입니다')).toBeTruthy();
  });

  it('로스터가 비어있으면 staleness 캡션을 렌더하지 않는다', () => {
    setupHooks({ postings: [{ id: 'p1', title: '공고' }] });

    const { queryByText } = render(
      <StaffTab tournamentId={TID} tournament={tournament({ jobPostingId: 'p1' })} />
    );

    expect(queryByText('가져온 시점 기준 명단입니다')).toBeNull();
  });

  it('행 탭 → 액션 시트(테이블 지정/삭제)를 연다', () => {
    const roster = [staff({ staffId: 'u1', staffName: '한명' })];
    setupHooks({ roster, postings: [{ id: 'p1', title: '공고' }] });

    const { getByText } = render(
      <StaffTab tournamentId={TID} tournament={tournament({ jobPostingId: 'p1' })} />
    );

    fireEvent.press(getByText('한명'));

    expect(getByText('테이블 지정')).toBeTruthy();
    expect(getByText('로스터에서 삭제')).toBeTruthy();
  });

  it('"테이블 지정" → 테이블 선택 시 useAssignTableStaff 를 {tableId,staffId} 로 호출한다', () => {
    const mutate = jest.fn();
    const roster = [staff({ staffId: 'u1', staffName: '한명' })];
    const tables = [table({ tableNo: 1 }), table({ tableNo: 2 })];
    setupHooks({ roster, tables, postings: [{ id: 'p1', title: '공고' }] });
    mockUseAssignTableStaff.mockReturnValue({ mutate });

    const { getByText } = render(
      <StaffTab tournamentId={TID} tournament={tournament({ jobPostingId: 'p1' })} />
    );

    fireEvent.press(getByText('한명'));
    fireEvent.press(getByText('테이블 지정'));
    fireEvent.press(getByText('T1'));

    expect(mutate).toHaveBeenCalledWith({ tableId: 'tb1', staffId: 'u1' });
  });

  it('배정된 스태프는 "배정 해제" 선택 시 staffId=null 로 호출한다', () => {
    const mutate = jest.fn();
    const roster = [staff({ staffId: 'u1', staffName: '한명' })];
    const tables = [table({ tableNo: 1, assignedStaffId: 'u1' })];
    setupHooks({ roster, tables, postings: [{ id: 'p1', title: '공고' }] });
    mockUseAssignTableStaff.mockReturnValue({ mutate });

    const { getByText } = render(
      <StaffTab tournamentId={TID} tournament={tournament({ jobPostingId: 'p1' })} />
    );

    fireEvent.press(getByText('한명'));
    fireEvent.press(getByText('테이블 지정'));
    fireEvent.press(getByText('배정 해제'));

    expect(mutate).toHaveBeenCalledWith({ tableId: 'tb1', staffId: null });
  });

  it('"로스터에서 삭제" 선택 → 확인 다이얼로그 후 삭제 mutate 를 호출한다', () => {
    const mutate = jest.fn();
    const roster = [staff({ staffId: 'u1', staffName: '한명' })];
    setupHooks({ roster, postings: [{ id: 'p1', title: '공고' }] });
    mockUseRemoveOpsStaff.mockReturnValue({ mutate });

    const { getByText } = render(
      <StaffTab tournamentId={TID} tournament={tournament({ jobPostingId: 'p1' })} />
    );

    fireEvent.press(getByText('한명'));
    fireEvent.press(getByText('로스터에서 삭제'));

    expect(alertSpy).toHaveBeenCalled();
    const buttons = alertSpy.mock.calls[0]?.[2] as { text: string; onPress?: () => void }[];
    buttons.find((b) => b.text === '삭제')?.onPress?.();

    expect(mutate).toHaveBeenCalledWith('os-u1');
  });
});

describe('수동 추가', () => {
  it('"+ 스태프 추가" 를 누르면 StaffAddSheet 를 tournamentId 와 함께 연다', () => {
    setupHooks();
    const { getByText } = render(<StaffTab tournamentId={TID} tournament={tournament()} />);

    fireEvent.press(getByText('+ 스태프 추가'));

    expect(addSheetProps).toMatchObject({ visible: true, tournamentId: TID });
  });
});
