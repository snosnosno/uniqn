/**
 * 연쇄 시트 스왑 대기 시간 플랫폼 분기 (연출 B2)
 *
 * @description SHEET_CHAIN_SWAP_MS 는 iOS 네이티브 Modal dismiss 커밋 여유분이라 180ms 다.
 * 웹은 네이티브 Modal 제약이 없으므로 0(즉시)이어야 한다 — 순수 함수로 분리해 플랫폼별
 * 값을 직접 검증한다(Platform.OS 는 jest 런 중 고정이라 함수 인자로 주입).
 */
import { sheetChainSwapMs } from '../animation';

describe('sheetChainSwapMs', () => {
  it('웹은 0 — 네이티브 Modal dismiss 제약이 없어 즉시 전환', () => {
    expect(sheetChainSwapMs('web')).toBe(0);
  });
  it('iOS는 180 — 네이티브 dismiss 커밋 여유분', () => {
    expect(sheetChainSwapMs('ios')).toBe(180);
  });
  it('Android도 180 — 네이티브 Modal 사용', () => {
    expect(sheetChainSwapMs('android')).toBe(180);
  });
});
