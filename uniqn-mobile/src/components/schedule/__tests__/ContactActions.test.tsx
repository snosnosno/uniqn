/**
 * ContactActions — 구인자 연락 액션 회귀 테스트.
 *
 * 고정하는 것:
 *  1. 전화만 있던 시절의 막다른 길을 다시 만들지 않는다 — 문자 경로가 반드시 있다
 *  2. `tel:`/`sms:` 를 `Linking.openURL` 로 직접 부르지 않는다. 핸들러 앱이 없는 기기에서
 *     reject 되면 catch 없이는 unhandled rejection 으로 조용히 죽는다(Sentry UNIQN-MOBILE-1F).
 *     `openExternalUrl` 이 실패를 흡수하고 번호를 그대로 보여준다.
 *  3. 폴백에 보여줄 번호는 저장 형식(E.164)이 아니라 사람이 읽는 형식이어야 한다 —
 *     '+821012345678' 을 받아 적게 하면 안내가 안내 구실을 못 한다.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ContactActions } from '../ContactActions';

const mockOpenExternalUrl = jest.fn().mockResolvedValue(true);

jest.mock('@/utils/externalLink', () => ({
  openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...args),
}));

describe('ContactActions', () => {
  beforeEach(() => {
    mockOpenExternalUrl.mockClear();
  });

  it('전화와 문자 경로를 함께 제공한다', () => {
    const { getByText } = render(<ContactActions phone="01012345678" />);

    expect(getByText('전화하기')).toBeTruthy();
    expect(getByText('문자하기')).toBeTruthy();
  });

  it('전화하기는 tel: 스킴으로 연다', () => {
    const { getByText } = render(<ContactActions phone="01012345678" />);

    fireEvent.press(getByText('전화하기'));

    expect(mockOpenExternalUrl).toHaveBeenCalledWith('tel:01012345678', expect.anything());
  });

  it('문자하기는 sms: 스킴으로 연다', () => {
    const { getByText } = render(<ContactActions phone="01012345678" />);

    fireEvent.press(getByText('문자하기'));

    expect(mockOpenExternalUrl).toHaveBeenCalledWith('sms:01012345678', expect.anything());
  });

  it('🔴 스킴에는 원본 번호를, 폴백 안내에는 사람이 읽는 번호를 쓴다', () => {
    const { getByText } = render(<ContactActions phone="+821012345678" />);

    fireEvent.press(getByText('문자하기'));

    const [url, options] = mockOpenExternalUrl.mock.calls[0];
    expect(url).toBe('sms:+821012345678');
    expect(options.fallbackValue).toBe('010-1234-5678');
  });

  it('두 버튼 모두 번호를 포함한 접근성 라벨을 갖는다', () => {
    const { getByRole } = render(<ContactActions phone="01012345678" />);

    expect(getByRole('button', { name: '구인자에게 전화하기 010-1234-5678' })).toBeTruthy();
    expect(getByRole('button', { name: '구인자에게 문자하기 010-1234-5678' })).toBeTruthy();
  });
});
