/**
 * 사장 QR 진입점 도착지 계약 테스트
 *
 * @description 사장이 고정 QR 화면으로 갈 수 있는 진입점은 두 곳이다.
 *   ① 공고 목록 카드의 QR 버튼      — app/(app)/(tabs)/employer.tsx
 *   ② 공고 상세 헤더의 QR 액션 버튼 — app/(employer)/my-postings/[id]/_layout.tsx
 *   회전 QR 시절엔 각자 다른 모달을 띄웠고, 고정 QR 전환에서 **같은 전용 화면**으로 통일했다.
 *   이 테스트는 둘 중 하나만 딴 데로 새는 회귀를 잡는다.
 *
 * @remarks 소스 텍스트 계약 테스트다 — 두 진입점의 router.push 인자를 소스에서 뽑아
 *   EXPO_ROUTES.postingQR 과 대조한다. 런타임 렌더 테스트로 만들지 않은 이유는
 *   두 파일 모두 화면 전체(useJobDetail·스토어·Stack)를 끌고 와야 해서
 *   회귀 1건을 잡자고 치르기엔 비용이 크고, 정작 기존 테스트들은
 *   handleShowQR 을 모킹해 **실제 경로를 덮지 못하고 있기** 때문이다.
 *
 *   따라서 이 테스트가 보장하는 것은 "두 진입점이 같은 경로 문자열을 쓴다"까지다.
 *   경로가 실제로 화면을 띄우는지(네비게이션 동작)는 실기기 QA 항목으로 남는다.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { EXPO_ROUTES } from '../RouteRegistry';

const PROJECT_ROOT = join(__dirname, '..', '..', '..', '..');

/** handleShowQR 콜백 안의 router.push(`...`) 템플릿 리터럴을 뽑는다 */
function extractShowQRPushTemplate(relativePath: string): string {
  const absolutePath = join(PROJECT_ROOT, relativePath);
  const source = readFileSync(absolutePath, 'utf-8');

  const handlerMatch = source.match(/const handleShowQR = useCallback\([\s\S]*?\}, \[[^\]]*\]\);/);
  if (!handlerMatch) {
    throw new Error(`${relativePath}: handleShowQR useCallback 을 찾지 못했습니다`);
  }

  const pushMatch = handlerMatch[0].match(/router\.push\(\s*`([^`]+)`\s*\)/);
  if (!pushMatch) {
    throw new Error(`${relativePath}: handleShowQR 안에서 router.push(\`...\`) 를 찾지 못했습니다`);
  }

  // `${posting.id}` / `${id ?? ''}` 등 보간부를 expo-router 동적 세그먼트 표기로 정규화
  return pushMatch[1].replace(/\$\{[^}]*\}/g, '[id]');
}

const ENTRY_POINTS = {
  '공고 목록 카드 QR 버튼': 'app/(app)/(tabs)/employer.tsx',
  '공고 상세 헤더 QR 액션': 'app/(employer)/my-postings/[id]/_layout.tsx',
} as const;

describe('사장 QR 진입점 도착지 계약', () => {
  it('고정 QR 화면 라우트 파일이 실재한다', () => {
    expect(existsSync(join(PROJECT_ROOT, 'app/(employer)/my-postings/[id]/qr.tsx'))).toBe(true);
  });

  it.each(Object.entries(ENTRY_POINTS))(
    '%s 는 EXPO_ROUTES.postingQR 로 이동한다',
    (_label, relativePath) => {
      expect(extractShowQRPushTemplate(relativePath)).toBe(EXPO_ROUTES.postingQR);
    }
  );

  it('두 진입점의 도착지가 서로 같다', () => {
    const [first, second] = Object.values(ENTRY_POINTS).map(extractShowQRPushTemplate);
    expect(first).toBe(second);
  });
});
