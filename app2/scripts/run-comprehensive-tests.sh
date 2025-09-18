#!/bin/bash

# T-HOLDEM 종합 테스트 스크립트
# 모든 테스트를 순차적으로 실행하고 결과를 리포트

set -e  # 에러 발생 시 스크립트 중단

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 함수
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 테스트 시작 시간 기록
START_TIME=$(date +%s)
TEST_RESULTS_DIR="./test-results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$TEST_RESULTS_DIR/comprehensive_test_report_$TIMESTAMP.md"

# 결과 디렉토리 생성
mkdir -p "$TEST_RESULTS_DIR"

# 테스트 결과 초기화
UNIT_TEST_STATUS=""
E2E_TEST_STATUS=""
LINT_STATUS=""
TYPE_CHECK_STATUS=""
PERFORMANCE_TEST_STATUS=""
BUILD_STATUS=""

log_info "🚀 T-HOLDEM 종합 테스트 시작"
log_info "리포트 파일: $REPORT_FILE"

# 리포트 헤더 작성
cat > "$REPORT_FILE" << EOF
# T-HOLDEM 종합 테스트 리포트

**실행 날짜**: $(date '+%Y년 %m월 %d일 %H:%M:%S')
**테스트 환경**: $(uname -s) $(uname -r)
**Node.js 버전**: $(node --version)
**npm 버전**: $(npm --version)

## 테스트 결과 요약

EOF

# 1. 환경 검사
log_info "📋 환경 검사 시작"
if ! command -v node &> /dev/null; then
    log_error "Node.js가 설치되어 있지 않습니다"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    log_error "npm이 설치되어 있지 않습니다"
    exit 1
fi

# 의존성 설치 확인
if [ ! -d "node_modules" ]; then
    log_info "의존성 설치 중..."
    npm install
fi

log_success "환경 검사 완료"

# 2. 코드 품질 검사 (Lint)
log_info "🔍 ESLint 검사 시작"
if npm run lint > "$TEST_RESULTS_DIR/lint_$TIMESTAMP.log" 2>&1; then
    LINT_STATUS="✅ 통과"
    log_success "ESLint 검사 완료"
else
    LINT_STATUS="❌ 실패"
    log_error "ESLint 검사 실패 - 자세한 내용: $TEST_RESULTS_DIR/lint_$TIMESTAMP.log"
fi

# 3. 타입 검사
log_info "📝 TypeScript 타입 검사 시작"
if npm run type-check > "$TEST_RESULTS_DIR/typecheck_$TIMESTAMP.log" 2>&1; then
    TYPE_CHECK_STATUS="✅ 통과"
    log_success "TypeScript 타입 검사 완료"
else
    TYPE_CHECK_STATUS="❌ 실패"
    log_error "TypeScript 타입 검사 실패 - 자세한 내용: $TEST_RESULTS_DIR/typecheck_$TIMESTAMP.log"
fi

# 4. 단위 테스트 및 커버리지
log_info "🧪 단위 테스트 시작"
if npm run test:coverage > "$TEST_RESULTS_DIR/unittest_$TIMESTAMP.log" 2>&1; then
    UNIT_TEST_STATUS="✅ 통과"
    log_success "단위 테스트 완료"

    # 커버리지 정보 추출
    if [ -f "coverage/lcov-report/index.html" ]; then
        log_info "커버리지 리포트 생성됨: coverage/lcov-report/index.html"
    fi
else
    UNIT_TEST_STATUS="❌ 실패"
    log_error "단위 테스트 실패 - 자세한 내용: $TEST_RESULTS_DIR/unittest_$TIMESTAMP.log"
fi

# 5. 빌드 테스트
log_info "🏗️ 프로덕션 빌드 테스트 시작"
if npm run build > "$TEST_RESULTS_DIR/build_$TIMESTAMP.log" 2>&1; then
    BUILD_STATUS="✅ 통과"
    log_success "빌드 테스트 완료"

    # 빌드 크기 분석
    if [ -d "build" ]; then
        BUILD_SIZE=$(du -sh build | cut -f1)
        log_info "빌드 크기: $BUILD_SIZE"
    fi
else
    BUILD_STATUS="❌ 실패"
    log_error "빌드 테스트 실패 - 자세한 내용: $TEST_RESULTS_DIR/build_$TIMESTAMP.log"
fi

# 6. Firebase Emulator 시작 (백그라운드)
log_info "🔥 Firebase Emulator 시작"
if command -v firebase &> /dev/null; then
    # 기존 emulator 프로세스 종료
    pkill -f "firebase.*emulators" || true

    # emulator 백그라운드 실행
    cd .. && firebase emulators:start --only auth,firestore > "../app2/$TEST_RESULTS_DIR/emulator_$TIMESTAMP.log" 2>&1 &
    EMULATOR_PID=$!
    cd app2

    # emulator 시작 대기
    log_info "Firebase Emulator 시작 대기 중..."
    sleep 10

    # emulator 상태 확인
    if curl -s http://localhost:4000 > /dev/null; then
        log_success "Firebase Emulator 시작됨"
        EMULATOR_RUNNING=true
    else
        log_warning "Firebase Emulator 시작 실패 - E2E 테스트 스킵됨"
        EMULATOR_RUNNING=false
    fi
else
    log_warning "Firebase CLI가 설치되어 있지 않습니다 - E2E 테스트 스킵됨"
    EMULATOR_RUNNING=false
fi

# 7. E2E 테스트 (Playwright)
if [ "$EMULATOR_RUNNING" = true ]; then
    log_info "🎭 E2E 테스트 시작"

    # 개발 서버 시작 (백그라운드)
    npm start > "$TEST_RESULTS_DIR/devserver_$TIMESTAMP.log" 2>&1 &
    DEV_SERVER_PID=$!

    # 서버 시작 대기
    log_info "개발 서버 시작 대기 중..."
    sleep 15

    # 서버 상태 확인
    if curl -s http://localhost:3000 > /dev/null; then
        log_success "개발 서버 시작됨"

        # 테스트 데이터 초기화
        log_info "테스트 데이터 초기화 중..."
        if node -e "
        const { setupTestData } = require('./src/test-utils/setupEmulator.ts');
        setupTestData().then(result => {
            if (result.success) {
                console.log('테스트 데이터 초기화 완료');
                process.exit(0);
            } else {
                console.error('테스트 데이터 초기화 실패');
                process.exit(1);
            }
        }).catch(error => {
            console.error('테스트 데이터 초기화 에러:', error);
            process.exit(1);
        });
        " > "$TEST_RESULTS_DIR/testdata_$TIMESTAMP.log" 2>&1; then
            log_success "테스트 데이터 초기화 완료"
        else
            log_warning "테스트 데이터 초기화 실패 - E2E 테스트 제한적 실행"
        fi

        # E2E 테스트 실행
        if npm run test:e2e > "$TEST_RESULTS_DIR/e2e_$TIMESTAMP.log" 2>&1; then
            E2E_TEST_STATUS="✅ 통과"
            log_success "E2E 테스트 완료"
        else
            E2E_TEST_STATUS="❌ 실패"
            log_error "E2E 테스트 실패 - 자세한 내용: $TEST_RESULTS_DIR/e2e_$TIMESTAMP.log"
        fi

        # 개발 서버 종료
        kill $DEV_SERVER_PID || true
    else
        E2E_TEST_STATUS="⏭️ 스킵됨 (서버 시작 실패)"
        log_warning "개발 서버 시작 실패 - E2E 테스트 스킵됨"
    fi

    # Firebase Emulator 종료
    kill $EMULATOR_PID || true
else
    E2E_TEST_STATUS="⏭️ 스킵됨 (Emulator 없음)"
fi

# 8. 성능 테스트 (빌드된 앱 대상)
if [ "$BUILD_STATUS" = "✅ 통과" ]; then
    log_info "⚡ 성능 테스트 시작"

    # 빌드된 앱을 정적 서버로 제공
    npx serve -s build -l 3001 > "$TEST_RESULTS_DIR/serve_$TIMESTAMP.log" 2>&1 &
    SERVE_PID=$!

    # 서버 시작 대기
    sleep 5

    if curl -s http://localhost:3001 > /dev/null; then
        log_success "정적 서버 시작됨 (포트 3001)"

        # Lighthouse 성능 측정 (설치된 경우)
        if command -v lighthouse &> /dev/null; then
            lighthouse http://localhost:3001 --output json --output-path "$TEST_RESULTS_DIR/lighthouse_$TIMESTAMP.json" --quiet
            PERFORMANCE_TEST_STATUS="✅ 통과 (Lighthouse 리포트 생성)"
            log_success "Lighthouse 성능 측정 완료"
        else
            # 간단한 로드 테스트
            if command -v curl &> /dev/null; then
                LOAD_START=$(date +%s%N)
                curl -s http://localhost:3001 > /dev/null
                LOAD_END=$(date +%s%N)
                LOAD_TIME=$(( (LOAD_END - LOAD_START) / 1000000 ))

                if [ $LOAD_TIME -lt 3000 ]; then
                    PERFORMANCE_TEST_STATUS="✅ 통과 (로드 시간: ${LOAD_TIME}ms)"
                    log_success "성능 테스트 완료 - 로드 시간: ${LOAD_TIME}ms"
                else
                    PERFORMANCE_TEST_STATUS="⚠️ 경고 (로드 시간: ${LOAD_TIME}ms)"
                    log_warning "성능 테스트 경고 - 로드 시간이 느림: ${LOAD_TIME}ms"
                fi
            else
                PERFORMANCE_TEST_STATUS="⏭️ 스킵됨 (도구 없음)"
                log_warning "성능 테스트 도구가 없습니다"
            fi
        fi

        # 정적 서버 종료
        kill $SERVE_PID || true
    else
        PERFORMANCE_TEST_STATUS="⏭️ 스킵됨 (서버 시작 실패)"
        log_warning "정적 서버 시작 실패 - 성능 테스트 스킵됨"
    fi
else
    PERFORMANCE_TEST_STATUS="⏭️ 스킵됨 (빌드 실패)"
    log_warning "빌드 실패로 인해 성능 테스트 스킵됨"
fi

# 전체 테스트 시간 계산
END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))
TOTAL_TIME_FORMATTED=$(printf '%02d:%02d:%02d' $((TOTAL_TIME/3600)) $((TOTAL_TIME%3600/60)) $((TOTAL_TIME%60)))

# 리포트 작성 완료
cat >> "$REPORT_FILE" << EOF
| 테스트 유형 | 결과 |
|------------|------|
| ESLint 검사 | $LINT_STATUS |
| TypeScript 타입 검사 | $TYPE_CHECK_STATUS |
| 단위 테스트 & 커버리지 | $UNIT_TEST_STATUS |
| 프로덕션 빌드 | $BUILD_STATUS |
| E2E 테스트 | $E2E_TEST_STATUS |
| 성능 테스트 | $PERFORMANCE_TEST_STATUS |

## 세부 정보

### 실행 시간
- **총 실행 시간**: $TOTAL_TIME_FORMATTED

### 빌드 정보
EOF

if [ -n "$BUILD_SIZE" ]; then
    echo "- **빌드 크기**: $BUILD_SIZE" >> "$REPORT_FILE"
fi

cat >> "$REPORT_FILE" << EOF

### 로그 파일
- ESLint: \`$TEST_RESULTS_DIR/lint_$TIMESTAMP.log\`
- TypeScript: \`$TEST_RESULTS_DIR/typecheck_$TIMESTAMP.log\`
- 단위 테스트: \`$TEST_RESULTS_DIR/unittest_$TIMESTAMP.log\`
- 빌드: \`$TEST_RESULTS_DIR/build_$TIMESTAMP.log\`
- E2E 테스트: \`$TEST_RESULTS_DIR/e2e_$TIMESTAMP.log\`
EOF

if [ -f "$TEST_RESULTS_DIR/lighthouse_$TIMESTAMP.json" ]; then
    echo "- Lighthouse 리포트: \`$TEST_RESULTS_DIR/lighthouse_$TIMESTAMP.json\`" >> "$REPORT_FILE"
fi

cat >> "$REPORT_FILE" << EOF

### 커버리지 리포트
EOF

if [ -f "coverage/lcov-report/index.html" ]; then
    echo "- 커버리지 HTML 리포트: \`coverage/lcov-report/index.html\`" >> "$REPORT_FILE"
fi

cat >> "$REPORT_FILE" << EOF

### 권장 사항

EOF

# 실패한 테스트에 대한 권장 사항 추가
if [ "$LINT_STATUS" = "❌ 실패" ]; then
    echo "- **ESLint 오류**: 코드 스타일 가이드를 준수하여 오류를 수정하세요." >> "$REPORT_FILE"
fi

if [ "$TYPE_CHECK_STATUS" = "❌ 실패" ]; then
    echo "- **타입 오류**: TypeScript 타입 정의를 확인하고 any 타입 사용을 줄이세요." >> "$REPORT_FILE"
fi

if [ "$UNIT_TEST_STATUS" = "❌ 실패" ]; then
    echo "- **단위 테스트 실패**: 실패한 테스트를 수정하고 커버리지를 80% 이상 유지하세요." >> "$REPORT_FILE"
fi

if [ "$E2E_TEST_STATUS" = "❌ 실패" ]; then
    echo "- **E2E 테스트 실패**: 사용자 워크플로우를 재검토하고 실패한 시나리오를 수정하세요." >> "$REPORT_FILE"
fi

if [[ "$PERFORMANCE_TEST_STATUS" == *"경고"* ]]; then
    echo "- **성능 개선**: 번들 크기 최적화, 이미지 압축, 코드 스플리팅을 검토하세요." >> "$REPORT_FILE"
fi

# 최종 결과 출력
echo
log_info "📊 종합 테스트 결과"
echo "=========================="
echo "ESLint 검사: $LINT_STATUS"
echo "TypeScript 타입 검사: $TYPE_CHECK_STATUS"
echo "단위 테스트: $UNIT_TEST_STATUS"
echo "빌드 테스트: $BUILD_STATUS"
echo "E2E 테스트: $E2E_TEST_STATUS"
echo "성능 테스트: $PERFORMANCE_TEST_STATUS"
echo "=========================="
echo "총 실행 시간: $TOTAL_TIME_FORMATTED"
echo "리포트 파일: $REPORT_FILE"
echo

# 전체적인 성공/실패 판단
OVERALL_SUCCESS=true

if [[ "$LINT_STATUS" == *"실패"* ]] || \
   [[ "$TYPE_CHECK_STATUS" == *"실패"* ]] || \
   [[ "$UNIT_TEST_STATUS" == *"실패"* ]] || \
   [[ "$BUILD_STATUS" == *"실패"* ]] || \
   [[ "$E2E_TEST_STATUS" == *"실패"* ]]; then
    OVERALL_SUCCESS=false
fi

if [ "$OVERALL_SUCCESS" = true ]; then
    log_success "🎉 모든 테스트가 성공적으로 완료되었습니다!"

    # 성공 시 추가 정보
    if command -v open &> /dev/null && [ -f "coverage/lcov-report/index.html" ]; then
        log_info "커버리지 리포트를 여는 중..."
        open coverage/lcov-report/index.html
    fi

    exit 0
else
    log_error "❌ 일부 테스트가 실패했습니다. 자세한 내용은 리포트를 확인하세요."
    exit 1
fi