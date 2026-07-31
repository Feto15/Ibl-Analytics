import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { auth } from "@/lib/auth";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return <AppShell user={session.user}>{children}</AppShell>;
}
