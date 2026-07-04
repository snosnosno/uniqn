---
name: guard
description: 안전 가드레일. guard, 안전, 위험, 조심, 프로덕션 변경 요청 시 활성화. gstack guard 기반 + Uniqn 특화.
allowed-tools: Read, Grep, Glob, Bash, Task
---

# 안전 가드레일 (gstack guard + Uniqn 특화)

위험한 변경을 감지하고 경고합니다.

## 프로젝트 컨텍스트

```yaml
프로덕션: tholdem-ebc18 (Firebase)
웹: uniqn-app.pages.dev (Cloudflare Pages)
결제: RevenueCat 인앱 결제
역할 체계: admin(100) > employer(50) > staff(10)
```

## 위험 변경 감지

### CRITICAL (즉시 확인 필요)

#### Firebase Security Rules 변경
```bash
git diff -- firestore.rules storage.rules
```
- **위험**: 즉시 모든 사용자에게 적용, 롤백 어려움
- **필수 조치**: Rules 시뮬레이터 테스트 → 배포 전 백업

#### RevenueCat 결제 코드 변경
```bash
git diff -- uniqn-mobile/src/ | grep -i "revenueCat\|purchase\|subscription\|offering"
```
- **위험**: 결제 중단 → 매출 손실
- **필수 조치**: 테스트 환경에서 검증 → 스토어 정책 확인

#### UserRole 권한 체계 변경
```bash
git diff -- uniqn-mobile/src/ | grep -i "UserRole\|isAdmin\|isEmployer\|roleLevel\|ROLE_LEVELS"
```
- **위험**: 권한 상승/하락 취약점
- **필수 조치**: 모든 라우트 그룹 접근 제어 재검증

#### Firebase Auth 흐름 변경
```bash
git diff -- uniqn-mobile/src/ | grep -i "signIn\|signOut\|createUser\|auth\.\|onAuthStateChanged"
```
- **위험**: 인증 중단 → 전체 서비스 불능
- **필수 조치**: 로그인/로그아웃/회원가입 전체 플로우 테스트

### HIGH (커밋 전 확인)

#### runTransaction 제거
```bash
git diff -- uniqn-mobile/src/ | grep -B5 -A5 "runTransaction"
```
- **위험**: 데이터 일관성 깨짐 (다중 문서 동시 수정)
- **필수 조치**: 단일 문서 수정만 남았는지 확인

#### Firestore 인덱스 변경
```bash
git diff -- firestore.indexes.json
```
- **위험**: 기존 쿼리 중단 가능
- **필수 조치**: 새 인덱스 배포 → 쿼리 테스트

#### EAS Build 설정 변경
```bash
git diff -- uniqn-mobile/eas.json uniqn-mobile/app.json
```
- **위험**: 스토어 빌드 실패, 정책 위반
- **필수 조치**: 빌드 테스트 실행

### MEDIUM (확인 권장)

#### 다중 문서 수정에 Transaction 없음
- Firestore 관련 Service에서 2개 이상 `setDoc`/`updateDoc`/`deleteDoc` 호출 시 경고
- **필수 조치**: `runTransaction`으로 래핑

#### 환경변수 변경
```bash
git diff -- .env* | head -20
```

## 자동 실행 시점

변경사항이 위 패턴에 해당하면 `/review` 스킬 실행 시 자동으로 guard 검사를 포함합니다.

## 출력 형식

```markdown
## 안전 검사 결과

### 위험도 요약
- CRITICAL: [N개]
- HIGH: [N개]
- MEDIUM: [N개]

### 감지된 위험 변경
#### [심각도] [변경 유형]
- 파일: [경로]
- 위험: [설명]
- 필수 조치: [확인 사항]
- [ ] 확인 완료
```
