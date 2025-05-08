import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import { createRequestHandler } from "react-router";
import * as schema from "../database/schema";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
    db: DrizzleD1Database<typeof schema>;
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

export default {
  async fetch(request, env, ctx) {
    const db = drizzle(env.DB, { schema });
    // Extract the Cloudflare Access JWT from the request headers
    const accessJwt = request.headers.get("CF-Access-JWT-Assertion");
    let userId = null;

    if (accessJwt) {
      try {
        // If your JWT is structured differently, adjust this accordingly
        // This assumes the JWT payload contains an 'email' field
        const payload = JSON.parse(atob(accessJwt.split(".")[1]));
        userId = payload.email || payload.sub || null;
      } catch (error) {
        console.error("Error parsing Cloudflare Access JWT:", error);
      }
    }

    return requestHandler(request, {
      cloudflare: { env, ctx },
      db,
      userId, // Pass the userId to the request context
    });
  },
} satisfies ExportedHandler<Env>;
