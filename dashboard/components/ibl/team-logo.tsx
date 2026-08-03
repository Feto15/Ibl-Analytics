"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface TeamLogoProps {
  code?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}

const LOGO_MAP: Record<string, string> = {
  BHB: "/teams/BHB.png",
  BBC: "/teams/BHB.png",
  DUB: "/teams/DUB.png",
  HTJ: "/teams/HTJ.png",
  THJ: "/teams/HTJ.png",
  KBS: "/teams/KBS.png",
  PCF: "/teams/PCF.png",
  PCCF: "/teams/PCF.png",
  PJB: "/teams/PJB.png",
  RJM: "/teams/RJM.png",
  RJN: "/teams/RJM.png",
  RSB: "/teams/RSB.png",
  SMP: "/teams/SMP.png",
  SWS: "/teams/SWS.png",
  THB: "/teams/THB.png",
};

export function TeamLogo({ code, name, size = 28, className }: TeamLogoProps) {
  const [hasError, setHasError] = useState(false);
  const normalizedCode = code?.trim().toUpperCase() ?? "";
  const src = LOGO_MAP[normalizedCode];

  if (!src || hasError) {
    return (
      <div
        style={{ width: size, height: size }}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md bg-muted font-mono text-xs font-bold text-muted-foreground shadow-xs select-none",
          className
        )}
        title={name || code || "Team"}
      >
        {normalizedCode.slice(0, 3) || "?"}
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className={cn("relative shrink-0 overflow-hidden", className)}
    >
      <Image
        src={src}
        alt={name || code || "Team logo"}
        width={size}
        height={size}
        className="h-full w-full object-contain"
        onError={() => setHasError(true)}
        unoptimized
      />
    </div>
  );
}
