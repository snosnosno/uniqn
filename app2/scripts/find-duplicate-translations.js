#!/usr/bin/env node

/**
 * 중복된 번역 값을 찾는 스크립트
 *
 * 사용법:
 *   node scripts/find-duplicate-translations.js
 *
 * 작동 방식:
 *   1. 번역 파일에서 모든 키-값 쌍 추출
 *   2. 같은 값을 가진 키들을 그룹화
 *   3. 중복 그룹 출력
 */

const fs = require('fs');
const path = require('path');

const KO_FILE = path.join(__dirname, '../public/locales/ko/translation.json');
const EN_FILE = path.join(__dirname, '../public/locales/en/translation.json');

// 모든 키-값 쌍 추출
function extractKeyValuePairs(obj, prefix = '') {
  const pairs = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      pairs.push(...extractKeyValuePairs(value, fullKey));
    } else {
      pairs.push({ key: fullKey, value: String(value) });
    }
  }

  return pairs;
}

// 값으로 그룹화
function groupByValue(pairs) {
  const groups = new Map();

  for (const { key, value } of pairs) {
    if (!groups.has(value)) {
      groups.set(value, []);
    }
    groups.get(value).push(key);
  }

  return groups;
}

// 메인 실행
function main() {
  console.log('🔍 중복 번역 값 분석 중...\n');

  // 한국어 파일 분석
  const koTranslations = JSON.parse(fs.readFileSync(KO_FILE, 'utf-8'));
  const koPairs = extractKeyValuePairs(koTranslations);
  const koGroups = groupByValue(koPairs);

  console.log('=== 한국어 (ko.json) ===\n');

  // 2개 이상의 키가 같은 값을 가진 경우만 출력
  const koDuplicates = Array.from(koGroups.entries())
    .filter(([value, keys]) => keys.length > 1)
    .sort((a, b) => b[1].length - a[1].length); // 중복 개수 많은 순

  console.log(`총 ${koDuplicates.length}개의 중복 그룹 발견\n`);

  koDuplicates.slice(0, 20).forEach(([value, keys], index) => {
    console.log(`${index + 1}. 값: "${value}"`);
    console.log(`   키 개수: ${keys.length}개`);
    console.log(`   키 목록:`);
    keys.forEach(key => console.log(`     - ${key}`));
    console.log('');
  });

  if (koDuplicates.length > 20) {
    console.log(`... 그 외 ${koDuplicates.length - 20}개 그룹\n`);
  }

  // 영어 파일 분석
  const enTranslations = JSON.parse(fs.readFileSync(EN_FILE, 'utf-8'));
  const enPairs = extractKeyValuePairs(enTranslations);
  const enGroups = groupByValue(enPairs);

  console.log('\n=== 영어 (en.json) ===\n');

  const enDuplicates = Array.from(enGroups.entries())
    .filter(([value, keys]) => keys.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  console.log(`총 ${enDuplicates.length}개의 중복 그룹 발견\n`);

  enDuplicates.slice(0, 20).forEach(([value, keys], index) => {
    console.log(`${index + 1}. 값: "${value}"`);
    console.log(`   키 개수: ${keys.length}개`);
    console.log(`   키 목록:`);
    keys.forEach(key => console.log(`     - ${key}`));
    console.log('');
  });

  if (enDuplicates.length > 20) {
    console.log(`... 그 외 ${enDuplicates.length - 20}개 그룹\n`);
  }

  // 통계 출력
  const koDuplicateCount = koDuplicates.reduce((sum, [, keys]) => sum + keys.length - 1, 0);
  const enDuplicateCount = enDuplicates.reduce((sum, [, keys]) => sum + keys.length - 1, 0);

  console.log('\n📊 최적화 가능성:\n');
  console.log(`한국어: ${koDuplicateCount}개 키를 제거 가능 (${Math.round(koDuplicateCount / koPairs.length * 100)}%)`);
  console.log(`영어: ${enDuplicateCount}개 키를 제거 가능 (${Math.round(enDuplicateCount / enPairs.length * 100)}%)`);

  // 결과 저장
  const reportPath = path.join(__dirname, '../translation-duplicates.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    ko: {
      total: koPairs.length,
      duplicateGroups: koDuplicates.length,
      removableKeys: koDuplicateCount,
      groups: koDuplicates.map(([value, keys]) => ({ value, keys }))
    },
    en: {
      total: enPairs.length,
      duplicateGroups: enDuplicates.length,
      removableKeys: enDuplicateCount,
      groups: enDuplicates.map(([value, keys]) => ({ value, keys }))
    },
    analyzedAt: new Date().toISOString()
  }, null, 2));

  console.log(`\n📄 상세 리포트: ${reportPath}`);
}

main();
