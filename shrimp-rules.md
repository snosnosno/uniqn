# T-HOLDEM 프로젝트 개발 가이드라인

> AI 에이전트 전용 개발 규칙 - 홀덤 토너먼트 운영 플랫폼

## 프로젝트 개요

### 기술 스택
- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Firebase (Firestore, Authentication, Cloud Functions)
- **다국어**: i18next (한국어 기본, 영어 보조)
- **라우팅**: React Router v6
- **상태관리**: React Context API

### 핵심 모듈
- 인증 시스템 (스태프/매니저/관리자 권한)
- 구인구직 관리
- 스태프 관리 및 출석 체크
- 토너먼트 운영
- 급여 처리 시스템

## 프로젝트 아키텍처

### 디렉토리 구조
```
T-HOLDEM/
├── app2/src/                    # React 애플리케이션
│   ├── pages/                   # 페이지 컴포넌트
│   │   ├── admin/              # 관리자 전용 페이지
│   │   └── dealer/             # 딜러 전용 페이지
│   ├── components/             # 재사용 컴포넌트
│   ├── hooks/                  # 커스텀 훅
│   ├── contexts/               # React Context
│   ├── utils/                  # 유틸리티 함수
│   └── firebase.ts             # Firebase 설정 및 쿼리 함수
├── functions/                   # Firebase Cloud Functions
└── public/locales/             # 다국어 리소스
    ├── ko/                     # 한국어 (기본)
    └── en/                     # 영어
```

### 핵심 파일 관계도
- **App.tsx** ↔ **Layout.tsx**: 라우팅과 네비게이션 동기화 필수
- **firebase.ts** ↔ **모든 페이지**: 데이터베이스 쿼리 중앙 관리
- **AuthContext.tsx** ↔ **권한 컴포넌트**: 인증 상태 동기화
- **다국어 파일**: ko/translation.json ↔ en/translation.json 동시 업데이트 필요

## 코딩 표준

### 명명 규칙
- **컴포넌트**: PascalCase (UserList.tsx)
- **훅**: camelCase + use 접두사 (useAuth.ts)
- **페이지**: PascalCase + Page 접미사 (StaffListPage.tsx)
- **유틸리티**: camelCase (formatDate.ts)
- **상수**: UPPER_SNAKE_CASE

### TypeScript 규칙
- 모든 컴포넌트에 Props interface 정의 필수
- Firebase 데이터는 별도 interface 정의
- any 타입 사용 금지, unknown 사용 권장

### 스타일링 규칙
- **Tailwind CSS만 사용** - 다른 CSS 프레임워크 금지
- 반응형 디자인: `sm:` `md:` `lg:` 접두사 필수
- 색상 팔레트: blue, green, red, gray 계열만 사용
- 일관된 간격: `p-4` `m-4` `space-y-4` 패턴 사용

## 기능 구현 표준

### Firebase 연동 규칙
- **모든 Firestore 쿼리는 firebase.ts에서 함수로 분리**
- 실시간 리스너 사용 시 cleanup 함수 필수 구현
- 에러 처리 및 로딩 상태 관리 필수
- 트랜잭션 사용 시 롤백 시나리오 고려

```typescript
// ✅ 좋은 예시
export const getStaffList = async (managerId: string) => {
  try {
    const query = query(
      collection(db, 'staff'),
      where('managerId', '==', managerId)
    );
    const snapshot = await getDocs(query);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Staff list fetch error:', error);
    throw error;
  }
};

// ❌ 나쁜 예시 - 컴포넌트에서 직접 쿼리
const StaffList = () => {
  const snapshot = await getDocs(collection(db, 'staff')); // 금지
};
```

### 인증 및 권한 관리
- **AuthContext 사용 필수** - 직접 Firebase Auth 호출 금지
- 페이지별 권한 체크: `PrivateRoute` 또는 `RoleBasedRoute` 컴포넌트 래핑
- 권한 레벨: `staff` < `manager` < `admin`

```typescript
// ✅ 권한 체크 필수
<RoleBasedRoute allowedRoles={['manager', 'admin']}>
  <StaffManagementPage />
</RoleBasedRoute>
```

### 다국어 처리 규칙
- **모든 사용자 표시 텍스트는 useTranslation 사용 필수**
- fallback 문자열 반드시 제공
- 번역 키는 `페이지명.섹션명.항목명` 패턴 사용

```typescript
// ✅ 좋은 예시
const { t } = useTranslation();
<button>{t('staffList.actions.delete', '삭제')}</button>

// ❌ 하드코딩 금지
<button>삭제</button>
```

### 상태 관리 패턴
- **로컬 상태**: useState 사용
- **전역 상태**: Context API 사용 (Redux 금지)
- **서버 상태**: 커스텀 훅으로 캐싱 구현

## 프레임워크별 사용 표준

### React 패턴
- 함수형 컴포넌트만 사용 (클래스 컴포넌트 금지)
- 커스텀 훅으로 로직 분리
- useEffect cleanup 함수 필수 구현
- 조건부 렌더링 시 null 반환보다 빈 fragment 사용

### Firebase 사용 규칙
- **보안 규칙 수정 금지** - 기존 firestore.rules 유지
- Cloud Functions 수정 시 배포 전 로컬 테스트 필수
- 인덱스 생성 시 firestore.indexes.json 업데이트

### Tailwind CSS 사용법
- 커스텀 CSS 클래스 생성 금지
- 유틸리티 클래스만 사용
- 복잡한 레이아웃은 Grid/Flexbox 조합 사용

## 워크플로우 표준

### 페이지 추가 워크플로우
1. `app2/src/pages/`에 컴포넌트 생성
2. `App.tsx`에 라우트 추가
3. `Layout.tsx`에 네비게이션 메뉴 추가
4. 권한 체크 컴포넌트로 래핑
5. 다국어 리소스 추가 (`ko/`, `en/`)

### 데이터 모델 변경 워크플로우
1. TypeScript interface 먼저 정의
2. Firebase 쿼리 함수 업데이트
3. 기존 데이터 마이그레이션 스크립트 작성
4. 관련 컴포넌트 동시 업데이트

### 컴포넌트 개발 워크플로우
1. Props interface 정의
2. 기본 구조 구현
3. 스타일링 (Tailwind만 사용)
4. 이벤트 핸들러 구현
5. 에러 상태 처리
6. 로딩 상태 처리

## 핵심 파일 상호작용 표준

### 필수 동시 수정 파일들

#### 새 페이지 추가 시
- `App.tsx` - 라우트 정의
- `Layout.tsx` - 네비게이션 메뉴
- `public/locales/ko/translation.json` - 한국어 라벨
- `public/locales/en/translation.json` - 영어 라벨

#### 권한 관련 수정 시
- `AuthContext.tsx` - 권한 로직
- `PrivateRoute.tsx` 또는 `RoleBasedRoute.tsx` - 라우트 보호
- 관련 페이지 컴포넌트 - 권한 체크

#### Firebase 스키마 변경 시
- `firebase.ts` - 쿼리 함수
- TypeScript interfaces - 타입 정의
- 관련 컴포넌트들 - 데이터 사용 부분

### 의존성 체크리스트
- **Toast 알림**: ToastContext 사용 필수
- **폼 유효성**: 사용자 입력 시 검증 로직 필수
- **에러 처리**: try-catch + Toast 알림 + 콘솔 로그
- **로딩 상태**: 모든 비동기 작업에 로딩 UI 필수

## AI 의사결정 표준

### 우선순위 판단 기준
1. **보안** > 성능 > 사용자 경험 > 개발 편의성
2. **기존 워크플로우 호환성** > 새로운 기능
3. **안정성** > 최신 기술 도입
4. **유지보수성** > 코드 간결성

### 모호한 상황 처리
- 권한 관련: 더 엄격한 보안 선택
- UI/UX 관련: 더 단순하고 직관적인 방법 선택
- 성능 관련: 측정 가능한 개선만 적용
- 기능 추가: 기존 기능과의 일관성 우선

### 의사결정 트리
```
새 기능 요청
├── 기존 권한 시스템과 호환? 
│   ├── Yes → 기존 패턴 따라 구현
│   └── No → 보안 검토 후 권한 시스템 확장
├── 기존 UI 패턴과 일치?
│   ├── Yes → 기존 컴포넌트 재사용
│   └── No → 새 컴포넌트 생성 (일관성 유지)
└── Firebase 스키마 변경 필요?
    ├── Yes → 마이그레이션 계획 수립 필수
    └── No → 기존 쿼리 함수 확장
```

## 도구 사용 최적화 가이드

### 터미널 명령 안전 실행 패턴

#### 🔴 터미널 무한 대기 문제 해결법
**문제**: 터미널 명령이 완료되어도 AI가 응답 대기 상태로 멈춤

**해결법**:
```bash
# 1. 백그라운드 실행 활용
run_terminal_cmd(command="git push origin master", is_background=true)

# 2. 완료 신호와 함께 실행
"git push origin master && echo 'PUSH_COMPLETED'"

# 3. 타임아웃 추가
"timeout 30 git push origin master || echo 'Command completed'"

# 4. 분할 실행
git status → git push (background) → git log --oneline -1
```

#### 안전한 터미널 실행 체크리스트
- ✅ 긴 명령은 `is_background: true` 설정
- ✅ 완료 신호 추가: `&& echo "COMPLETED"`
- ✅ 타임아웃 설정 고려
- ✅ 분할 실행으로 검증 가능

### 파일 수정 도구 선택 가이드

#### 🔧 도구 선택 결정 트리
```
파일 수정 필요
├── 파일 크기 < 100줄 + 수정 라인 < 3줄
│   └── search_replace ✅ (3초, 안전)
├── 패턴 명확 + 컨텍스트 충분
│   └── mcp_filesystem_edit_file ✅ (10초, 검증됨)
├── 복잡한 수정 또는 불확실
│   └── mcp_filesystem_write_file ✅ (30초, 전체 교체)
└── 최후의 수단
    └── edit_file_lines (dryRun 필수, 단순 수정만)
```

#### 🟢 search_replace 사용 패턴 (권장)
```typescript
// 1단계: 대상 텍스트 확인
grep_search("정확한 텍스트 패턴")

// 2단계: 충분한 컨텍스트 포함
old_string: "이전 줄\n수정할 줄\n다음 줄"
new_string: "이전 줄\n새로운 줄\n다음 줄"

// 3단계: 결과 확인
read_file(수정된 파일)
```

#### 🟡 edit_file_lines 사용 시 필수 절차
```bash
# 1. 파일 상태 확인
get_file_lines(path, lineNumbers, context: 5)

# 2. dryRun 테스트 (필수)
edit_file_lines(dryRun: true)

# 3. diff 검토 후 적용
approve_edit(stateId)

# 4. 결과 검증
get_file_lines(path, lineNumbers, context: 2)
```

### 안전성 단계별 접근법

#### 🟢 완전 안전 (Zero Risk)
- **적용**: 중요 파일, 복잡한 로직, 처음 접하는 코드
- **패턴**: `read → search → replace → verify`
- **도구**: `search_replace` 주 사용
- **보장**: 100% 코드 손상 방지

#### 🟡 검증된 안전 (Verified Safe)
- **적용**: 단순 수정, 패턴이 명확한 경우
- **패턴**: `parallel_read → targeted_edit → immediate_verify`
- **도구**: `mcp_filesystem_edit_file`
- **조건**: 충분한 컨텍스트 + 고유 패턴 확인

#### 🔴 격리된 위험 (Isolated Risk)
- **적용**: 대규모 변경, 새 파일 생성
- **패턴**: `backup → full_replace → compile_test → rollback_ready`
- **도구**: `mcp_filesystem_write_file`
- **조건**: 백업 필수 + 테스트 환경

### 문제 발생 시 복구 절차

#### 터미널 무한 대기 시
1. **사용자 스킵 대기**: Ctrl+C 또는 수동 중단
2. **백그라운드 전환**: `is_background: true` 재실행
3. **분할 실행**: 작은 단위로 나누어 실행
4. **결과 확인**: 별도 명령으로 상태 체크

#### 파일 수정 실패 시
1. **Git 상태 확인**: `git status`
2. **변경사항 되돌리기**: `git checkout -- <파일명>`
3. **안전한 도구 재선택**: `search_replace` 우선
4. **단계별 검증**: 각 수정 후 즉시 확인

#### 코드 손상 발생 시
1. **즉시 중단**: 추가 수정 금지
2. **Git 리셋**: `git reset --hard HEAD`
3. **백업 복원**: 이전 커밋으로 되돌리기
4. **원인 분석**: 도구 선택 재검토

## 금지사항

### 절대 금지
- **Firebase 설정 파일 수정** (firebase.json, firestore.rules)
- **인증 로직 우회** (AuthContext 무시)
- **CSS 프레임워크 혼용** (Tailwind 외 금지)
- **직접 DOM 조작** (React 패턴 위반)
- **any 타입 남용** (타입 안정성 훼손)
- **하드코딩된 문자열** (다국어 지원 위반)
- **터미널 무한 대기 방치** (백그라운드 실행 필수)
- **edit_file_lines dryRun 생략** (안전성 검증 필수)
- **복잡한 파일 수정에 edit_file_lines 사용** (search_replace 우선)

### 주의사항
- 기존 데이터베이스 스키마 변경 시 마이그레이션 필수
- 권한 체크 없는 민감한 기능 접근 금지
- 에러 처리 없는 Firebase 쿼리 금지
- 로딩 상태 없는 비동기 작업 금지

### 프로젝트별 제약
- **홀덤 용어**: 정확한 포커 용어 사용 필수
- **권한 구분**: 스태프/매니저/관리자 명확히 구분
- **급여 계산**: 기존 로직과 호환성 보장
- **토너먼트 상태**: 비즈니스 로직 일관성 유지

## 예외 상황 가이드

### 긴급 수정 시
1. 최소한의 변경으로 문제 해결
2. 임시 해결책이라도 타입 안전성 유지
3. 수정 후 즉시 로그 확인
4. 사용자에게 명확한 피드백 제공

### 레거시 코드 발견 시
1. 기존 동작 유지가 최우선
2. 점진적 개선 계획 수립
3. 새 코드는 현재 표준 적용
4. 호환성 깨는 변경 금지

### 성능 이슈 발생 시
1. 원인 정확히 파악 후 수정
2. 캐싱보다 쿼리 최적화 우선
3. 사용자 경험 저하 방지
4. 측정 가능한 개선만 적용

---

**문서 버전**: v1.1  
**최종 업데이트**: 2025년 1월  
**적용 대상**: T-HOLDEM 프로젝트 AI 에이전트  
**검토 주기**: 주요 기능 추가 시마다  
**v1.1 개선사항**: 터미널 무한 대기 문제 해결법, 파일 수정 도구 선택 가이드, 안전성 단계별 접근법 추가