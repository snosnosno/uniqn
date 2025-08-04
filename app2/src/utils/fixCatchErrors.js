import { logger } from '../utils/logger';

const fs = require('fs');
const path = require('path');

// catch 블록에서 변수명과 error 사용이 일치하지 않는 패턴을 수정
function fixCatchErrors(content, filePath) {
  let fixed = content;
  
  // catch 블록을 찾고 그 안의 error 사용을 수정
  const catchPattern = /} catch \((\w+)(?::\s*any)?\) {[^}]*error instanceof Error/g;
  
  let match;
  while ((match = catchPattern.exec(content)) !== null) {
    const catchVar = match[1];
    if (catchVar !== 'error') {
      // catch 블록 전체를 찾아서 수정
      const startIndex = match.index;
      let braceCount = 0;
      let inCatch = false;
      let endIndex = startIndex;
      
      for (let i = startIndex; i < content.length; i++) {
        if (content[i] === '{') {
          if (!inCatch && content.substring(i - 6, i).includes('catch')) {
            inCatch = true;
          }
          if (inCatch) braceCount++;
        } else if (content[i] === '}' && inCatch) {
          braceCount--;
          if (braceCount === 0) {
            endIndex = i + 1;
            break;
          }
        }
      }
      
      // catch 블록 내용 추출
      const catchBlock = content.substring(startIndex, endIndex);
      // error를 실제 catch 변수명으로 변경
      const fixedBlock = catchBlock.replace(/\berror\s+instanceof\s+Error\s*\?\s*error\s*:\s*new\s+Error\s*\(\s*String\s*\(\s*error\s*\)\s*\)/g, 
        `${catchVar} instanceof Error ? ${catchVar} : new Error(String(${catchVar}))`);
      
      fixed = fixed.substring(0, startIndex) + fixedBlock + fixed.substring(endIndex);
    }
  }
  
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
    } else if ((file.endsWith('.ts') || file.endsWith('.tsx')) && !file.includes('fixCatchErrors')) {
      processFile(filePath);
    }
  });
}

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const fixed = fixCatchErrors(content, filePath);
    
    if (content !== fixed) {
      fs.writeFileSync(filePath, fixed, 'utf8');
      logger.info(`✅ Fixed catch errors in: ${filePath}`, { component: 'fixCatchErrors' });
    }
  } catch (error) {
    logger.error('❌ Error processing ${filePath}:', error.message instanceof Error ? error.message : new Error(String(error.message)), { component: 'fixCatchErrors' });
  }
}

// 실행
const srcPath = path.join(__dirname, '..');
logger.info('🔄 Fixing catch errors...', { component: 'fixCatchErrors' });
logger.info(`📁 Processing directory: ${srcPath}`, { component: 'fixCatchErrors' });
processDirectory(srcPath);
logger.info('✨ Catch error fix complete!', { component: 'fixCatchErrors' });