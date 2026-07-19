/**
 * 헤더 QR 진입점 — 고정(isFixed) 공고 차단 회귀 가드
 *
 * @description 고정 스케줄 공고에서는 QR 진입점이 **어느 화면에서도** 보이면 안 된다.
 *
 *   이유는 UI 취향이 아니라 데이터 수명이다. `confirm_application` 은 고정 공고에
 *   `dates:['FIXED_SCHEDULE']` 한 원소만 flat INSERT 하므로 **스태프·공고당 work_logs 행이
 *   정확히 1개**이고, 그 행이 모든 근무일에 재사용된다. 그런데 그 행을 `scheduled` 로
 *   되돌리는 크론·트리거·클라 코드가 어디에도 없다:
 *
 *     D일   1차 스캔 → scheduled  → 출근 ✓
 *     D일   2차 스캔 → checked_in → 퇴근 ✓  (행이 checked_out 으로 고정)
 *     D+1~  모든 스캔 → all_checked_out → "오늘 근무는 이미 퇴근 처리됐습니다" ← 영구 실패
 *
 *   행 수명 재설계는 별도 PR 이며, 그때까지 진입점을 노출하지 않는다.
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
 * `<HeaderQRAction` 앞 구문에서 찾는 고정 공고 게이트.
 * `!isFixed` / `!contextIsFixed` / `!(contextIsFixed || isFixed)` 를 모두 받아들인다.
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

describe('헤더 QR 진입점 — 고정 공고 차단', () => {
  it.each(KNOWN_CONSUMERS)('%s 는 HeaderQRAction 을 isFixed 로 게이팅한다', (fileName) => {
    const source = readScreen(fileName);
    const occurrences = [...source.matchAll(/<HeaderQRAction/g)];

    // 소비처인데 사용처가 사라졌다면 목록이 낡은 것 — 조용히 통과시키지 않는다.
    expect(occurrences.length).toBeGreaterThan(0);

    for (const match of occurrences) {
      const start = Math.max(0, (match.index ?? 0) - LOOKBEHIND_CHARS);
      const preceding = source.slice(start, match.index ?? 0);

      expect(preceding).toMatch(FIXED_GATE_PATTERN);
    }
  });

  it('HeaderQRAction 소비처는 알려진 5개뿐이다 (새 소비처는 게이트와 함께 등록할 것)', () => {
    const consumers = listScreenFiles().filter((fileName) =>
      readScreen(fileName).includes('<HeaderQRAction')
    );

    expect(consumers.sort()).toEqual([...KNOWN_CONSUMERS].sort());
  });
});
