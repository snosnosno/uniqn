/**
 * OpsRegisterParticipantSheet — L7 참가 등록 시트 테스트.
 *
 * useRegisterParticipant 모킹, SheetModal 실물 대신 children+footer 통과 스텁(레포 관례:
 * BlindPresetSheet.test.tsx:18-24). 검증: (1) 필드 명시 라벨, (2) 입력→mutation(trim·buyIn 파싱),
 * (3) 이름 없으면 미호출, (4) 성공→onClose + 필드 초기화.
 */
import { render, fireEvent } from '@testing-library/react-native';
import { useRegisterParticipant } from '@/hooks/ops';
import { OpsRegisterParticipantSheet } from '../OpsRegisterParticipantSheet';

const mockMutate = jest.fn();
jest.mock('@/hooks/ops', () => ({
  useRegisterParticipant: jest.fn(() => ({ mutate: mockMutate, isPending: false })),
}));

// SheetModal 실물 대신 children+footer 통과 스텁(레포 관례).
jest.mock('@/components/ui', () => ({
  SheetModal: ({ visible, children, footer }: any) => {
    const { View } = require('react-native');
    return visible ? (
      <View>
        {children}
        {footer}
      </View>
    ) : null;
  },
}));

void useRegisterParticipant;

beforeEach(() => {
  mockMutate.mockReset();
});

it('필드 명시 라벨 노출(placeholder-as-label 제거)', () => {
  const { getByText } = render(
    <OpsRegisterParticipantSheet tournamentId="t1" visible onClose={jest.fn()} />
  );
  expect(getByText(/이름/)).toBeTruthy(); // 필수 마커(*) 중첩 Text 로 결합됨 → 부분 일치
  expect(getByText('국적')).toBeTruthy();
  expect(getByText('바이인 금액')).toBeTruthy();
  expect(getByText('전화번호')).toBeTruthy();
});

it('필드 입력 → 등록 시 mutation 호출(trim·buyIn 숫자 파싱)', () => {
  const { getByLabelText } = render(
    <OpsRegisterParticipantSheet tournamentId="t1" visible onClose={jest.fn()} />
  );
  fireEvent.changeText(getByLabelText('참가자 이름'), '  홍길동  ');
  fireEvent.changeText(getByLabelText('국적'), 'KR');
  fireEvent.changeText(getByLabelText('바이인 금액'), '100,000');
  fireEvent.changeText(getByLabelText('전화번호'), '010-1234-5678');
  fireEvent.press(getByLabelText('등록'));

  expect(mockMutate).toHaveBeenCalledTimes(1);
  expect(mockMutate.mock.calls[0][0]).toEqual({
    name: '홍길동',
    nationality: 'KR',
    phone: '010-1234-5678',
    buyInAmount: 100000,
  });
});

it('이름 없으면 등록 미호출(canSubmit 가드)', () => {
  const { getByLabelText } = render(
    <OpsRegisterParticipantSheet tournamentId="t1" visible onClose={jest.fn()} />
  );
  fireEvent.press(getByLabelText('등록'));
  expect(mockMutate).not.toHaveBeenCalled();
});

it('등록 성공 → onClose 호출 + 필드 초기화', () => {
  mockMutate.mockImplementation((_input, opts) => opts?.onSuccess?.());
  const onClose = jest.fn();
  const { getByLabelText } = render(
    <OpsRegisterParticipantSheet tournamentId="t1" visible onClose={onClose} />
  );
  const nameInput = getByLabelText('참가자 이름');
  fireEvent.changeText(nameInput, '홍길동');
  fireEvent.press(getByLabelText('등록'));

  expect(onClose).toHaveBeenCalledTimes(1);
  // 성공 후 이름 필드 초기화(resetFields)
  expect(getByLabelText('참가자 이름').props.value).toBe('');
});
