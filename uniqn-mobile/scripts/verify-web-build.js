#!/usr/bin/env node
/**
 * 웹 빌드 산출물 검증 게이트
 *
 * 배경(2026-07-21 사고): `expo export -p web`이 라우트 0개짜리 번들을 exit 0으로 산출했고,
 * 검증 없이 그대로 Cloudflare Pages에 배포돼 프로덕션 전체가 "No routes found"로 21시간 다운됐다.
 * 실측 대조 — 정상: 9.0MB / '(app)' 255회 / CSS 55KB, 깨진 것: 1.07MB / 0회 / CSS 링크 없음.
 *
 * 사용법: node scripts/verify-web-build.js [dist-dir]
 * 종료코드: 0=정상, 1=깨진 산출물(배포 금지)
 */

const fs = require('fs');
const path = require('path');

const MIN_BUNDLE_BYTES = 5 * 1024 * 1024; // 정상 ~9MB, 깨진 빈 번들 ~1MB
const ROUTE_MARKERS = ['(app)', '(auth)']; // expo-router require.context가 수집한 라우트 그룹

const distDir = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist'));

function fail(message) {
  console.error(`   ❌ ${message}`);
  console.error('\n❌ 검증 실패 — 깨진 산출물입니다. 캐시를 비우고 다시 빌드하세요:');
  console.error('   npx expo export -p web --clear');
  process.exit(1);
}

const indexHtmlPath = path.join(distDir, 'index.html');
if (!fs.existsSync(indexHtmlPath)) {
  fail(`${path.relative(process.cwd(), indexHtmlPath)} 없음 (웹 export 산출물이 아님)`);
}
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');

const bundleRef = indexHtml.match(/\/_expo\/static\/js\/web\/(index-[^"']+\.js)/);
if (!bundleRef) {
  fail('index.html에 메인 JS 번들 참조 없음');
}

const bundlePath = path.join(distDir, '_expo', 'static', 'js', 'web', bundleRef[1]);
if (!fs.existsSync(bundlePath)) {
  fail(`참조된 번들 파일 없음: ${bundleRef[1]}`);
}

const bundleSize = fs.statSync(bundlePath).size;
if (bundleSize < MIN_BUNDLE_BYTES) {
  fail(
    `메인 번들이 비정상적으로 작음: ${(bundleSize / 1024 / 1024).toFixed(2)}MB ` +
      `(최소 ${MIN_BUNDLE_BYTES / 1024 / 1024}MB) — 앱 코드가 번들되지 않았을 가능성`
  );
}

const bundleContent = fs.readFileSync(bundlePath, 'utf-8');
const missingRoutes = ROUTE_MARKERS.filter((marker) => !bundleContent.includes(marker));
if (missingRoutes.length > 0) {
  fail(
    `번들에 라우트가 없음 (누락 마커: ${missingRoutes.join(', ')}) — ` +
      '런타임에 "No routes found"로 사이트 전체가 죽습니다'
  );
}

if (!/<link[^>]+rel="stylesheet"[^>]+\/_expo\/static\/css\//.test(indexHtml)) {
  fail('index.html에 NativeWind CSS 링크 없음 — 스타일이 통째로 빠진 빌드');
}

console.log(
  `   ✅ 번들 ${(bundleSize / 1024 / 1024).toFixed(2)}MB · 라우트 마커 확인 · CSS 링크 확인`
);
