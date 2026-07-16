/**
 * TaxSettingsEditor — 세금 설정 에디터 테스트
 *
 * A8 트랩 해소 계약: 세후 미리보기 블록은 실정산(항목별 제외 반영)과 산식이 달라
 * 신규 사용처에서 갈라진 금액을 노출하는 트랩이었다. 미리보기 블록을 제거했으므로
 * showPreview가 참이고 totalAmount가 주어져도 미리보기는 렌더되지 않는다.
 */
import { render } from '@testing-library/react-native';
import React from 'react';
import { TaxSettingsEditor, type TaxSettings } from '../TaxSettingsEditor';

describe('TaxSettingsEditor', () => {
  it('showPreview가 참이고 totalAmount가 있어도 세후 미리보기를 렌더하지 않는다 (트랩 제거)', () => {
    const taxSettings: TaxSettings = { type: 'rate', value: 3.3 };
    const { queryByText } = render(
      <TaxSettingsEditor
        taxSettings={taxSettings}
        onChange={jest.fn()}
        totalAmount={100000}
        showPreview
      />
    );

    // 미리보기 블록에만 존재하던 레이블 — 제거되어 어디에도 없어야 한다
    expect(queryByText('세후 금액')).toBeNull();
  });

  it('세금 타입 라디오와 적용 대상 항목은 정상 렌더된다 (기능 보존)', () => {
    const taxSettings: TaxSettings = { type: 'rate', value: 3.3 };
    const { getByText } = render(
      <TaxSettingsEditor taxSettings={taxSettings} onChange={jest.fn()} />
    );

    expect(getByText('없음')).toBeTruthy();
    expect(getByText('세율')).toBeTruthy();
    expect(getByText('고정 금액')).toBeTruthy();
    // 적용 대상 항목(rate 타입일 때 노출)
    expect(getByText('식비')).toBeTruthy();
    expect(getByText('교통비')).toBeTruthy();
  });
});
