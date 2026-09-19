/**
 * 공고 상세 트리 — useJobDetail 단일 호출 계약.
 *
 * @description 공고 데이터는 레이아웃(`_layout.tsx`)이 realtime 구독과 함께 **한 번만** 조회하고,
 *   자식 화면 6곳은 `useJobDetailContext()` 로 그 값을 받는다. 자식이 `useJobDetail` 을 직접
 *   부르면 같은 id 로 훅 인스턴스가 늘어나고, `realtime: true` 면 `subscribeToJobPosting` 이
 *   **인스턴스마다** 열린다 — `useJobDetail.ts` 의 구독 effect 에는 디듀프가 없다.
 *   실제로 레이아웃과 index 가 각자 realtime 구독을 열어 채널이 2개였다.
 *
 * @remarks 소스 텍스트 계약 테스트다(선례: `employerQRRouteContract.test.ts`).
 *   렌더 테스트로는 이 회귀를 잡을 수 없다 — 중복 호출은 **같은 queryKey** 를 공유해서
 *   값이 수렴하고, 화면에 보이는 차이를 만들지 않는다. 구독이 몇 개 열렸는지는
 *   화면 출력이 아니라 훅 인스턴스 수의 함수라 정적으로 고정하는 편이 정직하다.
 *
 *   이 테스트가 보장하는 것은 "자식은 컨텍스트만 쓴다"까지다. 구독이 런타임에 실제로
 *   1개인지는 실기기/웹 세션에서 채널 수를 관찰해야 확인된다(사람 게이트).
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const SCREEN_DIR = join(__dirname, '..');

/** 상세 트리의 자식 라우트 전량 — 하나라도 빠지면 그 화면이 조용히 되돌아간다. */
const CHILD_SCREENS = [
  'index.tsx',
  'applicants.tsx',
  'settlements.tsx',
  'edit.tsx',
  'cancellation-requests.tsx',
  'collaborators.tsx',
  'qr.tsx',
] as const;

function readScreen(file: string): string {
  return readFileSync(join(SCREEN_DIR, file), 'utf-8');
}

describe('공고 상세 트리 — useJobDetail 단일 호출 계약', () => {
  it.each(CHILD_SCREENS)('%s 는 useJobDetail 을 직접 호출하지 않는다', (file) => {
    const source = readScreen(file);

    // 호출부만 잡는다 — 주석에 등장하는 훅 이름(설명)은 계약 위반이 아니다.
    expect(source).not.toMatch(/\buseJobDetail\s*\(/);
    expect(source).not.toMatch(/from '@\/hooks\/useJobDetail'/);
  });

  it.each(CHILD_SCREENS)('%s 는 공고를 useJobDetailContext 로 받는다', (file) => {
    const source = readScreen(file);

    // qr/applicants 를 포함해 모든 자식이 컨텍스트 소비자여야 헤더 구성(QR·제목)이 일치한다.
    expect(source).toMatch(/useJobDetailContext\s*\(/);
  });

  it('_layout.tsx 만 useJobDetail 을 부르고, realtime 구독은 그 한 번뿐이다', () => {
    const source = readScreen('_layout.tsx');

    const calls = source.match(/\buseJobDetail\s*\(/g) ?? [];
    expect(calls).toHaveLength(1);
    expect(source).toMatch(/useJobDetail\([^)]*\{\s*realtime:\s*true\s*\}/);
  });
});
