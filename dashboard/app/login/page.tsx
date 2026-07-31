import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Trophy } from "lucide-react";

import { LoginForm } from "@/components/auth/login-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { auth } from "@/lib/auth";

export default async function LoginPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session) {
    redirect("/");
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center bg-background px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Trophy className="size-5" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">IBL Analytic</h1>
            <p className="text-sm text-muted-foreground">
              Login untuk mengakses dashboard
            </p>
          </div>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
