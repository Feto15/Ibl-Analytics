"use client";

import { ErrorState } from "@/components/ibl/states";

export default function ErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="p-6">
      <ErrorState message={error.message || "Terjadi kesalahan."} onRetry={reset} />
    </div>
  );
}
