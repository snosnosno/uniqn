/**
 * stickyHeaderIndices 회귀 가드 — ScrollView 직계 자식에 Fragment 금지
 *
 * RN `ScrollView` 는 `React.Children.toArray(children)` 의 **인덱스**로 sticky 자식을 고른다
 * (`ScrollView.js` — toArray 후 index 매칭). 그런데 `React.Children.toArray` 는 배열만
 * 평탄화하고 **Fragment 는 자식 1개로 센다**.
 *
 * 그래서 `<>{헤더}{카드묶음}</>` 처럼 감싸면 `stickyHeaderIndices={[1]}` 가 헤더가 아니라
 * '헤더 + 카드 전체'를 가리킨다 → 카드 묶음 전체가 상단에 고정돼 스크롤로 밀려나지 않고,
 * 그 아래 콘텐츠에 도달할 수 없다. 리스트가 길수록 증상이 커진다.
 *
 * @history 내 스케줄 캘린더 뷰에서 실제로 발생(선택일 카드가 많아지면 아래로 스크롤 불가).
 *   같은 파일의 리스트 뷰는 flatMap 으로 평평하게 넣어 이미 이 함정을 피하고 있었다.
 *
 * 소스 정적 스캔(렌더 없이).
 */
import fs from 'fs';
import path from 'path';

const ROOTS = [path.join(__dirname, '..'), path.join(__dirname, '..', '..', 'src')];
const EXCLUDED_DIRS = new Set(['__tests__', '__snapshots__', 'node_modules']);

function listSources(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return EXCLUDED_DIRS.has(entry.name) ? [] : listSources(fullPath);
    }

    return entry.isFile() && entry.name.endsWith('.tsx') && !entry.name.includes('.test.')
      ? [fullPath]
      : [];
  });
}

/**
 * `stickyHeaderIndices` 가 달린 ScrollView 본문(해당 prop ~ 닫는 태그)들을 잘라낸다.
 * 자식 인덱스가 어긋나는 사고는 이 구간에서만 발생한다.
 */
function extractStickyScrollViewBodies(source: string): string[] {
  const bodies: string[] = [];
  let cursor = source.indexOf('stickyHeaderIndices');

  while (cursor !== -1) {
    const end = source.indexOf('</ScrollView>', cursor);
    bodies.push(end === -1 ? source.slice(cursor) : source.slice(cursor, end));
    cursor = source.indexOf('stickyHeaderIndices', cursor + 1);
  }

  return bodies;
}

/** JSX Fragment 단축 문법(`<>`) — 여는 태그만 찾으면 충분하다. */
const JSX_FRAGMENT_OPEN = /<>/;

describe('stickyHeaderIndices 가드 — ScrollView 자식에 Fragment 금지', () => {
  const sources = listSources(ROOTS[0]!).concat(listSources(ROOTS[1]!));
  const stickyFiles = sources.filter((filePath) =>
    fs.readFileSync(filePath, 'utf8').includes('stickyHeaderIndices')
  );

  it('stickyHeaderIndices 를 쓰는 화면이 스캔된다(vacuous green 방지)', () => {
    expect(stickyFiles.length).toBeGreaterThan(0);
  });

  it.each(stickyFiles.map((filePath) => [path.basename(filePath), filePath]))(
    '%s — sticky ScrollView 자식에 Fragment 가 없다',
    (_name, filePath) => {
      const bodies = extractStickyScrollViewBodies(fs.readFileSync(filePath, 'utf8'));

      expect(bodies.length).toBeGreaterThan(0);
      bodies.forEach((body) => {
        expect(JSX_FRAGMENT_OPEN.test(body)).toBe(false);
      });
    }
  );
});
