#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const koPath = path.join(ROOT, 'public/locales/ko/translation.json');
const enPath = path.join(ROOT, 'public/locales/en/translation.json');

const ko = JSON.parse(fs.readFileSync(koPath, 'utf-8'));
const en = JSON.parse(fs.readFileSync(enPath, 'utf-8'));

function flattenKeys(obj, prefix = '') {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, flattenKeys(value, newKey));
    } else {
      result[newKey] = value;
    }
  }
  return result;
}

const koFlat = flattenKeys(ko);
const enFlat = flattenKeys(en);

const koDups = {};
const enDups = {};

Object.entries(koFlat).forEach(([key, val]) => {
  if (!koDups[val]) koDups[val] = [];
  koDups[val].push(key);
});

Object.entries(enFlat).forEach(([key, val]) => {
  if (!enDups[val]) enDups[val] = [];
  enDups[val].push(key);
});

const koTargets = Object.entries(koDups)
  .filter(([_, keys]) => keys.length >= 2)
  .sort((a, b) => b[1].length - a[1].length)
  .slice(0, 30);

const enTargets = Object.entries(enDups)
  .filter(([_, keys]) => keys.length >= 2)
  .sort((a, b) => b[1].length - a[1].length)
  .slice(0, 30);

console.log('\n📊 Phase 3 이후 남은 중복 분석\n');
console.log('=== 한국어 중복 TOP 30 ===\n');
koTargets.forEach(([val, keys], i) => {
  console.log(`${i+1}. "${val}" - ${keys.length}개`);
  console.log(`   ${keys.join('\n   ')}\n`);
});

console.log('\n=== 영어 중복 TOP 30 ===\n');
enTargets.forEach(([val, keys], i) => {
  console.log(`${i+1}. "${val}" - ${keys.length}개`);
  console.log(`   ${keys.join('\n   ')}\n`);
});

console.log(`\n📈 추가 최적화 가능성:`);
console.log(`   한국어: ${koTargets.reduce((sum, [_, keys]) => sum + keys.length, 0)}개 키 (2개 이상 중복)`);
console.log(`   영어: ${enTargets.reduce((sum, [_, keys]) => sum + keys.length, 0)}개 키 (2개 이상 중복)`);
