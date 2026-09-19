/**
 * CollapsibleSection — 접힘 상태가 **눈에 보이는가** 계약 테스트
 *
 * 🔴 접힘/펼침을 `accessibilityState.expanded` 로 단언하지 않는다. react-native-web 0.21.2 는
 *    `accessibilityState` 를 아예 처리하지 않아 웹에서 읽히지 않는다(2026-08-06 실측).
 *    상태의 진실원은 ①자식 렌더 여부 ②요약 줄의 존재 ③토글 라벨('펼치기'/'접기') 셋뿐이고,
 *    이 스위트는 그 셋만 본다. prop 이 아니라 화면을 검사한다.
 *
 * D6: 예정·역할 섹션은 기본 접힘이다. 홀덤펍 사장이 매일 고치는 것은 실적이고, 예정·역할은
 * 드물다 — 기본 펼침으로 되돌리면 이 스위트의 첫 테스트가 red 가 된다.
 */
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';

import { CollapsibleSection } from '../CollapsibleSection';

describe('CollapsibleSection — 기본 접힘(D6)', () => {
  it('기본은 접혀 있고 요약만 보인다', () => {
    render(
      <CollapsibleSection title="출근 예정" summary="18:00">
        <Text>내용</Text>
      </CollapsibleSection>
    );

    expect(screen.getByText('출근 예정')).toBeTruthy();
    expect(screen.getByText('18:00')).toBeTruthy();
    // 자식이 마운트조차 되지 않았는가 — 숨김 스타일이 아니라 미렌더여야 한다.
    expect(screen.queryByText('내용')).toBeNull();
  });

  it('탭하면 펼쳐진다', () => {
    render(
      <CollapsibleSection title="출근 예정" summary="18:00">
        <Text>내용</Text>
      </CollapsibleSection>
    );

    fireEvent.press(screen.getByLabelText('출근 예정 펼치기'));

    expect(screen.getByText('내용')).toBeTruthy();
  });

  it('펼치면 요약 줄을 감춘다 — 아래에 실값이 이미 있어 중복이다', () => {
    render(
      <CollapsibleSection title="출근 예정" summary="18:00">
        <Text>내용</Text>
      </CollapsibleSection>
    );

    fireEvent.press(screen.getByLabelText('출근 예정 펼치기'));

    expect(screen.queryByText('18:00')).toBeNull();
  });

  it('펼친 뒤 다시 탭하면 접힌다', () => {
    // 토글이 단방향(펼치기만)이면 이 단언이 red 다 — 첫 테스트만으로는 못 잡는 결함이다.
    render(
      <CollapsibleSection title="출근 예정" summary="18:00">
        <Text>내용</Text>
      </CollapsibleSection>
    );

    fireEvent.press(screen.getByLabelText('출근 예정 펼치기'));
    fireEvent.press(screen.getByLabelText('출근 예정 접기'));

    expect(screen.queryByText('내용')).toBeNull();
    expect(screen.getByText('18:00')).toBeTruthy();
  });

  it('토글 라벨이 상태를 말한다 — 접힘이면 "펼치기", 펼침이면 "접기"', () => {
    // 라벨이 고정 문자열이면(예: 항상 '출근 예정 토글') 음성 제어 사용자가 현재 상태를 모른다.
    render(
      <CollapsibleSection title="출근 예정" summary="18:00">
        <Text>내용</Text>
      </CollapsibleSection>
    );

    expect(screen.queryByLabelText('출근 예정 접기')).toBeNull();

    fireEvent.press(screen.getByLabelText('출근 예정 펼치기'));

    expect(screen.queryByLabelText('출근 예정 펼치기')).toBeNull();
    expect(screen.getByLabelText('출근 예정 접기')).toBeTruthy();
  });

  it('defaultExpanded 면 처음부터 자식이 보인다', () => {
    render(
      <CollapsibleSection title="실제 출퇴근" summary="18:00 ~ 02:00" defaultExpanded>
        <Text>내용</Text>
      </CollapsibleSection>
    );

    expect(screen.getByText('내용')).toBeTruthy();
    expect(screen.queryByText('18:00 ~ 02:00')).toBeNull();
    expect(screen.getByLabelText('실제 출퇴근 접기')).toBeTruthy();
  });
});
