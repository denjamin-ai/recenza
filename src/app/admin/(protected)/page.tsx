import { redirect } from "next/navigation";

// /admin → дашборд (экраны — отдельные route-сегменты под (protected)).
export default function AdminIndexPage() {
  redirect("/admin/dashboard");
}
