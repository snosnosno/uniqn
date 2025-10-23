#!/usr/bin/env node

/**
 * 사용되지 않는 번역 키를 찾는 스크립트
 *
 * 사용법:
 *   node scripts/find-unused-translations.js
 *
 * 작동 방식:
 *   1. 번역 파일(ko.json)에서 모든 키 추출
 *   2. src/ 폴더에서 t('키') 패턴 검색
 *   3. 사용되지 않는 키 출력
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TRANSLATION_FILE = path.join(__dirname, '../public/locales/ko/translation.json');
const SRC_DIR = path.join(__dirname, '../src');

// 번역 파일에서 모든 키 추출
function extractAllKeys(obj, prefix = '') {
  const keys = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...extractAllKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys;
}

// 코드에서 키 사용 확인
function isKeyUsed(key) {
  try {
    // grep으로 키 사용 검색
    const result = execSync(
      `grep -r "t('${key}'" ${SRC_DIR} --include="*.ts" --include="*.tsx" 2>/dev/null || grep -r 't("${key}"' ${SRC_DIR} --include="*.ts" --include="*.tsx" 2>/dev/null || echo ""`,
      { encoding: 'utf-8' }
    );
    return result.trim().length > 0;
  } catch (error) {
    return false;
  }
}

// 메인 실행
function main() {
  console.log('📝 번역 키 사용 현황 분석 중...\n');

  // 번역 파일 로드
  const translations = JSON.parse(fs.readFileSync(TRANSLATION_FILE, 'utf-8'));
  const allKeys = extractAllKeys(translations);

  console.log(`총 번역 키 개수: ${allKeys.length}개\n`);

  // 사용되지 않는 키 찾기
  const unusedKeys = [];
  const usedKeys = [];

  let processed = 0;
  for (const key of allKeys) {
    processed++;
    if (processed % 50 === 0) {
      process.stdout.write(`\r진행률: ${processed}/${allKeys.length} (${Math.round(processed/allKeys.length*100)}%)`);
    }

    if (isKeyUsed(key)) {
      usedKeys.push(key);
    } else {
      unusedKeys.push(key);
    }
  }

  console.log('\n\n✅ 분석 완료!\n');

  // 결과 출력
  console.log(`사용 중인 키: ${usedKeys.length}개`);
  console.log(`사용되지 않는 키: ${unusedKeys.length}개\n`);

  if (unusedKeys.length > 0) {
    console.log('🗑️  사용되지 않는 키 목록:\n');
    unusedKeys.forEach(key => console.log(`  - ${key}`));

    console.log(`\n💡 ${unusedKeys.length}개의 키를 제거하면 약 ${Math.round(unusedKeys.length / allKeys.length * 100)}% 최적화 가능`);
  } else {
    console.log('✨ 모든 번역 키가 사용되고 있습니다!');
  }

  // 결과를 JSON 파일로 저장
  const reportPath = path.join(__dirname, '../translation-analysis.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    totalKeys: allKeys.length,
    usedKeys: usedKeys.length,
    unusedKeys: unusedKeys.length,
    unusedKeyList: unusedKeys,
    analyzedAt: new Date().toISOString()
  }, null, 2));

  console.log(`\n📄 상세 리포트: ${reportPath}`);
}

main();
