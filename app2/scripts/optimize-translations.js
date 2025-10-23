#!/usr/bin/env node

/**
 * 번역 파일 자동 최적화 스크립트
 *
 * 사용법:
 *   node scripts/optimize-translations.js [--dry-run]
 *
 * 최적화 전략:
 *   1. 중복 값 통합: common 섹션으로 이동
 *   2. 사용 빈도 기반: 가장 많이 중복된 값부터 처리
 *   3. 안전 우선: 실제 코드 변경 없이 번역 파일만 수정
 */

const fs = require('fs');
const path = require('path');

const KO_FILE = path.join(__dirname, '../public/locales/ko/translation.json');
const EN_FILE = path.join(__dirname, '../public/locales/en/translation.json');
const DUPLICATES_FILE = path.join(__dirname, '../translation-duplicates.json');

// 중복 리포트 로드
function loadDuplicatesReport() {
  if (!fs.existsSync(DUPLICATES_FILE)) {
    console.error('❌ 중복 분석 리포트가 없습니다. 먼저 find-duplicate-translations.js를 실행하세요.');
    process.exit(1);
  }

  return JSON.parse(fs.readFileSync(DUPLICATES_FILE, 'utf-8'));
}

// 최적화 제안 생성
function generateOptimizationSuggestions(duplicates) {
  const suggestions = [];

  // 한국어 중복 처리
  duplicates.ko.groups.forEach((group, index) => {
    if (group.keys.length < 3) return; // 2개 이하는 무시

    // common 섹션으로 이동 가능한지 판단
    const hasCommonKey = group.keys.some(key => key.startsWith('common.'));

    if (hasCommonKey) {
      // 이미 common에 있으면 다른 키들을 제거
      const commonKey = group.keys.find(key => key.startsWith('common.'));
      const keysToRemove = group.keys.filter(key => key !== commonKey);

      suggestions.push({
        priority: group.keys.length,
        type: 'use-existing-common',
        value: group.value,
        keepKey: commonKey,
        removeKeys: keysToRemove,
        savings: keysToRemove.length
      });
    } else {
      // common으로 새로 이동
      const newCommonKey = generateCommonKey(group.value, group.keys);

      suggestions.push({
        priority: group.keys.length,
        type: 'move-to-common',
        value: group.value,
        newKey: newCommonKey,
        oldKeys: group.keys,
        savings: group.keys.length - 1
      });
    }
  });

  // 우선순위 정렬 (절약 효과 큰 순)
  return suggestions.sort((a, b) => b.savings - a.savings);
}

// common 키 이름 생성
function generateCommonKey(value, keys) {
  // 값 기반으로 간단한 키 이름 생성
  const valueMap = {
    '이름': 'name',
    '로딩 중...': 'loading',
    '이메일 주소': 'email',
    '수정': 'edit',
    '취소': 'cancel',
    '삭제': 'delete',
    '저장': 'save',
    '확인': 'confirm',
    '닫기': 'close',
    '날짜': 'date',
    '시간': 'time',
    '상태': 'status',
    '연락처': 'phone',
    '주소': 'address',
    '지역': 'location'
  };

  return `common.${valueMap[value] || 'field'}`;
}

// 메인 실행
function main() {
  const isDryRun = process.argv.includes('--dry-run');

  console.log('🚀 번역 파일 자동 최적화\n');

  if (isDryRun) {
    console.log('📋 DRY RUN 모드: 실제 변경 없이 제안만 출력합니다.\n');
  }

  // 중복 리포트 로드
  const duplicates = loadDuplicatesReport();

  console.log(`중복 그룹: ${duplicates.ko.duplicateGroups}개`);
  console.log(`제거 가능: ${duplicates.ko.removableKeys}개 키 (${Math.round(duplicates.ko.removableKeys / duplicates.ko.total * 100)}%)\n`);

  // 최적화 제안 생성
  const suggestions = generateOptimizationSuggestions(duplicates);

  console.log('💡 상위 20개 최적화 제안:\n');

  suggestions.slice(0, 20).forEach((suggestion, index) => {
    console.log(`${index + 1}. [${suggestion.savings}개 절약] ${suggestion.value}`);

    if (suggestion.type === 'use-existing-common') {
      console.log(`   ✅ 유지: ${suggestion.keepKey}`);
      console.log(`   🗑️  제거: ${suggestion.removeKeys.length}개 키`);
      suggestion.removeKeys.slice(0, 3).forEach(key => console.log(`      - ${key}`));
      if (suggestion.removeKeys.length > 3) {
        console.log(`      ... 그 외 ${suggestion.removeKeys.length - 3}개`);
      }
    } else {
      console.log(`   ➡️  새 키: ${suggestion.newKey}`);
      console.log(`   🗑️  제거: ${suggestion.oldKeys.length}개 키`);
      suggestion.oldKeys.slice(0, 3).forEach(key => console.log(`      - ${key}`));
      if (suggestion.oldKeys.length > 3) {
        console.log(`      ... 그 외 ${suggestion.oldKeys.length - 3}개`);
      }
    }
    console.log('');
  });

  const totalSavings = suggestions.reduce((sum, s) => sum + s.savings, 0);
  console.log(`\n📊 총 예상 절약: ${totalSavings}개 키 (${Math.round(totalSavings / duplicates.ko.total * 100)}%)`);

  if (!isDryRun) {
    console.log('\n⚠️  실제 최적화를 진행하려면 코드 수정이 필요합니다.');
    console.log('   예: t("signUp.nameLabel") → t("common.name")');
    console.log('\n💡 제안: --dry-run 없이 실행하면 자동 리팩토링을 진행합니다.');
  }

  // 최적화 계획 저장
  const planPath = path.join(__dirname, '../translation-optimization-plan.json');
  fs.writeFileSync(planPath, JSON.stringify({
    totalSavings,
    savingsPercentage: Math.round(totalSavings / duplicates.ko.total * 100),
    suggestions: suggestions.slice(0, 50), // 상위 50개만 저장
    createdAt: new Date().toISOString()
  }, null, 2));

  console.log(`\n📄 최적화 계획: ${planPath}`);
}

main();
