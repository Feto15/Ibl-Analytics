import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// SSR-first dashboard: no R2/D1 cache bindings required for a first deploy.
// Add incremental cache later if ISR/on-demand revalidation is needed.
export default defineCloudflareConfig();
