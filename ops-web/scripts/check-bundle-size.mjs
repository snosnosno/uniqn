#!/usr/bin/env node
/**
 * 번들 크기 예산 — 공개뷰(TV 전광판·플레이어 폰)가 첫 화면까지 내려받는 JS 를 gzip 기준으로 잰다(설계 §11 리스크).
 * 진입 스크립트 + modulepreload + 라우트 청크와 그 정적 import 폐포를 따라가 합산한다(동적 import 는 제외).
 *
 * 사용법: node scripts/check-bundle-size.mjs [dist]   (먼저 npm run build)
 * 종료코드: 0=예산 안, 1=초과 또는 산출물 없음
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

/**
 * 라우트별 gzip 예산(KB). 2026-10-01 실측(전광판·플레이어뷰 246.5 · 콘솔 317.0) + 약 12% 여유.
 * 올릴 때는 이유를 커밋에 적는다 — 공개뷰는 TV·선수 폰이 매장 와이파이로 처음 여는 화면이다.
 */
export const BUDGETS_KB = {
  MonitorPage: 280,
  PlayerViewPage: 280,
  ConsolePage: 360,
};

const STATIC_IMPORT =
  /(?:^|[;}\s])(?:import|export)\s*(?:[\w*{}\s,$]+from\s*)?["']\.\/([\w.-]+\.js)["']/g;

export function staticImports(code) {
  return [...code.matchAll(STATIC_IMPORT)].map((m) => m[1]);
}

/** 진입 파일들에서 시작해 정적 import 를 따라간 파일 집합. */
export function closure(entries, read) {
  const seen = new Set();
  const stack = [...entries];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const dep of staticImports(read(file))) stack.push(dep);
  }
  return seen;
}

function main() {
  const dist = path.resolve(process.argv[2] ?? 'dist');
  const assets = path.join(dist, 'assets');
  if (!existsSync(path.join(dist, 'index.html'))) {
    console.error(`❌ ${dist}/index.html 없음 — 먼저 빌드하세요`);
    return 1;
  }
  const html = readFileSync(path.join(dist, 'index.html'), 'utf-8');
  const initial = [...html.matchAll(/\/assets\/([\w.-]+\.js)/g)].map((m) => m[1]);
  const files = readdirSync(assets);
  const cache = new Map();
  const read = (f) => {
    if (!cache.has(f)) cache.set(f, readFileSync(path.join(assets, f), 'utf-8'));
    return cache.get(f);
  };
  const gz = (f) => gzipSync(read(f)).length;

  let failed = false;
  for (const [route, budgetKb] of Object.entries(BUDGETS_KB)) {
    const chunk = files.find((f) => f.startsWith(`${route}-`) && f.endsWith('.js'));
    if (!chunk) {
      console.error(`❌ ${route} 청크를 찾지 못했어요(라우트 분할이 깨졌거나 이름이 바뀌었다)`);
      failed = true;
      continue;
    }
    const set = closure([...initial, chunk], read);
    const kb = [...set].reduce((n, f) => n + gz(f), 0) / 1024;
    const ok = kb <= budgetKb;
    console.log(
      `${ok ? '✅' : '❌'} ${route}: ${kb.toFixed(1)}KB gzip / 예산 ${budgetKb}KB (${set.size}개 파일)`
    );
    if (!ok) failed = true;
  }
  return failed ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main());
