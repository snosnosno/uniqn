/**
 * 안전지대(SafeArea) 회귀 가드 — StackHeader 를 쓰는 모든 라우트 화면
 *
 * StackHeader 는 상단 safe-area 인셋을 스스로 처리하지 않고, 부모 화면이
 * `SafeAreaView`(top 엣지 포함) 또는 `useSafeAreaInsets` 로 상단 여백을 확보해 주는 것을
 * 전제한다. 이 전제를 빠뜨리면 헤더 제목이 상태바(시계·배터리) 아래로 파고들어 겹쳐 보인다.
 *
 * @history
 * - venue-settlements 가 래핑 자체를 빠뜨려 헤더가 상태바와 겹쳤다 → (employer) 최상위만
 *   스캔하는 가드를 도입.
 * - my-postings/[id]/qr.tsx 가 `edges={['bottom']}` 로 감싸 **같은 증상**이 재발했다.
 *   구 가드는 (1) 하위 폴더를 스캔하지 않았고 (2) "SafeAreaView 라는 글자가 있는지"만 봐서
 *   top 엣지 누락을 통과시켰다(vacuous green).
 *
 * 그래서 이 가드는 `app/` 전체를 재귀 스캔하고, **top 엣지가 실제로 확보되는지**까지 본다.
 *
 * 소스 정적 스캔(렌더 없이) — 새 화면이 규약을 어기면 즉시 실패한다.
 */
import fs from 'fs';
import path from 'path';

const APP_DIR = path.join(__dirname, '..');

/** 스캔 제외 디렉터리 — 테스트/스냅샷은 규약 대상이 아니다. */
const EXCLUDED_DIRS = new Set(['__tests__', '__snapshots__', 'node_modules']);

/** `app/` 아래 모든 .tsx 소스를 재귀 수집한다(테스트 제외). */
function listAppSources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return EXCLUDED_DIRS.has(entry.name) ? [] : listAppSources(fullPath);
    }

    return entry.isFile() && entry.name.endsWith('.tsx') && !entry.name.includes('.test.')
      ? [fullPath]
      : [];
  });
}

/**
 * 상단 인셋이 확보되는 소스인지 판정한다.
 *
 * - `useSafeAreaInsets` 사용 → 직접 계산하므로 통과
 * - `edges` 를 아예 안 준 `SafeAreaView` → 기본값이 4방향 전체라 통과
 * - `edges={[...]}` 중 **하나라도** 'top' 을 포함하면 통과
 *   (본문은 top+bottom, 하단 고정 CTA 는 bottom 만 주는 화면이 정상적으로 존재한다)
 */
function hasTopInset(source: string): boolean {
  if (source.includes('useSafeAreaInsets')) {
    return true;
  }

  if (!source.includes('SafeAreaView')) {
    return false;
  }

  const edgesProps = source.match(/edges=\{\[[^\]]*\]\}/g);

  // edges 를 지정하지 않은 SafeAreaView 는 기본값(전체 엣지)이라 top 이 포함된다.
  if (!edgesProps) {
    return true;
  }

  return edgesProps.some((prop) => /['"]top['"]/.test(prop));
}

describe('StackHeader 안전지대 가드 — app/ 전체', () => {
  const sources = listAppSources(APP_DIR);
  const stackHeaderScreens = sources.filter((filePath) =>
    fs.readFileSync(filePath, 'utf8').includes('<StackHeader')
  );

  it('StackHeader 를 쓰는 화면이 충분히 스캔된다(vacuous green 방지)', () => {
    // 구 가드가 하위 폴더를 놓쳐 qr.tsx 를 못 잡았다. 최소 20개는 잡혀야 정상 스캔이다.
    expect(stackHeaderScreens.length).toBeGreaterThan(20);
  });

  it.each(stackHeaderScreens.map((filePath) => [path.relative(APP_DIR, filePath), filePath]))(
    '%s — 상단 safe-area 인셋을 확보한다',
    (_relativePath, filePath) => {
      expect(hasTopInset(fs.readFileSync(filePath, 'utf8'))).toBe(true);
    }
  );
});
