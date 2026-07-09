---
name: cso
description: 보안 감사. 보안 검사, 보안 체크, XSS, 취약점, 인젝션, cso, security audit 요청 시 활성화. gstack cso 기반 + Uniqn 특화.
allowed-tools: Read, Grep, Glob, Bash, Task
---

# 보안 감사 스킬 (gstack CSO + Uniqn 특화)

gstack의 인프라 우선 보안 감사를 Uniqn 프로젝트에 적용합니다.

## 프로젝트 컨텍스트

```yaml
스택: Expo SDK 54 / Firebase 12.6 / RevenueCat
인증: Firebase Auth (이메일/비밀번호, Custom Claims)
저장소: Firestore, Firebase Storage
결제: RevenueCat 인앱 결제
역할: admin(100) > employer(50) > staff(10)
보안 유틸: xssValidation, sanitizeHtml (src/utils/security)
```

## 감사 모드

### Quick Scan (일상 개발 시)
5분 이내 핵심 항목만 검사

### Comprehensive Scan (배포 전)
전체 항목 검사 (30분+)

## 감사 체크리스트

### 1. 시크릿 고고학 (Secrets Archaeology)
```bash
# 하드코딩된 시크릿 검색
grep -rn "api_key\|apikey\|secret\|password\|token" uniqn-mobile/src/ --include="*.ts" --include="*.tsx"
# .env 파일 git 추적 여부
git ls-files | grep -i "\.env"
# Firebase config 노출
grep -rn "apiKey\|authDomain\|projectId" uniqn-mobile/src/ --include="*.ts" | grep -v "firebaseConfig\|firebase.ts\|\.env"
```

### 2. Firebase Security Rules 검증
- [ ] 모든 컬렉션에 read/write 규칙 설정
- [ ] `allow read, write: if true` 패턴 없음
- [ ] 역할 기반 접근 제어 (admin/employer/staff)
- [ ] 문서 소유권 검증 (request.auth.uid == resource.data.userId)
- [ ] 데이터 유효성 검증 (request.resource.data 타입 체크)

### 3. 입력 검증 (OWASP A03)
```bash
# xssValidation 미적용 사용자 입력 검색
grep -rn "z\.string()" uniqn-mobile/src/ --include="*.ts" | grep -v "xssValidation"
# dangerouslySetInnerHTML 사용
grep -rn "dangerouslySetInnerHTML\|innerHTML" uniqn-mobile/src/
# eval 사용
grep -rn "eval(" uniqn-mobile/src/
```

### 4. 인증/인가 (OWASP A01, A07)
- [ ] 모든 보호 라우트에 인증 가드 적용
- [ ] UserRole 기반 접근 제어 (라우트 그룹별)
- [ ] Firebase Custom Claims 서버사이드 검증
- [ ] 토큰 만료/갱신 처리
- [ ] SecureStore로 민감 토큰 저장 (AsyncStorage 아님)

### 5. 민감 데이터 보호 (OWASP A02)
```bash
# console.log에 민감 정보 노출
grep -rn "console\.\(log\|info\|warn\)" uniqn-mobile/src/ --include="*.ts" --include="*.tsx"
# SecureStore 미사용 확인
grep -rn "AsyncStorage" uniqn-mobile/src/ | grep -i "token\|secret\|key\|password"
```

### 6. 의존성 공급망 (OWASP A06)
```bash
cd uniqn-mobile && npm audit 2>&1 | head -50
npm outdated --json 2>/dev/null | head -30
```

### 7. RevenueCat 결제 보안
- [ ] 서버사이드 영수증 검증 (클라이언트만 의존하지 않음)
- [ ] 결제 상태 Firestore 동기화
- [ ] 무료/유료 기능 분리 서버 검증

### 8. STRIDE 위협 모델링

| 위협 | 항목 | 검사 내용 |
|------|------|----------|
| Spoofing | 인증 | Firebase Auth 우회 가능성 |
| Tampering | 데이터 | Firestore Security Rules 무결성 |
| Repudiation | 감사 | 중요 작업 로깅 여부 |
| Information Disclosure | 노출 | 에러 메시지에 민감 정보 포함 여부 |
| Denial of Service | 가용성 | Rate limiting, 대량 쿼리 방지 |
| Elevation of Privilege | 권한 | UserRole 변경 보호 (runTransaction 필수) |

## 출력 형식

```markdown
## 보안 감사 결과

### 요약
- 감사 모드: [Quick/Comprehensive]
- 발견 취약점: CRITICAL [N] / HIGH [N] / MEDIUM [N] / LOW [N]
- 감사 점수: [0-100]

### CRITICAL
[즉시 조치 필요 항목]

### HIGH
[배포 전 수정 필요 항목]

### MEDIUM
[권장 수정 항목]

### 통과 항목
- [x] 통과 항목 목록

### 권장 조치
1. [조치 사항]
```
