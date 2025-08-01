const fs = require('fs');
const path = require('path');

// catch 블록에서 변수명이 잘못 사용된 패턴을 수정
function fixRemainingErrors(content, filePath) {
  let fixed = content;
  let changesMade = false;
  
  // catch 변수 instanceof Error ? error : 패턴 찾기 (error가 잘못 사용된 경우)
  const regex = /catch\s*\((\w+)(?::\s*any)?\)\s*{[^}]*\1\s+instanceof\s+Error\s*\?\s*error\s*:/g;
  
  let match;
  while ((match = regex.exec(content)) !== null) {
    const catchVar = match[1];
    if (catchVar !== 'error') {
      // 해당 부분을 찾아서 수정
      const wrongPattern = new RegExp(`(${catchVar}\\s+instanceof\\s+Error\\s*\\?\\s*)error(\\s*:)`, 'g');
      fixed = fixed.replace(wrongPattern, `$1${catchVar}$2`);
      changesMade = true;
    }
  }
  
  return { fixed, changesMade };
}

// 디렉토리 순회 함수
function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  let totalFixed = 0;
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // node_modules, build 등 제외
      if (!['node_modules', 'build', 'dist', '.git'].includes(file)) {
        totalFixed += processDirectory(filePath);
      }
    } else if ((file.endsWith('.ts') || file.endsWith('.tsx')) && !file.includes('fix')) {
      if (processFile(filePath)) {
        totalFixed++;
      }
    }
  });
  
  return totalFixed;
}

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const { fixed, changesMade } = fixRemainingErrors(content, filePath);
    
    if (changesMade) {
      fs.writeFileSync(filePath, fixed, 'utf8');
      console.log(`✅ Fixed remaining errors in: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    return false;
  }
}

// 실행
const srcPath = path.join(__dirname, '..');
console.log('🔄 Fixing remaining catch errors...');
console.log(`📁 Processing directory: ${srcPath}`);
const totalFixed = processDirectory(srcPath);
console.log(`✨ Fix complete! Fixed ${totalFixed} files.`);