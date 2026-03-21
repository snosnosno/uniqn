# 23. Firestore ?ㅽ궎留?諛?API 李몄“

## 紐⑹감
1. [媛쒖슂](#1-媛쒖슂)
2. [Firestore 而щ젆??援ъ“](#2-firestore-而щ젆??援ъ“)
3. [?듭떖 ?ㅽ궎留??뺤쓽](#3-?듭떖-?ㅽ궎留??뺤쓽)
4. [荑쇰━ ?⑦꽩](#4-荑쇰━-?⑦꽩)
5. [?몃뜳???ㅼ젙](#5-?몃뜳???ㅼ젙)
6. [蹂댁븞 洹쒖튃](#6-蹂댁븞-洹쒖튃)
7. [API ?붾뱶?ъ씤??(#7-api-?붾뱶?ъ씤??
8. [?먮윭 肄붾뱶](#8-?먮윭-肄붾뱶)

---

## 1. 媛쒖슂

### ?곗씠?곕쿋?댁뒪 援ъ“

```
Firebase Project: tholdem-ebc18
?쒋?? Firestore Database
??  ?쒋?? users/              # ?ъ슜???뺣낫
??  ?쒋?? staff/              # ?ㅽ깭???꾨줈??
??  ?쒋?? jobPostings/        # 援ъ씤怨듦퀬
??  ?쒋?? applications/       # 吏?먯꽌
??  ?쒋?? workLogs/           # 洹쇰Т 湲곕줉
??  ?쒋?? attendanceRecords/  # 異쒗눜洹?湲곕줉
??  ?쒋?? notifications/      # ?뚮┝
??  ?쒋?? tournaments/        # ?좊꼫癒쇳듃 (鍮꾪솢?깊솕)
??  ?쒋?? payments/           # 寃곗젣 湲곕줉
??  ?붴?? inquiries/          # 臾몄쓽?ы빆
??
?쒋?? Authentication
??  ?쒋?? Email/Password
??  ?쒋?? Google OAuth
??  ?붴?? Kakao OAuth
??
?쒋?? Cloud Functions
??  ?쒋?? ?몄떆 ?뚮┝
??  ?쒋?? 寃곗젣 ?뱁썒
??  ?붴?? ?덉빟 ?묒뾽
??
?붴?? Cloud Storage
    ?쒋?? profileImages/
    ?붴?? documents/
```

### ?쒖??붾맂 ?꾨뱶 洹쒖튃

```yaml
ID ?꾨뱶:
  - 臾몄꽌 ID: id (?먮룞 ?앹꽦 ?먮뒗 UUID)
  - ?ъ슜??李몄“: userId
  - ?ㅽ깭??李몄“: staffId
  - 怨듦퀬 李몄“: eventId ?먮뒗 postId
  - 吏?먯꽌 李몄“: applicationId

?쒓컙 ?꾨뱶:
  - ?앹꽦?? createdAt (Timestamp)
  - ?섏젙?? updatedAt (Timestamp)
  - ?덉젙 ?쒓컙: scheduledStartTime, scheduledEndTime
  - ?ㅼ젣 ?쒓컙: actualStartTime, actualEndTime

?곹깭 ?꾨뱶:
  - status: enum 臾몄옄??(?? 'active', 'inactive')
  - isActive: boolean (媛꾨떒???쒖꽦???щ?)

?ㅼ씠諛?
  - camelCase ?ъ슜
  - 紐낇솗???섎? ?꾨떖 (startTime vs time)
```

### Role ????뺤쓽 (以묒슂)

?쒖뒪?쒖뿉????媛吏 ?ㅻⅨ Role 媛쒕뀗??議댁옱?⑸땲??

```typescript
// src/types/roles.ts

/**
 * UserRole: ?쒖뒪?????ъ슜?먯쓽 沅뚰븳 ?깃툒
 * - users 而щ젆?섏뿉???ъ슜
 * - ???묎렐 沅뚰븳 諛?湲곕뒫 ?쒖뼱???ъ슜
 *
 * 沅뚰븳 泥닿퀎:
 * - guest (鍮꾨줈洹몄씤): role === null ??怨듦퀬 紐⑸줉留?議고쉶 媛??
 * - staff (湲곕낯 媛?낆옄): 怨듦퀬 寃???곸꽭/吏?? QR 異쒗눜洹? ???ㅼ?以?
 * - employer (援ъ씤??: staff 沅뚰븳 + 怨듦퀬 ?묒꽦/愿由? 吏?먯옄 ?뺤젙/嫄곗젅, ?뺤궛
 * - admin (愿由ъ옄): 紐⑤뱺 沅뚰븳 + ?ъ슜??愿由? ?쒖뒪???ㅼ젙
 */
export type UserRole = 'staff' | 'employer' | 'admin'

export const UserRoleHierarchy = {
  admin: 100,     // ?쒖뒪??愿由ъ옄 (?꾩껜 沅뚰븳)
  employer: 50,   // 援ъ씤??(怨듦퀬 愿由?+ staff 沅뚰븳)
  staff: 10,      // 湲곕낯 媛?낆옄 (吏?? 異쒗눜洹?
  // guest: 0     // 鍮꾨줈洹몄씤 (role === null)
} as const

export const UserRoleDescriptions = {
  admin: '?쒖뒪??愿由ъ옄 - 紐⑤뱺 沅뚰븳',
  employer: '援ъ씤??- 怨듦퀬 ?묒꽦 諛?吏?먯옄 愿由?,
  staff: '?ㅽ깭??- 怨듦퀬 吏??諛?洹쇰Т',
} as const

/**
 * StaffRole: 洹쇰Т ???대떦?섎뒗 吏곷Т/?ъ???
 * - staff 而щ젆?? workLogs, applications?먯꽌 ?ъ슜
 * - 援ъ씤怨듦퀬 紐⑥쭛 ??븷 諛?洹쇰Т 諛곗젙???ъ슜
 */
export type StaffRole =
  | 'dealer'      // ?쒕윭
  | 'floor'       // ?뚮줈??
  | 'td'          // Tournament Director (?좊꼫癒쇳듃 ?붾젆??
  | 'dc'          // Dealer Coordinator (?쒕윭 肄붾뵒?ㅼ씠??
  | 'chips'       // Chip Master (移?留덉뒪??
  | 'register'    // ?덉??ㅽ꽣 (?묒닔/?깅줉)
  | 'serving'     // ?쒕튃
  | 'guard'       // 媛??(寃쏀샇/蹂댁븞)
  | 'manager'     // 留ㅻ땲?

export const StaffRoleLabels: Record<StaffRole, string> = {
  dealer: '?쒕윭',
  floor: '?뚮줈??,
  td: '?좊꼫癒쇳듃 ?붾젆??,
  dc: '?쒕윭 肄붾뵒?ㅼ씠??,
  chips: '移?留덉뒪??,
  register: '?덉??ㅽ꽣',
  serving: '?쒕튃',
  guard: '媛??,
  manager: '留ㅻ땲?',
} as const

// ??븷蹂??곗꽑?쒖쐞 (?뺤궛/諛곗튂 ??李멸퀬)
export const StaffRolePriority: Record<StaffRole, number> = {
  td: 9,        // 理쒓퀬 梨낆엫??
  manager: 8,
  dc: 7,
  floor: 6,
  chips: 5,
  dealer: 4,
  register: 3,
  serving: 2,
  guard: 1,
} as const

// ???媛??
export function isValidUserRole(role: string): role is UserRole {
  return ['admin', 'employer', 'staff'].includes(role)
}

// Guest ?щ? ?뺤씤 (role??null?대㈃ guest)
export function isGuest(role: UserRole | null): boolean {
  return role === null
}

const STAFF_ROLES: StaffRole[] = ['dealer', 'floor', 'td', 'dc', 'chips', 'register', 'serving', 'guard', 'manager']

export function isValidStaffRole(role: string): role is StaffRole {
  return STAFF_ROLES.includes(role as StaffRole)
}
```

### users vs staff 而щ젆??梨낆엫 遺꾨━

| 援щ텇 | users 而щ젆??| staff 而щ젆??|
|------|-------------|--------------|
| **紐⑹쟻** | ?쒖뒪???ъ슜??怨꾩젙 | ?ㅽ깭???꾨줈???대젰 |
| **1:1 愿怨?* | Firebase Auth UID | userId濡?users 李몄“ |
| **Role ?섎?** | ?쒖뒪???묎렐 沅뚰븳 (UserRole) | 洹쇰Т 吏곷Т (StaffRole) |
| **?앹꽦 ?쒖젏** | ?뚯썝媛?????먮룞 (staff 湲곕낯) | ?ㅽ깭???깅줉 ???섎룞 |
| **?꾩닔 ?щ?** | 紐⑤뱺 ?ъ슜??| ?ㅽ깭?꾨줈 ?쒕룞?섎뒗 ?ъ슜?먮쭔 |
| **二쇱슂 ?꾨뱶** | email, consents | bankName, experience, rating |

```
Guest (鍮꾨줈洹몄씤)
?붴?? users/       ?? (?놁쓬, role === null)

?ъ슜??A (湲곕낯 媛?낆옄 - 怨듦퀬 吏?먮쭔)
?쒋?? users/userA  ?? role: 'staff' (湲곕낯媛?
?붴?? staff/staffA ?? role: 'dealer' (吏곷Т), userId: 'userA'

?ъ슜??B (援ъ씤??- 怨듦퀬 ?묒꽦/愿由?
?쒋?? users/userB  ?? role: 'employer'
?붴?? staff/       ?? (?놁쓬, 吏곸젒 洹쇰Т?섏? ?딆쓬)

?ъ슜??C (愿由ъ옄)
?쒋?? users/userC  ?? role: 'admin'
?붴?? staff/staffC ?? role: 'td' (吏곷Т), userId: 'userC' (?좏깮??
```

### ??븷 ?낃렇?덉씠???뚮줈??

```
?뚢???????????????????????????????????????????????????????????????
??                    ??븷 ?낃렇?덉씠???뚮줈??                   ??
?붴???????????????????????????????????????????????????????????????

Guest (鍮꾨줈洹몄씤)
    ??
    ???뚯썝媛??
    ??
Staff (湲곕낯 媛?낆옄, role: 'staff')
    ??
    ??怨듦퀬 ?묒꽦 ?붿껌 ?????ъ뾽???깅줉 ?몄쬆
    ??
Employer (援ъ씤?? role: 'employer')
    ??
    ??愿由ъ옄 ?뱀씤
    ??
Admin (愿由ъ옄, role: 'admin') - ?쇰컲?곸쑝濡??섎룞 遺??
```

### Service ?ㅼ씠諛?而⑤깽??

```yaml
Service ?뚯씪紐?洹쒖튃:
  湲곕낯?? "{?꾨찓??Service.ts"
  ?덉떆:
    - jobPostingService.ts       # 援ъ씤怨듦퀬 CRUD
    - applicationService.ts      # 吏?먯꽌 愿由?
    - attendanceService.ts       # 異쒗눜洹?愿由?
    - paymentService.ts          # 寃곗젣 泥섎━

湲덉? ?⑦꽩:
  - jobPostingCreateService.ts   # ???숈옉???뚯씪紐낆뿉 ?ы븿?섏? ?딆쓬
  - createJobPosting.ts          # ???숈궗濡??쒖옉?섏? ?딆쓬
  - JobPostingService.ts         # ??PascalCase ?ъ슜?섏? ?딆쓬

硫붿꽌???ㅼ씠諛?洹쒖튃:
  議고쉶: get{Entity}, get{Entity}List, get{Entity}ById
  ?앹꽦: create{Entity}
  ?섏젙: update{Entity}
  ??젣: delete{Entity}
  寃?? search{Entity}, filter{Entity}
  ?곹깭蹂寃? confirm{Entity}, cancel{Entity}, close{Entity}

?덉떆 (jobPostingService.ts):
  - getJobPosting(id)            # ?④굔 議고쉶
  - getJobPostings(filters)      # 紐⑸줉 議고쉶
  - createJobPosting(data)       # ?앹꽦
  - updateJobPosting(id, data)   # ?섏젙
  - deleteJobPosting(id)         # ??젣
  - closeJobPosting(id, reason)  # ?곹깭 蹂寃?
```

---

## 2. Firestore 而щ젆??援ъ“

### 2.1 users (?ъ슜??

```typescript
interface User {
  // === 湲곕낯 ?뺣낫 ===
  id: string                    // Firebase Auth UID
  email: string                 // ?대찓??(怨좎쑀)
  name: string                  // ?ㅻ챸
  nickname?: string             // ?됰꽕??

  // === ??븷 諛?沅뚰븳 ===
  role: UserRole                // 'staff' | 'employer' | 'admin' (?뚯썝媛????湲곕낯 'staff')
  isActive: boolean             // ?쒖꽦 ?곹깭

  // === ?곕씫泥?===
  phone?: string                // ?꾪솕踰덊샇 (010-0000-0000)
  phoneVerified?: boolean       // ?꾪솕踰덊샇 ?몄쬆 ?щ?

  // === ?꾨줈??===
  profileImage?: string         // Storage URL
  bio?: string                  // ?먭린?뚭컻

  // === ?뚮┝ ?ㅼ젙 ===
  notificationSettings: {
    push: boolean               // ?몄떆 ?뚮┝
    email: boolean              // ?대찓???뚮┝
    sms: boolean                // SMS ?뚮┝
  }

  // === FCM ?좏겙 ===
  fcmTokens?: Array<{
    token: string
    platform: 'ios' | 'android' | 'web'
    updatedAt: Timestamp
  }>

  // === ?숈쓽 ?뺣낫 ===
  consents: {
    termsOfService: { agreed: boolean; agreedAt: Timestamp }
    privacyPolicy: { agreed: boolean; agreedAt: Timestamp }
    marketing?: { agreed: boolean; agreedAt: Timestamp }
  }

  // === 蹂댁븞 ===
  lastLoginAt?: Timestamp
  loginHistory?: Array<{
    timestamp: Timestamp
    platform: string
    ip?: string
  }>

  // === 硫뷀??곗씠??===
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### 2.2 staff (?ㅽ깭???꾨줈??

```typescript
interface Staff {
  // === 湲곕낯 ?뺣낫 ===
  id: string                    // ?ㅽ깭??怨좎쑀 ID
  userId: string                // Firebase Auth UID 李몄“
  name: string                  // ?대쫫
  phone: string                 // ?곕씫泥?

  // === ??븷 諛??곹깭 ===
  role: StaffRole               // dealer | floor | td | dc | chips | register | serving | guard | manager
  status: 'active' | 'inactive'

  // === ?곕씫泥?===
  email?: string

  // === 怨꾩쥖 ?뺣낫 (?뺤궛?? ===
  bankName?: string             // ??됰챸
  accountNumber?: string        // 怨꾩쥖踰덊샇
  accountHolder?: string        // ?덇툑二?

  // === 寃쎈젰 ?뺣낫 ===
  experience?: {
    years: number               // 寃쎈젰 ?꾩닔
    specialties: string[]       // ?꾨Ц 遺꾩빞
    certifications?: string[]   // ?먭꺽利?
  }

  // === ?됯? ===
  rating?: {
    average: number             // ?됯퇏 ?됱젏 (1-5)
    count: number               // ?됯? ??
  }

  // === 鍮꾧퀬 ===
  notes?: string

  // === 硫뷀??곗씠??===
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

#### staff/{staffId}/qrCodes (?쒕툕而щ젆??

```typescript
interface StaffQRCode {
  id: string
  qrData: string                // QR 肄붾뱶 ?곗씠??(?뷀샇??
  createdAt: Timestamp
  expiresAt?: Timestamp
  isActive: boolean
}
```

### 2.3 jobPostings (구인공고)

> 2026-03 implementation note
>
> The runtime implementation now uses a canonical read model:
> `JobPostingDocumentV3 -> JobPostingEntity -> PostingFacts -> surface projector`.
> Public card/detail and employer card/detail all consume the shared facts layer.
>
> Canonical storage sections:
> `location`, `schedule`, `roleCatalog`, `compensation`, `questions`
>
> Query helper fields kept top-level:
> `status`, `ownerId`, `ownerName`, `postingType`, `workDate`, `workDates`, `roleKeys`,
> `createdAt`, `updatedAt`, `totalPositions`, `filledPositions`, `viewCount`,
> `applicationCount`

```typescript
interface JobPosting {
  id: string
  schemaVersion: 3
  title: string
  description?: string
  status: 'active' | 'closed' | 'cancelled'
  ownerId: string
  ownerName?: string
  postingType?: 'regular' | 'fixed' | 'tournament' | 'urgent'
  workDate: string
  workDates?: string[]
  roleKeys?: string[]
  totalPositions: number
  filledPositions: number
  viewCount?: number
  applicationCount?: number
  createdAt: Timestamp
  updatedAt: Timestamp
  closedAt?: Timestamp
  closedReason?: 'manual' | 'expired' | 'expired_by_work_date'
  tags?: string[]
  contactPhone?: string
  searchIndex?: string[]

  location: {
    name: string
    district?: string
    detailedAddress?: string
  }

  schedule:
    | {
        kind: 'dated'
        primaryDate: string
        allDates: string[]
        requirements: Array<{
          date: string
          isGrouped?: boolean
          timeSlots: Array<{
            id?: string
            startTime?: string
            isTimeToBeAnnounced?: boolean
            tentativeDescription?: string
            roles: Array<{
              id?: string
              role?: string
              customRole?: string
              count: number
              filled?: number
            }>
          }>
        }>
      }
    | {
        kind: 'fixed'
        daysPerWeek?: number
        startTime?: string
        isStartTimeNegotiable?: boolean
        roleRequirements?: Array<{
          role?: string
          customRole?: string
          count: number
          filled?: number
        }>
      }

  roleCatalog: Array<{
    role: string
    customRole?: string
    salary?: {
      type: 'hourly' | 'daily' | 'monthly' | 'other'
      amount: number
    }
  }>

  compensation: {
    mode: 'shared' | 'by_role'
    defaultSalary?: {
      type: 'hourly' | 'daily' | 'monthly' | 'other'
      amount: number
    }
    allowances?: {
      guaranteedHours?: number
      meal?: number
      transportation?: number
      accommodation?: number
    }
    taxSettings?: {
      type: 'none' | 'rate' | 'fixed'
      value: number
      taxableItems?: {
        basePay?: boolean
        meal?: boolean
        transportation?: boolean
        accommodation?: boolean
        additional?: boolean
      }
    }
  }

  questions: {
    items: PreQuestion[]
  }

  fixedConfig?: {
    durationDays: 7
    expiresAt: Timestamp
    createdAt: Timestamp
  }

  tournamentConfig?: {
    approvalStatus: 'pending' | 'approved' | 'rejected'
    submittedAt: Timestamp
    approvedBy?: string
    approvedAt?: Timestamp
    rejectedBy?: string
    rejectedAt?: Timestamp
    rejectionReason?: string
    resubmittedAt?: Timestamp
  }

  urgentConfig?: {
    createdAt: Timestamp
    priority: 'high'
  }
}
```

### 2.4 applications (지원서)

```typescript
interface Application {
  // === 湲곕낯 ?뺣낫 ===
  id: string
  applicantId: string           // userId
  applicantName: string
  applicantEmail?: string
  applicantPhone?: string

  // === 怨듦퀬 ?뺣낫 ===
  eventId: string               // jobPostingId (?쒖? ?꾨뱶)
  postId: string                // ?섏쐞 ?명솚??
  postTitle: string

  // === ?곹깭 ===
  status: 'applied' | 'confirmed' | 'cancelled' | 'pending' | 'pending_confirmation'
  recruitmentType?: 'event' | 'fixed'

  // === 諛곗젙 ?뺣낫 (Single Source of Truth) ===
  assignments: Array<{
    role?: string               // ?⑥씪 ??븷
    roles?: string[]            // ?ㅼ쨷 ??븷
    timeSlot: string            // ?쒓컙?
    dates: string[]             // ?좎쭨 諛곗뿴
    isGrouped: boolean          // 洹몃９ ?щ?
    groupId?: string            // 洹몃９ ID
    checkMethod?: 'group' | 'individual'
    requirementId?: string
    duration?: {
      type: 'single' | 'consecutive' | 'multi'
      startDate: string
      endDate?: string
    }
  }>

  // === ?먮낯 吏???뺣낫 (?대젰 異붿쟻) ===
  originalApplication?: {
    assignments: Assignment[]
    appliedAt: Timestamp
  }

  // === ?뺤젙 ?대젰 ===
  confirmationHistory?: Array<{
    confirmedAt: Timestamp
    cancelledAt?: Timestamp
    assignments: Assignment[]
  }>

  // === ?ъ쟾 吏덈Ц ?듬? ===
  preQuestionAnswers?: Array<{
    questionId: string
    question: string
    answer: string
    required: boolean
  }>

  // === 鍮꾧퀬 ===
  notes?: string

  // === 硫뷀??곗씠??===
  appliedAt: Timestamp
  confirmedAt?: Timestamp
  cancelledAt?: Timestamp
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### 2.5 workLogs (洹쇰Т 湲곕줉)

```typescript
interface WorkLog {
  // === 湲곕낯 ?뺣낫 ===
  id: string
  staffId: string               // staff 臾몄꽌 ID
  eventId?: string              // jobPosting ID (?좏깮)

  // === 洹쇰Т ?쇱떆 ===
  date: string                  // YYYY-MM-DD

  // === ?덉젙 ?쒓컙 ===
  scheduledStartTime?: string   // HH:mm
  scheduledEndTime?: string     // HH:mm

  // === ?ㅼ젣 ?쒓컙 ===
  actualStartTime?: string | Timestamp
  actualEndTime?: string | Timestamp

  // === 洹쇰Т ?뺣낫 ===
  role?: string                 // ??븷
  tableNumber?: number          // ?뚯씠釉?踰덊샇

  // === ?곹깭 ===
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'

  // === ?뺤궛 ?뺣낫 ===
  payroll?: {
    baseSalary: number          // 湲곕낯湲?
    overtime?: number           // 珥덇낵洹쇰Т
    deductions?: number         // 怨듭젣
    bonus?: number              // 蹂대꼫??
    total: number               // 珥앹븸
    isPaid: boolean             // 吏湲??щ?
    paidAt?: Timestamp
  }

  // === 鍮꾧퀬 ===
  notes?: string

  // === 硫뷀??곗씠??===
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### 2.6 attendanceRecords (異쒗눜洹?湲곕줉)

```typescript
interface AttendanceRecord {
  // === 湲곕낯 ?뺣낫 ===
  id: string
  staffId: string
  eventId?: string              // jobPosting ID
  workLogId?: string            // workLog 李몄“

  // === ?좎쭨 ===
  date: string                  // YYYY-MM-DD

  // === ?곹깭 ===
  status: 'not_started' | 'checked_in' | 'checked_out'

  // === 異쒗눜洹??쒓컙 ===
  checkInTime?: Timestamp
  checkOutTime?: Timestamp

  // === QR 肄붾뱶 ?뺣낫 ===
  qrCodeId?: string
  checkInMethod?: 'qr' | 'manual' | 'gps'
  checkOutMethod?: 'qr' | 'manual' | 'gps'

  // === ?꾩튂 ?뺣낫 ===
  checkInLocation?: {
    latitude: number
    longitude: number
    accuracy: number
  }
  checkOutLocation?: {
    latitude: number
    longitude: number
    accuracy: number
  }

  // === 鍮꾧퀬 ===
  notes?: string
  adminNotes?: string           // 愿由ъ옄 硫붾え

  // === 硫뷀??곗씠??===
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### 2.7 notifications (?뚮┝)

```typescript
interface Notification {
  // === 湲곕낯 ?뺣낫 ===
  id: string
  userId: string                // ?섏떊??

  // === ?뚮┝ ?댁슜 ===
  type: 'application' | 'confirmation' | 'cancellation' |
        'payment' | 'system' | 'reminder' | 'announcement'
  title: string
  body: string

  // === 愿???곗씠??===
  data?: {
    eventId?: string
    applicationId?: string
    paymentId?: string
    [key: string]: string | undefined
  }

  // === ?곹깭 ===
  isRead: boolean
  readAt?: Timestamp

  // === ?λ쭅??===
  actionUrl?: string            // ?????대룞 寃쎈줈

  // === 硫뷀??곗씠??===
  createdAt: Timestamp
}
```

### 2.8 purchases (?ㅼ씠??異⑹쟾 湲곕줉)

```typescript
interface Purchase {
  // === 湲곕낯 ?뺣낫 ===
  id: string
  userId: string

  // === ?⑦궎吏 ?뺣낫 ===
  packageId: 'starter' | 'basic' | 'popular' | 'premium'
  diamonds: number              // 湲곕낯 ?ㅼ씠???섎웾
  bonusDiamonds: number         // 蹂대꼫???ㅼ씠???섎웾
  totalDiamonds: number         // 珥?吏湲??ㅼ씠??
  price: number                 // 寃곗젣 湲덉븸 (??

  // === RevenueCat ?곕룞 ===
  revenueCatTransactionId: string
  store: 'app_store' | 'play_store'
  productId: string             // com.uniqn.diamond.{packageId}
  environment: 'sandbox' | 'production'

  // === ?곹깭 ===
  status: 'pending' | 'completed' | 'failed' | 'refunded'

  // === ?섎텋 ?뺣낫 ===
  refund?: {
    amount: number
    diamondsDeducted: number
    reason: string
    refundedAt: Timestamp
  }

  // === 硫뷀??곗씠??===
  createdAt: Timestamp
  completedAt?: Timestamp
}
```

### 2.9 users/{userId}/heartBatches (?섑듃 諛곗튂)

```typescript
interface HeartBatch {
  // === 湲곕낯 ?뺣낫 ===
  id: string                    // ?먮룞 ?앹꽦

  // === ?섑듃 ?뺣낫 ===
  amount: number                // ?띾뱷 ?섎웾
  remainingAmount: number       // ?⑥? ?섎웾
  source: HeartSource           // ?띾뱷 寃쎈줈

  // === 湲곌컙 ===
  acquiredAt: Timestamp
  expiresAt: Timestamp          // ?띾뱷??+ 90??

  // === 硫뷀??곗씠??===
  metadata?: {
    referrerId?: string         // 異붿쿇??ID (珥덈? 蹂댁긽 ??
    workLogId?: string          // 洹쇰Т 湲곕줉 ID (由щ럭 ?묒꽦 ??
    [key: string]: string | undefined
  }
}

type HeartSource =
  | 'signup_bonus'      // 媛??蹂대꼫??(+10)
  | 'daily_attendance'  // ?쇱씪 異쒖꽍 (+1)
  | 'weekly_streak'     // 7???곗냽 異쒖꽍 (+3)
  | 'review_bonus'      // 由щ럭 ?묒꽦 (+1)
  | 'referral_bonus'    // 移쒓뎄 珥덈? (+5)
  | 'admin_grant'       // 愿由ъ옄 吏湲?
```

### 2.10 users/{userId}/pointTransactions (?ъ씤??嫄곕옒 湲곕줉)

```typescript
interface PointTransaction {
  // === 湲곕낯 ?뺣낫 ===
  id: string
  userId: string

  // === 嫄곕옒 ?뺣낫 ===
  type: 'earn' | 'spend' | 'refund' | 'expire'
  pointType: 'heart' | 'diamond'
  amount: number                // ?묒닔: ?띾뱷, ?뚯닔: 李④컧

  // === ?곸꽭 ?뺣낫 ===
  source?: HeartSource          // ?섑듃 ?띾뱷 ??
  purchaseId?: string           // ?ㅼ씠??異⑹쟾 ??
  jobPostingId?: string         // 怨듦퀬 ?깅줉 李④컧 ??
  postingType?: 'regular' | 'urgent' | 'fixed'  // 怨듦퀬 ???

  // === ?붿븸 ?ㅻ깄??===
  balanceAfter: {
    hearts: number
    diamonds: number
  }

  // === 硫뷀??곗씠??===
  createdAt: Timestamp
  description?: string          // 嫄곕옒 ?ㅻ챸
}
```

### 2.9 inquiries (臾몄쓽?ы빆)

```typescript
interface Inquiry {
  // === 湲곕낯 ?뺣낫 ===
  id: string
  userId: string

  // === 臾몄쓽 ?댁슜 ===
  category: 'general' | 'payment' | 'technical' | 'report' | 'other'
  subject: string
  content: string

  // === 泥⑤??뚯씪 ===
  attachments?: Array<{
    url: string
    filename: string
    size: number
  }>

  // === ?곹깭 ===
  status: 'pending' | 'in_progress' | 'resolved' | 'closed'

  // === ?듬? ===
  responses?: Array<{
    content: string
    respondedBy: string         // admin userId
    respondedAt: Timestamp
  }>

  // === 硫뷀??곗씠??===
  createdAt: Timestamp
  updatedAt: Timestamp
  resolvedAt?: Timestamp
}
```

---

## 3. ?듭떖 ?ㅽ궎留??뺤쓽

### 3.1 Zod ?ㅽ궎留?(寃利앹슜)

```typescript
// src/schemas/user.schema.ts
import { z } from 'zod'

export const userProfileSchema = z.object({
  name: z.string()
    .min(2, '?대쫫? 2???댁긽')
    .max(50, '?대쫫? 50???댄븯'),
  nickname: z.string()
    .min(2, '?됰꽕?꾩? 2???댁긽')
    .max(20, '?됰꽕?꾩? 20???댄븯')
    .optional(),
  phone: z.string()
    .regex(/^01[0-9]-\d{3,4}-\d{4}$/, '?щ컮瑜??꾪솕踰덊샇 ?뺤떇 (010-0000-0000)')
    .optional(),
  bio: z.string()
    .max(500, '?먭린?뚭컻??500???댄븯')
    .optional(),
})

// src/schemas/jobPosting.schema.ts
export const jobPostingSchema = z.object({
  schemaVersion: z.literal(3),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['active', 'closed', 'cancelled']),
  ownerId: z.string().min(1),
  postingType: z.enum(['regular', 'fixed', 'tournament', 'urgent']).optional(),
  location: z.object({
    name: z.string().min(1),
    district: z.string().optional(),
    detailedAddress: z.string().optional(),
  }).strict(),
  schedule: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('dated'),
      primaryDate: z.string(),
      allDates: z.array(z.string()),
      requirements: z.array(z.object({
        date: z.string(),
        isGrouped: z.boolean().optional(),
        timeSlots: z.array(z.object({
          id: z.string().optional(),
          startTime: z.string().optional(),
          isTimeToBeAnnounced: z.boolean().optional(),
          tentativeDescription: z.string().optional(),
          roles: z.array(z.object({
            id: z.string().optional(),
            role: z.string().optional(),
            customRole: z.string().optional(),
            count: z.number().min(1),
            filled: z.number().optional(),
          }).strict()),
        }).strict()),
      }).strict()).min(1),
    }).strict(),
    z.object({
      kind: z.literal('fixed'),
      daysPerWeek: z.number().optional(),
      startTime: z.string().optional(),
      isStartTimeNegotiable: z.boolean().optional(),
      roleRequirements: z.array(z.object({
        role: z.string().optional(),
        customRole: z.string().optional(),
        count: z.number().min(1),
        filled: z.number().optional(),
      }).strict()).optional(),
    }).strict(),
  ]),
  roleCatalog: z.array(z.object({
    role: z.string(),
    customRole: z.string().optional(),
    salary: z.object({
      type: z.enum(['hourly', 'daily', 'monthly', 'other']),
      amount: z.number(),
    }).optional(),
  }).strict()).min(1),
  compensation: z.object({
    mode: z.enum(['shared', 'by_role']),
    defaultSalary: z.object({
      type: z.enum(['hourly', 'daily', 'monthly', 'other']),
      amount: z.number(),
    }).optional(),
  }).strict(),
  questions: z.object({
    items: z.array(z.object({
      id: z.string(),
      question: z.string(),
      required: z.boolean(),
      type: z.enum(['text', 'select', 'multiselect']),
      options: z.array(z.string()).optional(),
    }).strict()),
  }).strict(),
})

// src/schemas/application.schema.ts
export const applicationSchema = z.object({
  eventId: z.string().min(1),
  assignments: z.array(z.object({
    roleIds: z.array(z.string()).min(1),
    timeSlot: z.string().min(1),
    dates: z.array(z.string()).min(1),
    isGrouped: z.boolean(),
  })).min(1, '理쒖냼 1媛??좏깮 ?꾩슂'),
  preQuestionAnswers: z.array(z.object({
    questionId: z.string(),
    answer: z.string(),
  })).optional(),
})
```

### 3.2 ???媛???⑥닔

```typescript
// src/types/guards.ts

// User ??븷 寃利?
export function isAdmin(user: User): boolean {
  return user.role === 'admin'
}

export function isManager(user: User): boolean {
  return user.role === 'admin' || user.role === 'manager'
}

export function isStaff(user: User): boolean {
  return ['admin', 'manager', 'dealer', 'staff'].includes(user.role)
}

// JobPosting ???寃利?
export function isFixedPosting(posting: JobPosting): posting is FixedJobPosting {
  return posting.postingType === 'fixed' &&
    posting.fixedConfig !== undefined &&
    posting.fixedData !== undefined
}

export function isTournamentPosting(posting: JobPosting): boolean {
  return posting.postingType === 'tournament' &&
    posting.tournamentConfig !== undefined
}

export function isUrgentPosting(posting: JobPosting): boolean {
  return posting.postingType === 'urgent'
}

// Application ?곹깭 寃利?
export function isConfirmedApplication(app: Application): boolean {
  return app.status === 'confirmed'
}

export function isPendingApplication(app: Application): boolean {
  return app.status === 'applied' || app.status === 'pending'
}
```

---

## 4. 荑쇰━ ?⑦꽩

### 4.1 援ъ씤怨듦퀬 議고쉶

```typescript
// ?쒖꽦 怨듦퀬 紐⑸줉 (?섏씠吏?ㅼ씠??
const getActiveJobPostings = async (
  lastDoc?: QueryDocumentSnapshot,
  limit: number = 20
): Promise<{ postings: JobPosting[], lastDoc: QueryDocumentSnapshot | null }> => {
  let q = query(
    collection(db, 'jobPostings'),
    where('status', '==', 'open'),
    orderBy('createdAt', 'desc'),
    limit(limit)
  )

  if (lastDoc) {
    q = query(q, startAfter(lastDoc))
  }

  const snapshot = await getDocs(q)
  const postings = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as JobPosting[]

  return {
    postings,
    lastDoc: snapshot.docs[snapshot.docs.length - 1] || null
  }
}

// 吏??퀎 ?꾪꽣留?
const getPostingsByLocation = async (location: string): Promise<JobPosting[]> => {
  const q = query(
    collection(db, 'jobPostings'),
    where('status', '==', 'open'),
    where('location', '==', location),
    orderBy('createdAt', 'desc')
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as JobPosting[]
}

// ??怨듦퀬 議고쉶
const getMyPostings = async (userId: string): Promise<JobPosting[]> => {
  const q = query(
    collection(db, 'jobPostings'),
    where('createdBy', '==', userId),
    orderBy('createdAt', 'desc')
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as JobPosting[]
}
```

### 4.2 吏?먯꽌 議고쉶

```typescript
// ??吏??紐⑸줉
const getMyApplications = async (userId: string): Promise<Application[]> => {
  const q = query(
    collection(db, 'applications'),
    where('applicantId', '==', userId),
    orderBy('appliedAt', 'desc')
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Application[]
}

// 怨듦퀬蹂?吏?먯옄 紐⑸줉
const getApplicationsByPosting = async (eventId: string): Promise<Application[]> => {
  const q = query(
    collection(db, 'applications'),
    where('eventId', '==', eventId),
    orderBy('appliedAt', 'desc')
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Application[]
}

// ?곹깭蹂?吏?먯꽌 議고쉶
const getApplicationsByStatus = async (
  eventId: string,
  status: Application['status']
): Promise<Application[]> => {
  const q = query(
    collection(db, 'applications'),
    where('eventId', '==', eventId),
    where('status', '==', status),
    orderBy('appliedAt', 'desc')
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Application[]
}
```

### 4.3 洹쇰Т 湲곕줉 議고쉶

```typescript
// ?ㅽ깭?꾨퀎 洹쇰Т 湲곕줉
const getWorkLogsByStaff = async (
  staffId: string,
  dateRange?: { start: string, end: string }
): Promise<WorkLog[]> => {
  let q = query(
    collection(db, 'workLogs'),
    where('staffId', '==', staffId),
    orderBy('date', 'desc')
  )

  if (dateRange) {
    q = query(q,
      where('date', '>=', dateRange.start),
      where('date', '<=', dateRange.end)
    )
  }

  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as WorkLog[]
}

// ?좎쭨蹂?洹쇰Т 湲곕줉
const getWorkLogsByDate = async (date: string): Promise<WorkLog[]> => {
  const q = query(
    collection(db, 'workLogs'),
    where('date', '==', date),
    orderBy('scheduledStartTime', 'asc')
  )

  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as WorkLog[]
}
```

### 4.4 ?ㅼ떆媛?援щ룆

```typescript
// 怨듦퀬 ?ㅼ떆媛?援щ룆
const subscribeToJobPosting = (
  postingId: string,
  callback: (posting: JobPosting | null) => void
): () => void => {
  const docRef = doc(db, 'jobPostings', postingId)

  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      callback({ id: snapshot.id, ...snapshot.data() } as JobPosting)
    } else {
      callback(null)
    }
  }, (error) => {
    logger.error('JobPosting subscription error', error)
    callback(null)
  })
}

// ?뚮┝ ?ㅼ떆媛?援щ룆
const subscribeToNotifications = (
  userId: string,
  callback: (notifications: Notification[]) => void
): () => void => {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(50)
  )

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Notification[]
    callback(notifications)
  }, (error) => {
    logger.error('Notifications subscription error', error)
    callback([])
  })
}
```

---

## 5. ?몃뜳???ㅼ젙

### 5.1 蹂듯빀 ?몃뜳??(firestore.indexes.json)

```json
{
  "indexes": [
    {
      "collectionGroup": "jobPostings",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "jobPostings",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "location", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "jobPostings",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "createdBy", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "applications",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "applicantId", "order": "ASCENDING" },
        { "fieldPath": "appliedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "applications",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "eventId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "appliedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "workLogs",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "staffId", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "notifications",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

---

## 6. 蹂댁븞 洹쒖튃

### 6.1 Firestore 蹂댁븞 洹쒖튃

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ?ы띁 ?⑥닔
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    function isAdmin() {
      return isAuthenticated() &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    function isManagerOrAdmin() {
      let role = get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
      return isAuthenticated() && (role == 'admin' || role == 'manager');
    }

    // users 而щ젆??
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if isOwner(userId);
      allow update: if isOwner(userId) || isAdmin();
      allow delete: if isAdmin();
    }

    // staff 而щ젆??
    match /staff/{staffId} {
      allow read: if isAuthenticated();
      allow write: if isManagerOrAdmin();

      // QR 肄붾뱶 ?쒕툕而щ젆??
      match /qrCodes/{qrId} {
        allow read: if isAuthenticated();
        allow write: if isManagerOrAdmin();
      }
    }

    // jobPostings 而щ젆??
    match /jobPostings/{postingId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() &&
        request.resource.data.createdBy == request.auth.uid;
      allow update: if isAuthenticated() &&
        (resource.data.createdBy == request.auth.uid || isAdmin());
      allow delete: if isAdmin();
    }

    // applications 而щ젆??
    match /applications/{applicationId} {
      allow read: if isAuthenticated() &&
        (resource.data.applicantId == request.auth.uid ||
         isManagerOrAdmin());
      allow create: if isAuthenticated() &&
        request.resource.data.applicantId == request.auth.uid;
      allow update: if isAuthenticated() &&
        (resource.data.applicantId == request.auth.uid ||
         isManagerOrAdmin());
      allow delete: if isAdmin();
    }

    // workLogs 而щ젆??
    match /workLogs/{workLogId} {
      allow read: if isAuthenticated();
      allow write: if isManagerOrAdmin();
    }

    // attendanceRecords 而щ젆??
    match /attendanceRecords/{recordId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update: if isAuthenticated() &&
        (resource.data.staffId == request.auth.uid ||
         isManagerOrAdmin());
      allow delete: if isAdmin();
    }

    // notifications 而щ젆??
    match /notifications/{notificationId} {
      allow read: if isAuthenticated() &&
        resource.data.userId == request.auth.uid;
      allow create: if isAuthenticated();
      allow update: if isAuthenticated() &&
        resource.data.userId == request.auth.uid;
      allow delete: if isOwner(resource.data.userId);
    }

    // payments 而щ젆??
    match /payments/{paymentId} {
      allow read: if isAuthenticated() &&
        (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() &&
        request.resource.data.userId == request.auth.uid;
      allow update: if isAdmin();
      allow delete: if false; // 寃곗젣 湲곕줉? ??젣 遺덇?
    }

    // inquiries 而щ젆??
    match /inquiries/{inquiryId} {
      allow read: if isAuthenticated() &&
        (resource.data.userId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() &&
        request.resource.data.userId == request.auth.uid;
      allow update: if isAuthenticated() &&
        (resource.data.userId == request.auth.uid || isAdmin());
      allow delete: if isAdmin();
    }
  }
}
```

---

## 7. API ?붾뱶?ъ씤??

### 7.1 Cloud Functions

```typescript
// functions/src/index.ts

// === ?몄떆 ?뚮┝ ===

// 吏?먯꽌 ?뺤젙 ?뚮┝
export const onApplicationConfirmed = functions.firestore
  .document('applications/{applicationId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data()
    const after = change.after.data()

    // ?곹깭媛 confirmed濡?蹂寃쎈맂 寃쎌슦
    if (before.status !== 'confirmed' && after.status === 'confirmed') {
      await sendPushNotification({
        userId: after.applicantId,
        title: '吏???뺤젙!',
        body: `${after.postTitle} 怨듦퀬???뺤젙?섏뿀?듬땲??`,
        data: {
          type: 'confirmation',
          applicationId: context.params.applicationId,
          eventId: after.eventId,
        }
      })
    }
  })

// ??吏???뚮┝ (援ъ씤?먯뿉寃?
export const onNewApplication = functions.firestore
  .document('applications/{applicationId}')
  .onCreate(async (snapshot, context) => {
    const application = snapshot.data()

    // 怨듦퀬 ?묒꽦??議고쉶
    const postingDoc = await admin.firestore()
      .collection('jobPostings')
      .doc(application.eventId)
      .get()

    if (postingDoc.exists) {
      const posting = postingDoc.data()
      await sendPushNotification({
        userId: posting.createdBy,
        title: '??吏?먯옄!',
        body: `${application.applicantName}?섏씠 吏?먰뻽?듬땲??`,
        data: {
          type: 'application',
          applicationId: context.params.applicationId,
          eventId: application.eventId,
        }
      })
    }
  })

// === RevenueCat ?뱁썒 ===

// RevenueCat 寃곗젣 ?뱁썒 泥섎━
export const handleRevenueCatWebhook = functions.https.onRequest(async (req, res) => {
  // ?쒕챸 寃利?
  const signature = req.headers['x-revenuecat-signature']
  if (!verifyRevenueCatSignature(req.body, signature)) {
    res.status(401).send('Invalid signature')
    return
  }

  const event = req.body
  const userId = event.app_user_id

  try {
    switch (event.type) {
      case 'INITIAL_PURCHASE':
      case 'NON_RENEWING_PURCHASE':
        await handleDiamondPurchase(userId, event)
        break

      case 'REFUND':
        await handleRefund(userId, event)
        break

      default:
        logger.info('Unhandled RevenueCat event', { type: event.type })
    }

    res.status(200).send('OK')
  } catch (error) {
    logger.error('RevenueCat webhook error', { error })
    res.status(500).send('Internal error')
  }
})

// ?ㅼ씠??異⑹쟾 泥섎━
async function handleDiamondPurchase(userId: string, event: any) {
  const productId = event.product_id
  const transactionId = event.transaction_id
  const store = event.store as 'app_store' | 'play_store'

  // ?⑦궎吏蹂??ㅼ씠???섎웾 留ㅽ븨
  const packages: Record<string, { diamonds: number; bonus: number }> = {
    'com.uniqn.diamond.starter': { diamonds: 3, bonus: 0 },
    'com.uniqn.diamond.basic': { diamonds: 8, bonus: 3 },
    'com.uniqn.diamond.popular': { diamonds: 30, bonus: 10 },
    'com.uniqn.diamond.premium': { diamonds: 333, bonus: 67 },
  }

  const pkg = packages[productId]
  if (!pkg) {
    throw new Error(`Unknown product: ${productId}`)
  }

  const totalDiamonds = pkg.diamonds + pkg.bonus

  await admin.firestore().runTransaction(async (transaction) => {
    const userRef = admin.firestore().collection('users').doc(userId)
    const userDoc = await transaction.get(userRef)

    if (!userDoc.exists) {
      throw new Error('User not found')
    }

    const currentDiamonds = userDoc.data()?.points?.diamonds || 0

    // ?ㅼ씠??吏湲?
    transaction.update(userRef, {
      'points.diamonds': currentDiamonds + totalDiamonds,
      'points.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
    })

    // 援щℓ 湲곕줉 ???
    const purchaseRef = admin.firestore().collection('purchases').doc()
    transaction.set(purchaseRef, {
      userId,
      packageId: productId.split('.').pop(),
      diamonds: pkg.diamonds,
      bonusDiamonds: pkg.bonus,
      totalDiamonds,
      revenueCatTransactionId: transactionId,
      store,
      productId,
      status: 'completed',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
  })
}

// === ?ㅼ?以??⑥닔 ===

// 留뚮즺??怨좎젙 怨듦퀬 ?먮룞 醫낅즺
export const expireFixedPostings = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now()

    const expiredPostings = await admin.firestore()
      .collection('jobPostings')
      .where('postingType', '==', 'fixed')
      .where('status', '==', 'open')
      .where('fixedConfig.expiresAt', '<=', now)
      .get()

    const batch = admin.firestore().batch()

    expiredPostings.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: 'closed',
        statusChangeReason: '湲곌컙 留뚮즺',
        statusChangedAt: now,
      })
    })

    await batch.commit()
    console.log(`${expiredPostings.size} postings expired`)
  })
```

---

## 8. ?먮윭 肄붾뱶

### 8.1 ?먮윭 肄붾뱶 ?뺤쓽

```typescript
// src/lib/errors/codes.ts

export const ErrorCodes = {
  // === ?몄쬆 (1xxx) ===
  AUTH_INVALID_CREDENTIALS: 'E1001',
  AUTH_SESSION_EXPIRED: 'E1002',
  AUTH_UNAUTHORIZED: 'E1003',
  AUTH_EMAIL_NOT_VERIFIED: 'E1004',
  AUTH_ACCOUNT_DISABLED: 'E1005',

  // === 寃利?(2xxx) ===
  VALIDATION_REQUIRED_FIELD: 'E2001',
  VALIDATION_INVALID_FORMAT: 'E2002',
  VALIDATION_MIN_LENGTH: 'E2003',
  VALIDATION_MAX_LENGTH: 'E2004',
  VALIDATION_XSS_DETECTED: 'E2005',

  // === 鍮꾩쫰?덉뒪 濡쒖쭅 (3xxx) ===
  BUSINESS_ALREADY_APPLIED: 'E3002',
  BUSINESS_POSTING_CLOSED: 'E3003',
  BUSINESS_APPLICATION_NOT_FOUND: 'E3004',
  BUSINESS_STAFF_NOT_FOUND: 'E3005',

  // === 寃곗젣 (4xxx) ===
  PAYMENT_FAILED: 'E4001',
  PAYMENT_CANCELLED: 'E4002',
  PAYMENT_REFUND_FAILED: 'E4003',
  PAYMENT_INVALID_AMOUNT: 'E4004',

  // === Firebase (5xxx) ===
  FIREBASE_PERMISSION_DENIED: 'E5001',
  FIREBASE_NOT_FOUND: 'E5002',
  FIREBASE_QUOTA_EXCEEDED: 'E5003',
  FIREBASE_NETWORK_ERROR: 'E5004',

  // === 蹂댁븞 (6xxx) ===
  SECURITY_INTEGRITY_FAILED: 'E6001',
  SECURITY_CERTIFICATE_INVALID: 'E6002',
  SECURITY_RATE_LIMIT: 'E6003',

  // === ?ㅽ듃?뚰겕 (7xxx) ===
  NETWORK_OFFLINE: 'E7001',
  NETWORK_TIMEOUT: 'E7002',
  NETWORK_SERVER_ERROR: 'E7003',

  // === ?????놁쓬 (9xxx) ===
  UNKNOWN: 'E9999',
} as const

// ?먮윭 硫붿떆吏 留ㅽ븨
export const ErrorMessages: Record<string, string> = {
  [ErrorCodes.AUTH_INVALID_CREDENTIALS]: '?대찓???먮뒗 鍮꾨?踰덊샇媛 ?щ컮瑜댁? ?딆뒿?덈떎',
  [ErrorCodes.AUTH_SESSION_EXPIRED]: '?몄뀡??留뚮즺?섏뿀?듬땲?? ?ㅼ떆 濡쒓렇?명빐二쇱꽭??,
  [ErrorCodes.AUTH_UNAUTHORIZED]: '?묎렐 沅뚰븳???놁뒿?덈떎',
  [ErrorCodes.AUTH_EMAIL_NOT_VERIFIED]: '蹂몄씤?몄쬆???꾩슂?⑸땲??,  // ?대???蹂몄씤?몄쬆
  [ErrorCodes.AUTH_ACCOUNT_DISABLED]: '怨꾩젙??鍮꾪솢?깊솕?섏뿀?듬땲??,

  [ErrorCodes.VALIDATION_REQUIRED_FIELD]: '?꾩닔 ??ぉ???낅젰?댁＜?몄슂',
  [ErrorCodes.VALIDATION_INVALID_FORMAT]: '?щ컮瑜??뺤떇?쇰줈 ?낅젰?댁＜?몄슂',
  [ErrorCodes.VALIDATION_XSS_DETECTED]: '?덉슜?섏? ?딅뒗 臾몄옄媛 ?ы븿?섏뼱 ?덉뒿?덈떎',

  [ErrorCodes.BUSINESS_ALREADY_APPLIED]: '?대? 吏?먰븳 怨듦퀬?낅땲??,
  [ErrorCodes.BUSINESS_POSTING_CLOSED]: '留덇컧??怨듦퀬?낅땲??,
  [ErrorCodes.BUSINESS_APPLICATION_NOT_FOUND]: '吏?먯꽌瑜?李얠쓣 ???놁뒿?덈떎',

  [ErrorCodes.PAYMENT_FAILED]: '寃곗젣???ㅽ뙣?덉뒿?덈떎',
  [ErrorCodes.PAYMENT_CANCELLED]: '寃곗젣媛 痍⑥냼?섏뿀?듬땲??,

  [ErrorCodes.FIREBASE_PERMISSION_DENIED]: '?묎렐 沅뚰븳???놁뒿?덈떎',
  [ErrorCodes.FIREBASE_NOT_FOUND]: '?붿껌???곗씠?곕? 李얠쓣 ???놁뒿?덈떎',

  [ErrorCodes.SECURITY_INTEGRITY_FAILED]: '蹂댁븞 寃利앹뿉 ?ㅽ뙣?덉뒿?덈떎',
  [ErrorCodes.SECURITY_RATE_LIMIT]: '?붿껌???덈Т 留롮뒿?덈떎. ?좎떆 ???ㅼ떆 ?쒕룄?댁＜?몄슂',

  [ErrorCodes.NETWORK_OFFLINE]: '?명꽣???곌껐???뺤씤?댁＜?몄슂',
  [ErrorCodes.NETWORK_TIMEOUT]: '?붿껌 ?쒓컙??珥덇낵?섏뿀?듬땲??,

  [ErrorCodes.UNKNOWN]: '臾몄젣媛 諛쒖깮?덉뒿?덈떎. ?좎떆 ???ㅼ떆 ?쒕룄?댁＜?몄슂',
}
```

---

## ?붿빟

### ?듭떖 而щ젆??愿怨꾨룄

```
users (1)
  ?쒋??? applications (N) ???? jobPostings (1)
  ??        ??
  ??        ?붴??? confirmationHistory (諛곗뿴)
  ??        ?붴??? cancellationRequest (媛앹껜)
  ??
  ?쒋??? workLogs (N)
  ??        ?붴??? settlementBreakdown (罹먯떛)
  ??
  ?쒋??? notifications (N)
  ??
  ?쒋??? purchases (N)
  ??
  ?쒋??? heartBatches (?쒕툕而щ젆??
  ??
  ?쒋??? pointTransactions (?쒕툕而щ젆??
  ??
  ?쒋??? inquiries (N)
  ??
  ?붴??? reports (N)

eventQRCodes (N) ???? jobPostings (1)
```

### ?쒖? ?꾨뱶 洹쒖튃

| ?꾨뱶 | ???| ?ㅻ챸 |
|------|------|------|
| `id` | string | 臾몄꽌 怨좎쑀 ID |
| `userId` | string | ?ъ슜??李몄“ |
| `jobPostingId` | string | 怨듦퀬 李몄“ (?쒖?) |
| `applicantId` | string | 吏?먯옄 李몄“ |
| `createdAt` | Timestamp | ?앹꽦 ?쒓컙 |
| `updatedAt` | Timestamp | ?섏젙 ?쒓컙 |
| `status` | string | ?곹깭 enum |

> **Note**: `eventId`, `postId`, `staffId`???덇굅???꾨뱶濡? `jobPostingId`, `userId`濡??듯빀 以?

---

## 9. ?쒕퉬???덉씠??援ъ“

### 9.1 Core ?쒕퉬??(7媛?

| ?쒕퉬??| ?뚯씪 | 二쇱슂 湲곕뒫 |
|--------|------|----------|
| **authService** | `authService.ts` | 濡쒓렇?? ?뚯썝媛?? ?뚯뀥 濡쒓렇?? ?꾨줈??愿由?|
| **jobService** | `jobService.ts` | 怨듦퀬 紐⑸줉, 寃?? ?꾪꽣, ?곸꽭 議고쉶 |
| **applicationService** | `applicationService.ts` | 吏?? 痍⑥냼 ?붿껌, 吏???댁뿭 議고쉶 |
| **workLogService** | `workLogService.ts` | 洹쇰Т 湲곕줉 議고쉶, ?ㅼ떆媛?援щ룆 |
| **scheduleService** | `scheduleService.ts` | ?ㅼ?以?議고쉶, 洹몃９?? 罹섎┛??酉?|
| **notificationService** | `notificationService.ts` | ?뚮┝ 議고쉶, ?쎌쓬 泥섎━, ?ㅼ떆媛?援щ룆 |
| **reportService** | `reportService.ts` | ?묐갑???좉퀬 (?ㅽ깭?꾟넄援ъ씤?? |

### 9.2 Employer ?쒕퉬??(6媛?

| ?쒕퉬??| ?뚯씪 | 二쇱슂 湲곕뒫 |
|--------|------|----------|
| **jobManagementService** | `jobManagementService.ts` | 怨듦퀬 CRUD, ?곹깭 愿由?|
| **applicantManagementService** | `applicantManagementService.ts` | 吏?먯옄 ?뺤젙/嫄곗젅, ?湲곗옄 愿由?|
| **applicationHistoryService** | `applicationHistoryService.ts` | ?뺤젙/痍⑥냼 ?대젰 異붿쟻, WorkLog ?곕룞 |
| **confirmedStaffService** | `confirmedStaffService.ts` | ?뺤젙 ?ㅽ깭??愿由? ??븷 蹂寃?|
| **settlementService** | `settlement/*.ts` | ?뺤궛 怨꾩궛, 泥섎━ (遺꾪븷 援ъ“) |
| **applicantConversionService** | `applicantConversionService.ts` | 吏?먯옄?믪뒪?쒗봽 蹂??|

### 9.3 Admin ?쒕퉬??(4媛?

| ?쒕퉬??| ?뚯씪 | 二쇱슂 湲곕뒫 |
|--------|------|----------|
| **adminService** | `adminService.ts` | ??쒕낫???듦퀎, ?ъ슜??愿由?|
| **announcementService** | `announcementService.ts` | 怨듭??ы빆 CRUD, 諛쒗뻾 愿由?|
| **tournamentApprovalService** | `tournamentApprovalService.ts` | ??뚭났怨??뱀씤/嫄곗젅 |
| **inquiryService** | `inquiryService.ts` | 臾몄쓽 愿由? FAQ |

### 9.4 Infrastructure ?쒕퉬??(17媛?

| ?쒕퉬??| ?뚯씪 | 二쇱슂 湲곕뒫 |
|--------|------|----------|
| **pushNotificationService** | `pushNotificationService.ts` | FCM ?좏겙 愿由? 沅뚰븳 ?붿껌 |
| **eventQRService** | `eventQRService.ts` | QR ?앹꽦/寃利?(3遺??좏슚) |
| **deepLinkService** | `deepLinkService.ts` | ?λ쭅???쇱슦??|
| **analyticsService** | `analyticsService.ts` | ?대깽??異붿쟻 |
| **crashlyticsService** | `crashlyticsService.ts` | ?먮윭 濡쒓퉭 |
| **performanceService** | `performanceService.ts` | ?깅뒫 紐⑤땲?곕쭅 |
| **sessionService** | `sessionService.ts` | ?몄뀡 愿由? ?좏겙 媛깆떊 |
| **storageService** | `storageService.ts` | ?대?吏 ?낅줈??|
| **biometricService** | `biometricService.ts` | ?앹껜?몄쬆 |
| **featureFlagService** | `featureFlagService.ts` | 湲곕뒫 ?뚮옒洹?|
| **inAppMessageService** | `inAppMessageService.ts` | ?몄빋 硫붿떆吏 |
| **cacheService** | `cacheService.ts` | 罹먯떆 愿由?|
| **versionService** | `versionService.ts` | ??踰꾩쟾 泥댄겕 |
| **templateService** | `templateService.ts` | 怨듦퀬 ?쒗뵆由?|
| **accountDeletionService** | `accountDeletionService.ts` | 怨꾩젙 ??젣 |
| **tokenRefreshService** | `tokenRefreshService.ts` | ?좏겙 ?먮룞 媛깆떊 |
| **searchService** | `searchService.ts` | ?대씪?댁뼵???ъ씠??寃??|

---

## 10. ???덉씠??援ъ“ (46媛?

### 10.1 ?몄쬆/沅뚰븳 (6媛?

| ??| ?⑸룄 |
|----|------|
| `useAuth` | ?몄쬆 ?곹깭 ?듯빀 ?섑띁 |
| `useAuthGuard` | ?쇱슦??沅뚰븳 蹂댄샇 |
| `useAutoLogin` | ?먮룞 濡쒓렇??|
| `useBiometricAuth` | ?앹껜?몄쬆 |
| `useOnboarding` | ?⑤낫???곹깭 |
| `useAppInitialize` | ??珥덇린??|

### 10.2 怨듦퀬/吏??(9媛?

| ??| ?⑸룄 |
|----|------|
| `useJobPostings` | 臾댄븳?ㅽ겕濡?怨듦퀬 紐⑸줉 |
| `useJobDetail` | 怨듦퀬 ?곸꽭 |
| `useJobManagement` | 怨듦퀬 CRUD (援ъ씤?먯슜) |
| `useJobRoles` | ??븷 ?뺣낫 ?뺢퇋??|
| `useJobSchedule` | ?쇱젙 ?뺣낫 ?뺢퇋??|
| `useApplications` | 吏???쒖텧/痍⑥냼 |
| `useAssignmentSelection` | 諛곗젙 ?좏깮 愿由?|
| `useBookmarks` | 遺곷쭏??愿由?|
| `usePostingTypeCounts` | ??낅퀎 怨듦퀬 媛쒖닔 |

### 10.3 ?ㅼ?以?洹쇰Т (4媛?

| ??| ?⑸룄 |
|----|------|
| `useSchedules` | ?ㅼ?以?議고쉶/罹섎┛??|
| `useWorkLogs` | 洹쇰Т 湲곕줉 議고쉶 |
| `useQRCode` | QR ?ㅼ틪/?쒖떆 |
| `useEventQR` | ?꾩옣 QR 愿由?(援ъ씤?먯슜) |

### 10.4 ?뺤궛/援ъ씤??(8媛?

| ??| ?⑸룄 |
|----|------|
| `useSettlement` | ?뺤궛 議고쉶/泥섎━ |
| `useSettlementDateNavigation` | ?뺤궛 ?좎쭨 ?ㅻ퉬寃뚯씠??|
| `useConfirmedStaff` | ?뺤젙 ?ㅽ깭??愿由?|
| `useApplicantsByJobPosting` | 怨듦퀬蹂?吏?먯옄 議고쉶 |
| `useApplicantMutations` | 吏?먯옄 愿由?裕ㅽ뀒?댁뀡 |
| `useCancellationManagement` | 痍⑥냼 ?붿껌 愿由?|
| `useStaffConversion` | ?ㅽ깭??蹂??|
| `useTemplateManager` | ?쒗뵆由?愿由?|

### 10.5 ?뚮┝ (3媛?

| ??| ?⑸룄 |
|----|------|
| `useNotifications` | ?뚮┝ 議고쉶/?쎌쓬/??젣 |
| `useNotificationHandler` | ?듯빀 ?뚮┝ ?몃뱾??|
| `useDeepLink` | ?λ쭅??泥섎━ |

### 10.6 愿由ъ옄 (4媛?

| ??| ?⑸룄 |
|----|------|
| `useAdminDashboard` | 愿由ъ옄 ??쒕낫??|
| `useAdminReports` | ?좉퀬 愿由?|
| `useAnnouncement` | 怨듭??ы빆 愿由?|
| `useTournamentApproval` | ??뚭났怨??뱀씤 |

### 10.7 ?명봽??(8媛?

| ??| ?⑸룄 |
|----|------|
| `useNetworkStatus` | ?ㅽ듃?뚰겕 ?곹깭 媛먯? |
| `useNavigationTracking` | Analytics 異붿쟻 |
| `useFeatureFlag` | 湲곕뒫 ?뚮옒洹?|
| `useVersionCheck` | ??踰꾩쟾 泥댄겕 |
| `useRealtimeQuery` | Firestore ?ㅼ떆媛?援щ룆 |
| `useAllowances` | ?섎떦 愿由?|
| `useInquiry` | 臾몄쓽 愿由?|
| `useClearCache` | 罹먯떆 ??젣 |

---

## 愿??臾몄꽌

- [00-overview.md](./00-overview.md) - ?꾨줈?앺듃 媛쒖슂
- [06-firebase.md](./06-firebase.md) - Firebase ?곕룞 ?꾨왂
- [12-security.md](./12-security.md) - 蹂댁븞 ?ㅺ퀎
- [22-migration-mapping.md](./22-migration-mapping.md) - 留덉씠洹몃젅?댁뀡 留ㅽ븨

---

*留덉?留??낅뜲?댄듃: 2026-02-02*

