/**
 * UNIQN Mobile - 다크모드 짝 누락 래칫
 *
 * @description className 블록에 `text-content-primary` 가 있는데 `dark:text-*` 짝이
 * 없는 곳의 개수를 상한으로 고정한다. 늘어나면 실패한다 (knip 래칫과 같은 방식).
 *
 * ## 배경 — 두 방어가 동시에 실패하는 교집합
 *
 * 2026-07-19 실기기 QA에서 바텀시트("공고 선택", "슬롯 N 모듈")의 옵션 목록이
 * 다크모드에서 보이지 않았다. 같은 파일 안의 자연 실험이 원인을 특정해 준다 —
 * 헤더(정적 className, dark: 짝 있음)는 정상이고 옵션(삼항 + 토큰 단독)만 사라졌다.
 *
 * className 이 다크값을 얻는 경로는 둘인데, 각각 다른 곳에서 깨진다:
 *
 *   정적 className 의 `dark:` 변형  → NativeWind 가 JS colorScheme 으로 해소. 어디서나 동작.
 *   삼항/템플릿 안의 `dark:` 변형   → 정적 추출 실패로 무효 (2026-04-19 sweep 이 확인,
 *                                    eslint.config.js 4d 가 -off-white 형태를 금지).
 *   CSS 변수 토큰 단독              → `.dark` 루트 캐스케이드에 의존. @gorhom/bottom-sheet
 *                                    는 포탈로 루트 밖에 렌더되어 라이트 값이 굳는다.
 *
 * 즉 "삼항 × 포탈" 교집합에서는 허용된 두 방법이 모두 실패한다. 2026-04-19 규칙이
 * 예상하지 못한 구멍이고, 사용자가 본 것이 정확히 그 지점이다.
 * 해법은 같은 토큰을 `dark:` 로 한 번 더 쓰는 것(`text-content-primary
 * dark:text-content-primary`) — nativewind-patterns.md 규칙 1·3 이 정한 형태다.
 *
 * ## 왜 전수 수정이 아니라 래칫인가
 *
 * 남은 카운트가 전부 결함인 것은 아니다. 포탈 밖 일반 화면에서는 토큰 단독으로도
 * 캐스케이드가 정상 동작하며, 같은 QA 회차에서 일반 화면(멤버 초대)과 RNModal 기반
 * 시트(스태프 추가)의 다크모드 텍스트는 멀쩡했다. 근거 없이 56개 파일을 일괄
 * 수정하는 대신, 실제로 깨진 것이 확인된 공용 선택 컴포넌트군만 0 으로 강제하고
 * 나머지는 증가만 막는다.
 */

import fs from 'fs';
import path from 'path';

/**
 * 2026-07-19 기준 잔량. 줄이는 것만 허용한다.
 *
 * 첫 측정은 99 였으나 그건 className 블록 단위 판정(false-green)의 값이었다.
 * 리터럴 단위로 좁히면서 함수 반환 클래스·삼항 분기까지 잡혀 149 가 실측값이다.
 */
const RATCHET_MAX = 149;

/** 실기기에서 실제로 깨진 것이 확인된 컴포넌트군 — 0 을 강제한다. */
const GUARDED_COMPONENTS = [
  'src/components/ui/BottomSheet.tsx',
  'src/components/ui/BottomSheet.web.tsx',
  'src/components/ui/ActionSheet.tsx',
  'src/components/ui/FormSelect.tsx',
  'src/components/ops/MonitorConfigCard.tsx',
];

const SOURCE_ROOTS = ['src', 'app'];
const SOURCE_EXT = /\.(tsx|jsx)$/;
const SKIP_DIR = /node_modules|__tests__|\.expo/;

/**
 * 개별 문자열 리터럴 단위로 검사한다.
 *
 * className 블록 전체를 보면 안 된다 — 결함은 삼항의 *한 분기*에 있는데
 * 다른 분기의 `dark:text-error-400` 이 짝 검사를 만족시켜 버려서, 버그가 있는
 * 상태에서도 통과하는 false-green 가드가 된다 (2026-07-19 리뷰에서 실증 지적).
 * 리터럴 단위로 좁히면 각 분기가 독립적으로 판정된다.
 *
 * 함수 반환값(`return 'text-content-primary';`)처럼 className 밖에 있는 클래스
 * 문자열도 이 방식이면 함께 잡힌다.
 */
const QUOTED_LITERAL = /'[^'\n]*'|"[^"\n]*"/g;
const TEMPLATE_LITERAL = /`[^`]*`/gs;
/** 템플릿 안의 `${...}` 보간부 — 정적 구간만 남기려고 경계로 쓴다 */
const TEMPLATE_INTERPOLATION = /\$\{[\s\S]*?\}/g;

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIR.test(full)) collectSourceFiles(full, acc);
    } else if (SOURCE_EXT.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * 클래스 문자열 후보를 뽑는다.
 *
 * 템플릿 리터럴을 통째로 한 단위로 보면 안 된다 — 안쪽 `${x ? 'a' : 'b'}` 의
 * 다른 분기가 짝 검사를 만족시켜 false-green 이 된다. 템플릿은 `${...}` 를
 * 경계로 쪼개 정적 구간만 취하고, 보간부 안의 따옴표 리터럴은 별도로 수집한다.
 */
function extractClassStrings(source: string): string[] {
  const candidates: string[] = [...(source.match(QUOTED_LITERAL) ?? [])];

  for (const template of source.match(TEMPLATE_LITERAL) ?? []) {
    candidates.push(...template.split(TEMPLATE_INTERPOLATION));
  }

  return candidates;
}

/** 한 소스 문자열 안에서 짝 없는 클래스 문자열 수를 센다. */
function countOffendersIn(source: string): number {
  return extractClassStrings(source).filter(
    (candidate) => candidate.includes('text-content-primary') && !candidate.includes('dark:text-')
  ).length;
}

function countBareTokens(): { total: number; byFile: Record<string, number> } {
  const repoRoot = path.resolve(__dirname, '../../../..');
  const files = SOURCE_ROOTS.flatMap((root) => collectSourceFiles(path.join(repoRoot, root)));

  const byFile: Record<string, number> = {};
  let total = 0;

  for (const file of files) {
    const offenders = countOffendersIn(fs.readFileSync(file, 'utf8'));
    if (offenders > 0) {
      total += offenders;
      byFile[path.relative(repoRoot, file)] = offenders;
    }
  }

  return { total, byFile };
}

describe('다크모드 dark: 짝 래칫', () => {
  it(`bare text-content-primary 가 ${RATCHET_MAX}건을 넘지 않는다`, () => {
    const { total, byFile } = countBareTokens();

    if (total > RATCHET_MAX) {
      const worst = Object.entries(byFile)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([file, count]) => `  ${count}  ${file}`)
        .join('\n');

      throw new Error(
        `다크모드 짝 누락이 ${total}건으로 늘었다 (상한 ${RATCHET_MAX}).\n` +
          `새 className 에 text-content-primary 를 쓸 때는 dark: 짝을 함께 붙일 것.\n` +
          `상위 파일:\n${worst}`
      );
    }

    expect(total).toBeLessThanOrEqual(RATCHET_MAX);
  });

  it('공용 선택 시트/목록 컴포넌트에는 짝 누락이 없다', () => {
    // 실기기에서 실제로 깨진 것이 확인된 컴포넌트군 — 여기는 0을 유지한다.
    const repoRoot = path.resolve(__dirname, '../../../..');

    for (const relative of GUARDED_COMPONENTS) {
      const source = fs.readFileSync(path.join(repoRoot, relative), 'utf8');
      expect(`${relative}: ${countOffendersIn(source)}`).toBe(`${relative}: 0`);
    }
  });

  it('수정 전 코드에서는 red 가 된다 (가드가 실제로 작동함을 증명)', () => {
    // 이 가드의 첫 버전은 className 블록 전체를 봐서, 삼항의 다른 분기에 있는
    // dark:text-error-400 때문에 결함 코드에서도 green 이었다(false-green).
    // 실제로 잡히는지 수정 전 형태로 반증한다.
    const beforeFix = `
      <Text
        className={\`
          text-base font-sans-medium flex-1
          \${option.destructive ? 'text-error-600 dark:text-error-400' : 'text-content-primary'}
        \`}
      >
    `;
    const afterFix = beforeFix.replace(
      "'text-content-primary'",
      "'text-content-primary dark:text-content-primary'"
    );

    expect(countOffendersIn(beforeFix)).toBeGreaterThan(0);
    expect(countOffendersIn(afterFix)).toBe(0);
  });
});
