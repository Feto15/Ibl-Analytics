import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { hashPassword } from "better-auth/crypto";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), "..", ".env"));

const email = process.argv[2] || "feldi@test.com";
const password = process.argv[3] || "feldi123";
const name = process.argv[4] || "Feldi";

const databaseUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL missing. Put it in dashboard/.env.local or root .env");
  process.exit(1);
}

const sql = neon(databaseUrl);const userId = randomUUID();
const accountId = randomUUID();
const hashed = await hashPassword(password);

await sql`
  insert into "user" (id, name, email, email_verified, created_at, updated_at)
  values (${userId}, ${name}, ${email}, true, now(), now())
  on conflict (email) do update set
    name = excluded.name,
    updated_at = now()
`;

const users = await sql`select id from "user" where email = ${email} limit 1`;
const finalUserId = users[0].id;

await sql`delete from "account" where user_id = ${finalUserId} and provider_id = 'credential'`;

await sql`
  insert into "account" (
    id, account_id, provider_id, user_id, password, created_at, updated_at
  ) values (
    ${accountId}, ${finalUserId}, 'credential', ${finalUserId}, ${hashed}, now(), now()
  )
`;

console.log(`Seeded user ${email} / ${password}`);
