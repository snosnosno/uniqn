/**
 * BlindPresetSheet — 블라인드 프리셋 시트(계획 B, B4·B5) 테스트.
 *
 * 훅(@/hooks/ops)은 전량 모킹, SheetModal 실물 대신 자식 통과 스텁(레포 관례:
 * OpsParticipantActionSheet.test.tsx:13-19). 검증: (1) 앱 기본 프리셋 상시 노출,
 * (2) 적용=전체교체 확인 후 onApply(levels) 호출(기본 30레벨).
 */
import { render, fireEvent } from '@testing-library/react-native';
import { useOpsBlindPresets, useSaveBlindPreset, useDeleteBlindPreset } from '@/hooks/ops';
import { BlindPresetSheet } from '../BlindPresetSheet';

jest.mock('@/hooks/ops', () => ({
  useOpsBlindPresets: jest.fn(() => ({ presets: [], isLoading: false })),
  useSaveBlindPreset: jest.fn(() => ({ mutate: jest.fn() })),
  useDeleteBlindPreset: jest.fn(() => ({ mutate: jest.fn() })),
}));

// SheetModal 실물 대신 자식 통과 스텁(레포 관례).
jest.mock('@/components/ui/SheetModal', () => ({
  SheetModal: ({ visible, children }: any) => {
    const { View } = require('react-native');
    return visible ? <View>{children}</View> : null;
  },
}));

void useOpsBlindPresets;
void useSaveBlindPreset;
void useDeleteBlindPreset;

it('앱 기본 프리셋(기본 30레벨) 항상 노출', () => {
  const { getByText } = render(
    <BlindPresetSheet visible onClose={jest.fn()} currentLevels={[]} onApply={jest.fn()} />
  );
  expect(getByText('기본 30레벨')).toBeTruthy();
});

it('프리셋 적용 → 확인 후 onApply(levels)', () => {
  const onApply = jest.fn();
  jest
    .spyOn(require('@/utils/confirmAction'), 'confirmAction')
    .mockImplementation((o: any) => o.onConfirm());
  const { getByText } = render(
    <BlindPresetSheet visible onClose={jest.fn()} currentLevels={[]} onApply={onApply} />
  );
  fireEvent.press(getByText('기본 30레벨'));
  expect(onApply).toHaveBeenCalled();
  expect(onApply.mock.calls[0][0]).toHaveLength(30); // 기본 30레벨 적용
});

it('사용자 프리셋: 삭제 버튼이 적용 Pressable과 형제(중첩 금지 — 웹 button-in-button 방지)', () => {
  (useOpsBlindPresets as jest.Mock).mockReturnValue({
    presets: [{ id: 'p1', name: '내프리셋', levels: [{ level: 1 }] }],
    isLoading: false,
  });
  const { getByText, getByLabelText } = render(
    <BlindPresetSheet visible onClose={jest.fn()} currentLevels={[]} onApply={jest.fn()} />
  );
  // 삭제 노드의 조상 중 '적용' 버튼(role=button + 이름 텍스트 포함)이 있으면
  // <button> in <button> 중첩이다 — 형제 구조면 그런 조상이 없어야 한다.
  const del = getByLabelText('프리셋 삭제');
  let nestedUnderApply = false;
  let node: typeof del | null = del.parent;
  while (node) {
    const isButton = node.props?.accessibilityRole === 'button';
    const containsName = isButton && node.findAllByProps({ children: '내프리셋' }).length > 0;
    if (containsName) {
      nestedUnderApply = true;
      break;
    }
    node = node.parent;
  }
  expect(nestedUnderApply).toBe(false);
  // 삭제는 별도 형제로 존재해야 한다.
  expect(getByText('삭제')).toBeTruthy();
});
