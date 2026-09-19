/**
 * 헤더 QR 진입점 — 모든 공고 지원 회귀 가드
 *
 * @description 고정 스케줄도 서버가 FIXED_SCHEDULE 템플릿에서 날짜별 근무를 생성하므로
 *   QR 진입점을 일반 공고와 동일하게 보여준다.
 *
 * @remarks 왜 렌더링 테스트가 아니라 소스 구조 검사인가 — 이 결함의 실패 양식은 "한 화면에서
 *   로직이 틀렸다"가 아니라 **"5개 소비처 중 하나에 게이트를 빠뜨렸다"** 이다. 그러면 사용자는
 *   탭을 옮길 때마다 버튼이 나타났다 사라지는 걸 본다. 화면 5개를 각각 렌더하려면 화면마다
 *   수십 개의 목이 필요하고(기존 liveOps 테스트가 StackHeader·HeaderQRAction 을 null 로
 *   목킹하는 이유), 정작 검증하려는 "빠뜨림"은 새 소비처가 생길 때 발생하므로 렌더 테스트로는
 *   자동으로 잡히지 않는다. 소비처 목록 자체를 검사하면 새 소비처가 게이트 없이 추가될 때 터진다.
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const SCREEN_DIR = join(__dirname, '..');

/** HeaderQRAction 을 렌더링하는 것으로 알려진 소비처 (경로는 SCREEN_DIR 기준) */
const KNOWN_CONSUMERS = [
  'index.tsx',
  'applicants.tsx',
  'settlements.tsx',
  'edit.tsx',
  'cancellation-requests.tsx',
] as const;

/**
 * `<HeaderQRAction` 앞 구문에서 과거 고정 공고 차단 게이트가 되살아났는지 검사한다.
 */
const FIXED_GATE_PATTERN = /!\s*\(?\s*(context)?[iI]sFixed/;

/** prettier 가 줄을 접어도 견디도록 사용처 직전 구문을 넉넉히 본다. */
const LOOKBEHIND_CHARS = 240;

function readScreen(fileName: string): string {
  return readFileSync(join(SCREEN_DIR, fileName), 'utf8');
}

function listScreenFiles(): string[] {
  return readdirSync(SCREEN_DIR).filter((name) => name.endsWith('.tsx'));
}

describe('헤더 QR 진입점 — 모든 공고 지원', () => {
  it.each(KNOWN_CONSUMERS)('%s 는 고정 공고에서도 HeaderQRAction 을 노출한다', (fileName) => {
    const source = readScreen(fileName);
    const occurrences = [...source.matchAll(/<HeaderQRAction/g)];

    // 소비처인데 사용처가 사라졌다면 목록이 낡은 것 — 조용히 통과시키지 않는다.
    expect(occurrences.length).toBeGreaterThan(0);

    for (const match of occurrences) {
      const start = Math.max(0, (match.index ?? 0) - LOOKBEHIND_CHARS);
      const preceding = source.slice(start, match.index ?? 0);

      expect(preceding).not.toMatch(FIXED_GATE_PATTERN);
    }
  });

  it('HeaderQRAction 소비처는 알려진 5개뿐이다 (새 소비처도 목록에 등록할 것)', () => {
    const consumers = listScreenFiles().filter((fileName) =>
      readScreen(fileName).includes('<HeaderQRAction')
    );

    expect(consumers.sort()).toEqual([...KNOWN_CONSUMERS].sort());
  });
});
