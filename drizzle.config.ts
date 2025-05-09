import type { Config } from "drizzle-kit";

export default {
  out: "./drizzle",
  schema: "./database/schema.ts",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    databaseId: "9ceabb1d-70c0-4dfc-9031-45bde427eab7",
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    token: process.env.CLOUDFLARE_TOKEN!,
  },
} satisfies Config;
