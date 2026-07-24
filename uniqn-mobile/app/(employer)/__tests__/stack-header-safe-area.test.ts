/**
 * 안전지대(SafeArea) 회귀 가드 — (employer) 라우트 화면
 *
 * StackHeader 는 상단 safe-area 인셋을 스스로 처리하지 않고 부모 화면이 SafeAreaView(edges top)
 * 로 감싸주는 것을 전제한다. venue-settlements 화면이 이 래핑을 빠뜨려 헤더가 상태바와 겹쳐
 * 깨져 보였다(안전지대 버그). 이 테스트는 (employer) 최상위 라우트 화면이 StackHeader 를 쓰면서
 * SafeAreaView(또는 useSafeAreaInsets)를 함께 쓰도록 강제해 같은 패턴의 재유입을 막는다.
 *
 * 소스 정적 스캔(렌더 없이) — 새 화면이 규약을 어기면 즉시 실패한다.
 */
import fs from 'fs';
import path from 'path';

const SCREEN_DIR = path.join(__dirname, '..');

/** (employer) 최상위 라우트 화면 파일(하위 폴더/_layout/테스트 제외). */
function listRouteScreens(): string[] {
  return fs
    .readdirSync(SCREEN_DIR, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.tsx') && e.name !== '_layout.tsx')
    .map((e) => e.name);
}

describe('(employer) 라우트 화면 — StackHeader 안전지대 가드', () => {
  const screens = listRouteScreens();

  it('대상 화면이 하나 이상 스캔된다(vacuous green 방지)', () => {
    expect(screens.length).toBeGreaterThan(0);
  });

  it.each(screens)('%s — StackHeader 사용 시 SafeAreaView 로 감싼다', (fileName) => {
    const source = fs.readFileSync(path.join(SCREEN_DIR, fileName), 'utf8');
    if (!source.includes('StackHeader')) return; // 헤더 없는 화면은 대상 아님

    const hasSafeArea = source.includes('SafeAreaView') || source.includes('useSafeAreaInsets');
    expect(hasSafeArea).toBe(true);
  });
});
