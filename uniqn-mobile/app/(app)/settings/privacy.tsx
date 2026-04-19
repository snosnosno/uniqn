/**
 * UNIQN Mobile - Privacy Policy Screen
 * 개인정보처리방침 화면 (한국 개인정보보호법 제30조 준수)
 * 본문: src/constants/legal/privacyPolicy.ts (단일 소스)
 */

import { LegalDocumentView } from '@/components/legal/LegalDocumentView';
import { PRIVACY_POLICY } from '@/constants/legal';

export default function PrivacyScreen() {
  return <LegalDocumentView document={PRIVACY_POLICY} headerTitle="개인정보처리방침" />;
}
