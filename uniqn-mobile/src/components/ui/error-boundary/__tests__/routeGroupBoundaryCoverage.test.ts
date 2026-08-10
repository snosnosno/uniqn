/**
 * 라우트 그룹마다 에러 경계가 있는가 (감사 err-03)
 *
 * @description 예전에는 루트(`app/_layout.tsx`)와 `(app)` 두 곳에만 경계가 있었다.
 *   나머지 5개 그룹((admin)/(auth)/(employer)/(ops)/(public))에서 렌더 예외가 나면
 *   루트까지 올라가 **앱 전체가 에러 화면**으로 바뀐다. 특히:
 *   - `(auth)`: 로그인 화면이 죽으면 사용자가 재로그인 경로 자체를 잃는다.
 *   - `(ops)`/`(public)`: 라이브 대회 운영·전광판은 현장에서 복구할 사람이 없다.
 *
 *   개별 배선은 다음 그룹이 생기면 또 빠진다. 파일 파싱으로 규약을 고정한다.
 *
 * ⚠️ 이 프로젝트는 expo-router 의 `export function ErrorBoundary` 파일 규약을 쓰지 않고
 *    JSX 로 감싸는 커스텀 컴포넌트 방식을 쓴다(레포 전역 실측). 그래서 검사도
 *    "레이아웃 소스에 경계 컴포넌트가 등장하는가"로 한다.
 */

import fs from 'fs';
import path from 'path';

const APP_ROOT = path.join(__dirname, '..', '..', '..', '..', '..', 'app');

/** 이 중 하나라도 쓰면 경계가 있는 것으로 본다. */
const BOUNDARY_COMPONENTS = ['ScreenErrorBoundary', 'NetworkErrorBoundary', 'FeatureErrorBoundary'];

/** 괄호로 감싼 최상위 라우트 그룹만 본다 — 중첩 그룹은 상위 경계가 덮는다. */
function topLevelRouteGroups(): string[] {
  return fs
    .readdirSync(APP_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\(.+\)$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function hasBoundary(source: string): boolean {
  return BOUNDARY_COMPONENTS.some((component) => new RegExp(`<${component}[\\s>]`).test(source));
}

describe('라우트 그룹 에러 경계 커버리지', () => {
  it('최상위 라우트 그룹이 전부 자체 에러 경계를 갖는다', () => {
    const missing = topLevelRouteGroups().filter((group) => {
      const layout = path.join(APP_ROOT, group, '_layout.tsx');
      if (!fs.existsSync(layout)) return true;
      return !hasBoundary(fs.readFileSync(layout, 'utf8'));
    });

    expect(missing).toEqual([]);
  });

  it('루트 레이아웃도 경계를 유지한다 (최후 방어선)', () => {
    const rootLayout = fs.readFileSync(path.join(APP_ROOT, '_layout.tsx'), 'utf8');

    expect(hasBoundary(rootLayout)).toBe(true);
  });

  it('스캐너가 실제로 그룹을 찾고 있다 (빈 통과 방지)', () => {
    // 경로가 어긋나 0개를 스캔하면 위 테스트가 자동으로 통과한다 — 그 침묵을 막는다.
    const groups = topLevelRouteGroups();

    expect(groups).toEqual(
      expect.arrayContaining(['(admin)', '(app)', '(auth)', '(employer)', '(ops)', '(public)'])
    );
  });
});
