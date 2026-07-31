import type { Config } from "drizzle-kit";

export default {
  schema: ["./lib/db/schema.ts", "./lib/db/auth-schema.ts"],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL || "",
  },
  strict: true,
  verbose: true,
} satisfies Config;
