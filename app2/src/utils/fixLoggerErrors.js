const fs = require('fs');
const path = require('path');

// 잘못된 logger 패턴을 수정하는 함수
function fixLoggerErrors(content, filePath) {
  let fixed = content;
  
  // 변수가 Error 인스턴스인지 체크하는 잘못된 패턴
  // 예: timeString instanceof Error ? timeString : new Error(String(timeString))
  const wrongPattern1 = /(\w+) instanceof Error \? \1 : new Error\(String\(\1\)\)/g;
  fixed = fixed.replace(wrongPattern1, 'error instanceof Error ? error : new Error(String(error))');
  
  // 더 복잡한 패턴들
  // 예: error, someVar instanceof Error ? error, someVar : new Error(String(error, someVar))
  const wrongPattern2 = /error, (\w+) instanceof Error \? error, \1 : new Error\(String\(error, \1\)\)/g;
  fixed = fixed.replace(wrongPattern2, 'error instanceof Error ? error : new Error(String(error))');
  
  // 예: someVar instanceof Error ? someVar : new Error(String(someVar))
  const wrongPattern3 = /(\w+(?:\.\w+)*) instanceof Error \? \1 : new Error\(String\(\1\)\)/g;
  fixed = fixed.replace(wrongPattern3, (match, varName) => {
    // error라는 변수가 아닌 경우
    if (varName !== 'error' && !varName.includes('error')) {
      return 'error instanceof Error ? error : new Error(String(error))';
    }
    return match;
  });
  
  return fixed;
}

// 디렉토리 순회 함수
function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // node_modules, build 등 제외
      if (!['node_modules', 'build', 'dist', '.git'].includes(file)) {
        processDirectory(filePath);
      }
    } else if ((file.endsWith('.ts') || file.endsWith('.tsx')) && !file.includes('fixLoggerErrors')) {
      processFile(filePath);
    }
  });
}

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fixed = fixLoggerErrors(content, filePath);
    
    if (content !== fixed) {
      fs.writeFileSync(filePath, fixed, 'utf8');
      console.log(`✅ Fixed logger errors in: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
}

// 실행
const srcPath = path.join(__dirname, '..');
console.log('🔄 Fixing logger errors...');
console.log(`📁 Processing directory: ${srcPath}`);
processDirectory(srcPath);
console.log('✨ Logger error fix complete!');