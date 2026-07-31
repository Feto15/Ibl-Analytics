import "server-only";
import { unstable_cache } from "next/cache";

// Preserve the wrapped function's argument and return types so page loaders
// do not collapse to Promise<unknown>.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function cached<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyParts: string[],
  revalidateSeconds = 3600
): T {
  return unstable_cache(fn, keyParts, {
    revalidate: revalidateSeconds,
    tags: keyParts,
  }) as T;
}
