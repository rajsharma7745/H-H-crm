import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Real, DB-backed check (unlike proxy.ts, which only sees cookie presence)
  // so a stale/invalid session cookie can't bounce back and forth with the
  // protected-route guard and loop forever.
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return <div className="min-h-svh w-full">{children}</div>;
}
