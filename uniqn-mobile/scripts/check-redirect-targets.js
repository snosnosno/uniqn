#!/usr/bin/env node
/**
 * `_redirects` 외부 대상 실측 게이트
 *
 * 배경: uniqn.app 의 `/monitor/*`·`/live/*` 는 302 로 `ops.uniqn.app` 에 넘긴다(ops 웹 W8).
 * 대상 도메인이 아직 안 열렸는데(2026-08-07 실측: DNS 미해석 전례) 이 규칙이 배포되면
 * 이미 나간 전광판·플레이어 QR 링크가 **전부** 죽는다. 그래서 배포 직전에 외부 대상의
 * origin 마다 실제 요청을 보내 2xx 가 아니면 배포를 막는다.
 *
 * 사용법: node scripts/check-redirect-targets.js [_redirects 경로]
 * 종료코드: 0=외부 대상 없음 또는 전부 응답, 1=응답 없는 대상 있음(배포 금지)
 */

const fs = require('fs');
const path = require('path');

const TIMEOUT_MS = 10_000;

/**
 * `_redirects` 본문에서 외부(절대 URL) 대상의 origin 목록을 뽑는다(중복 제거, 등장 순).
 * 형식: `<from> <to> [status]` — `#` 주석·빈 줄 무시. 내부 경로(`/...`) 대상은 제외.
 */
function extractExternalOrigins(text) {
  const origins = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [, to] = line.split(/\s+/);
    if (!to || !/^https?:\/\//i.test(to)) continue;
    let origin;
    try {
      origin = new URL(to.replace(/:splat|:[a-z_]+/gi, 'x')).origin;
    } catch {
      continue;
    }
    if (!origins.includes(origin)) origins.push(origin);
  }
  return origins;
}

/**
 * origin 의 루트가 2xx 로 응답하는지. 리다이렉트는 따라가되 **최종 호스트가 같아야** 통과 —
 * Cloudflare Access 같은 접근 제한이 걸려 있으면 로그인 페이지(다른 호스트)로 넘어가
 * 2xx 가 나오는데, 이건 일반 사용자에게 열린 게 아니므로 실패로 본다.
 * 네트워크 오류·시간 초과도 실패.
 */
async function probeOrigin(origin, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(`${origin}/`, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const finalHost = res.url ? new URL(res.url).host : new URL(origin).host;
    if (finalHost !== new URL(origin).host) {
      return {
        origin,
        ok: false,
        detail: `HTTP ${res.status} — ${finalHost} 로 넘어감(접근 제한?)`,
      };
    }
    return { origin, ok: res.ok, detail: `HTTP ${res.status}` };
  } catch (error) {
    return { origin, ok: false, detail: error?.cause?.code ?? error?.name ?? String(error) };
  }
}

async function main() {
  const file = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist', '_redirects'));
  if (!fs.existsSync(file)) {
    console.log(`   ⏭  ${path.relative(process.cwd(), file)} 없음 — 검사할 외부 대상 없음`);
    return 0;
  }
  const origins = extractExternalOrigins(fs.readFileSync(file, 'utf-8'));
  if (origins.length === 0) {
    console.log('   ✅ 외부 리다이렉트 대상 없음');
    return 0;
  }
  const results = await Promise.all(origins.map((o) => probeOrigin(o)));
  for (const r of results) {
    console.log(`   ${r.ok ? '✅' : '❌'} ${r.origin} — ${r.detail}`);
  }
  if (results.some((r) => !r.ok)) {
    console.error('\n❌ 응답하지 않는 리다이렉트 대상이 있습니다 — 배포하면 옛 링크가 죽습니다.');
    console.error('   대상 도메인을 먼저 개통하세요(ops-web/README.md "개통 런북").');
    return 1;
  }
  return 0;
}

if (require.main === module) {
  main().then((code) => process.exit(code));
}

module.exports = { extractExternalOrigins, probeOrigin };
