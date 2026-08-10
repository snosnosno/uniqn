/**
 * 쓰기 mutationFn = 오프라인 가드 필수 (감사 err-02 / arch-01)
 *
 * @description `useOpsMutations.ts` 헤더는 "모든 쓰기 mutationFn 첫 줄에서
 *   `requireOnlineForMutation`" 을 규약으로 선언해 놓았지만, 강제하는 장치가 없어서
 *   누락이 반복됐다. #451 이 44곳을 배선한 뒤에도 나머지 도메인 78곳이 남아 있었고,
 *   같은 파일 안에서조차 `useRecordOpsAttendance` 하나만 규약을 어기고 있었다(arch-01).
 *
 *   개별 수정만으로는 **다섯 번째 누락**이 또 나온다. 그래서 규약을 파일 파싱형
 *   회귀 테스트로 승격한다 — 새 mutationFn 을 가드 없이 추가하면 여기서 빨개진다.
 *
 * ## 왜 "차단"인가 (큐잉이 아니라)
 * queryClient 의 mutations 는 `networkMode: 'offlineFirst'` 라 pause/resume 이 없다.
 * 가드가 없으면 요청이 그대로 발사돼 원인 불명 토스트만 남는다.
 *
 * ## 예외를 추가하려면
 * `LOCAL_ONLY_MUTATIONS` 에 **사유와 함께** 적어라. 사유 없는 예외는 규약을 지운다.
 */

import fs from 'fs';
import path from 'path';

const HOOKS_ROOT = path.join(__dirname, '..', '..', '..', 'hooks');

/**
 * 원격 쓰기가 아닌 mutationFn — 오프라인에서도 동작해야 하므로 가드를 걸지 않는다.
 * 키는 `src/` 기준 상대 경로, 값은 { 면제 개수, 사유 }.
 */
const LOCAL_ONLY_MUTATIONS: Record<string, { exempt: number; reason: string }> = {
  'hooks/useBiometricAuth.ts': {
    exempt: 2,
    reason:
      '생체인증 사용/해제는 기기 로컬 SecureStore 조작이다. 오프라인에서 막으면 ' +
      '사용자가 생체인증을 끄지도 못하는 상태에 갇힌다 — 차단이 오히려 결함이다.',
  },
};

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue;
      walk(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

interface FileReport {
  relativePath: string;
  mutationCount: number;
  guardCount: number;
  exempt: number;
  reason?: string;
}

function analyze(): FileReport[] {
  return walk(HOOKS_ROOT)
    .map((file) => {
      const source = fs.readFileSync(file, 'utf8');
      const mutationCount = (source.match(/^\s*mutationFn:/gm) ?? []).length;
      const imported = /import\s*\{[^}]*requireOnlineForMutation/s.test(source);
      const guardCount = imported ? (source.match(/requireOnlineForMutation\(/g) ?? []).length : 0;

      const relativePath = path
        .relative(path.join(HOOKS_ROOT, '..'), file)
        .split(path.sep)
        .join('/');

      const exemption = LOCAL_ONLY_MUTATIONS[relativePath];

      return {
        relativePath,
        mutationCount,
        guardCount,
        exempt: exemption?.exempt ?? 0,
        reason: exemption?.reason,
      };
    })
    .filter((report) => report.mutationCount > 0);
}

describe('오프라인 가드 커버리지', () => {
  it('모든 쓰기 mutationFn 이 requireOnlineForMutation 을 통과한다', () => {
    const gaps = analyze().filter(
      (report) => report.mutationCount - report.exempt > report.guardCount
    );

    // 실패 메시지를 단언 값 자체에 담는다 — 어느 파일 몇 개가 비었는지 바로 보여야
    // 다음 사람이 스캐너를 다시 짜지 않는다.
    const detail = gaps.map(
      (report) =>
        `${report.relativePath}: mutationFn ${report.mutationCount}` +
        (report.exempt ? ` (면제 ${report.exempt})` : '') +
        ` vs 가드 ${report.guardCount}`
    );

    expect(detail).toEqual([]);
  });

  it('면제 목록의 파일이 실재하고, 면제 수가 실제 mutationFn 수를 넘지 않는다', () => {
    // 면제가 실체를 잃으면(파일 이동·mutation 삭제) 규약에 조용한 구멍이 남는다.
    const reports = analyze();

    const stale = Object.entries(LOCAL_ONLY_MUTATIONS).flatMap(
      ([relativePath, { exempt, reason }]) => {
        const report = reports.find((entry) => entry.relativePath === relativePath);

        if (!report) {
          return [`${relativePath}: 더 이상 mutationFn 을 갖지 않는다 (면제를 지워라)`];
        }
        if (report.mutationCount < exempt) {
          return [
            `${relativePath}: 면제 ${exempt} 가 실제 mutationFn ${report.mutationCount} 보다 많다`,
          ];
        }
        if (reason.trim().length <= 20) {
          return [`${relativePath}: 면제 사유가 비어 있거나 너무 짧다`];
        }
        return [];
      }
    );

    expect(stale).toEqual([]);
  });

  it('스캐너가 실제로 무언가를 세고 있다 (빈 통과 방지)', () => {
    // 경로가 어긋나 0개를 스캔하면 위 두 테스트가 자동으로 통과한다 — 그 침묵을 막는다.
    const reports = analyze();

    expect(reports.length).toBeGreaterThan(20);
    expect(reports.reduce((sum, report) => sum + report.mutationCount, 0)).toBeGreaterThan(80);
  });
});
