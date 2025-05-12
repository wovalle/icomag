import { defineConfig } from "drizzle-kit";

const remoteD1Config = defineConfig({
  out: "./drizzle",
  schema: "./database/schema.ts",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    databaseId: "9ceabb1d-70c0-4dfc-9031-45bde427eab7",
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    token: process.env.CLOUDFLARE_TOKEN!,
  },
});

const localD1Config = defineConfig({
  dialect: "sqlite",
  out: "drizzle",
  schema: "./database/schema.ts",
  dbCredentials: {
    url: ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/f9c1d4d1788f5e43aa49cadbfa3b49af1aac79b53c23a96a309ca25f680ad294.sqlite",
  },
});

export default process.env.CLOUDFLARE_DATABASE_ID
  ? remoteD1Config
  : localD1Config;
