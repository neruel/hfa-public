// src/app/(dashboard)/admin/page.tsx
import { AdminDashboard } from "@/components/AdminDashboard";

export const metadata = {
  title: "관리자",
};

export default function AdminPage() {
  return <AdminDashboard />;
}
