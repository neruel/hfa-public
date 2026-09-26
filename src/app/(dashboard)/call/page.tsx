// src/app/(dashboard)/call/page.tsx
import { ContactCard } from "@/components/ContactCard";

export const metadata = {
  title: "연락처 안내",
  description: "공개 데모용 연락처 안내",
};

export default function CallPage() {
  return <ContactCard />;
}
