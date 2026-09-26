import { Bot, Phone, ShieldCheck, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; shortLabel: string; description: string; icon: LucideIcon };

export const navItems: NavItem[] = [
  { href: "/chat", label: "AI 상담", shortLabel: "상담", description: "관리규약·생활 FAQ 기반 답변", icon: Bot },
  { href: "/call", label: "연락처 안내", shortLabel: "연락처", description: "공개 데모 연락처 안내", icon: Phone },
  { href: "/admin", label: "관리자", shortLabel: "관리", description: "문서 업로드·색인 관리", icon: ShieldCheck },
];

// Pages reachable by URL but not shown in the sidebar; used only for the header title.
export const hiddenPages: Pick<NavItem, "href" | "label" | "description">[] = [
  { href: "/search", label: "문서 검색", description: "관리규정·안내문 의미 기반 검색" },
];

export const APP_VERSION = "5.0.3";

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
