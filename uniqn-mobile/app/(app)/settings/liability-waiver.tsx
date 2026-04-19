/**
 * UNIQN Mobile - Liability Waiver Screen
 * 서약서 (면책 동의) 화면
 * 본문: src/constants/legal/liabilityWaiver.ts (단일 소스)
 */

import { LegalDocumentView } from '@/components/legal/LegalDocumentView';
import { LIABILITY_WAIVER } from '@/constants/legal';

export default function LiabilityWaiverScreen() {
  return (
    <LegalDocumentView
      document={LIABILITY_WAIVER}
      headerTitle="서약서"
      prologueTone="warning"
      epilogueTone="error"
    />
  );
}
