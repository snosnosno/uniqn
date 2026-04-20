#!/usr/bin/env node
/**
 * CSS 변수 동기화 검증 스크립트
 *
 * global.css의 :root / .dark 블록에 정의된 CSS 변수 키와
 * colors.ts의 CSS_VAR_LIGHT / CSS_VAR_DARK 객체의 키가 일치하는지 검증한다.
 *
 * NativeWind Metro 컴파일러가 global.css의 .dark {} CSS 변수를
 * 네이티브(iOS/Android)에 전파하지 못하므로, colors.ts에서 vars() API로
 * 수동 주입한다. 두 파일이 동기화되지 않으면 네이티브 다크모드가 깨진다.
 *
 * Usage: node scripts/check-css-vars-sync.js
 * npm run quality에 통합: package.json의 quality 스크립트에 추가
 */

const fs = require('fs');
const path = require('path');

const GLOBAL_CSS_PATH = path.resolve(__dirname, '../global.css');
const COLORS_TS_PATH = path.resolve(__dirname, '../src/constants/colors.ts');

function extractCssVarKeys(cssContent) {
  // :root { ... } 블록에서 --color-* 변수명 추출
  const rootMatch = cssContent.match(/:root\s*\{([^}]+)\}/);
  const darkMatch = cssContent.match(/\.dark\s*\{([^}]+)\}/);

  const extractKeys = (block) => {
    if (!block) return [];
    const matches = block.matchAll(/(--color-[\w-]+)\s*:/g);
    return [...matches].map((m) => m[1]);
  };

  return {
    light: extractKeys(rootMatch?.[1]),
    dark: extractKeys(darkMatch?.[1]),
  };
}

function extractTsVarKeys(tsContent) {
  // CSS_VAR_LIGHT = { '--color-*': ... } 에서 키 추출
  const lightMatch = tsContent.match(/CSS_VAR_LIGHT\s*=\s*\{([^}]+)\}/);
  const darkMatch = tsContent.match(/CSS_VAR_DARK\s*=\s*\{([^}]+)\}/);

  const extractKeys = (block) => {
    if (!block) return [];
    const matches = block.matchAll(/'(--color-[\w-]+)'/g);
    return [...matches].map((m) => m[1]);
  };

  return {
    light: extractKeys(lightMatch?.[1]),
    dark: extractKeys(darkMatch?.[1]),
  };
}

function main() {
  const cssContent = fs.readFileSync(GLOBAL_CSS_PATH, 'utf-8');
  const tsContent = fs.readFileSync(COLORS_TS_PATH, 'utf-8');

  const cssKeys = extractCssVarKeys(cssContent);
  const tsKeys = extractTsVarKeys(tsContent);

  let hasError = false;

  // Light 비교
  const cssLightSet = new Set(cssKeys.light);
  const tsLightSet = new Set(tsKeys.light);

  for (const key of cssLightSet) {
    if (!tsLightSet.has(key)) {
      console.error(`❌ global.css :root has "${key}" but colors.ts CSS_VAR_LIGHT is missing it`);
      hasError = true;
    }
  }
  for (const key of tsLightSet) {
    if (!cssLightSet.has(key)) {
      console.error(`❌ colors.ts CSS_VAR_LIGHT has "${key}" but global.css :root is missing it`);
      hasError = true;
    }
  }

  // Dark 비교
  const cssDarkSet = new Set(cssKeys.dark);
  const tsDarkSet = new Set(tsKeys.dark);

  for (const key of cssDarkSet) {
    if (!tsDarkSet.has(key)) {
      console.error(`❌ global.css .dark has "${key}" but colors.ts CSS_VAR_DARK is missing it`);
      hasError = true;
    }
  }
  for (const key of tsDarkSet) {
    if (!cssDarkSet.has(key)) {
      console.error(`❌ colors.ts CSS_VAR_DARK has "${key}" but global.css .dark is missing it`);
      hasError = true;
    }
  }

  // Light/Dark 키 일치 확인
  for (const key of cssLightSet) {
    if (!cssDarkSet.has(key)) {
      console.warn(`⚠️  global.css :root has "${key}" but .dark block is missing it`);
    }
  }

  if (hasError) {
    console.error('\n💡 Fix: global.css와 colors.ts의 CSS 변수를 동기화하세요.');
    console.error('   global.css :root/.dark ↔ colors.ts CSS_VAR_LIGHT/CSS_VAR_DARK\n');
    process.exit(1);
  }

  console.log(`✅ CSS 변수 동기화 OK (${cssLightSet.size} light, ${cssDarkSet.size} dark)`);
}

main();
