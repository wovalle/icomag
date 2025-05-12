import { createClerkClient } from "@clerk/react-router/api.server";
import { getAuth } from "@clerk/react-router/ssr.server";
import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import { createRequestHandler } from "react-router";
import * as schema from "../database/schema";

interface Env extends Cloudflare.Env {
  VITE_CLERK_PUBLISHABLE_KEY: string;
}

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
    db: DrizzleD1Database<typeof schema>;
    getCurrentUser: (loaderArgs: any) => Promise<{
      email: string | null;
      isAdmin: boolean;
      id: string;
      firstName: string | null;
      lastName: string | null;
    }>;
    assertAdminUser: (loaderArgs: any) => Promise<void>;
    assertLoggedInUser: (loaderArgs: any) => Promise<void>;
  }
}

// List of admin emails
const ADMIN_EMAILS = ["hey@willy.im"];

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

export default {
  async fetch(request, env, ctx) {
    const db = drizzle(env.DB, { schema });

    const getCurrentUser = async (args: any) => {
      const auth = await getAuth(args);

      const user = await createClerkClient({
        secretKey: process.env.CLERK_SECRET_KEY,
      }).users.getUser(auth.userId ?? "");

      return {
        email: user.primaryEmailAddress?.id ?? null,
        isAdmin: ADMIN_EMAILS.includes(
          user.primaryEmailAddress?.emailAddress || ""
        ),
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName ?? null,
      };
    };

    const assertAdminUser = async (args: any) => {
      let result: Response | null = null;

      try {
        const user = await getCurrentUser(args);

        if (!user.email) {
          result = new Response("Unauthorized: You must be logged in", {
            status: 401,
            headers: { "Content-Type": "text/plain" },
          });
        }

        if (!user.isAdmin) {
          result = new Response("Forbidden: Admin access required", {
            status: 403,
            headers: { "Content-Type": "text/plain" },
          });
        }
      } catch (error) {
        console.error("Error getting current user:", error);
        result = new Response("Unauthorized: You must be logged in", {
          status: 401,
          headers: { "Content-Type": "text/plain" },
        });
      }

      console.log(result);

      if (result) {
        throw result;
      }
    };

    const assertLoggedInUser = async (args: any) => {
      let result: Response | null = null;
      try {
        const user = await getCurrentUser(args);

        if (!user.email) {
          result = new Response("Unauthorized: You must be logged in", {
            status: 401,
            headers: { "Content-Type": "text/plain" },
          });
        }
      } catch (error) {
        console.error("Error getting current user:", error);
        result = new Response("Unauthorized: You must be logged in", {
          status: 401,
          headers: { "Content-Type": "text/plain" },
        });
      }

      if (result) {
        throw result;
      }
    };

    return requestHandler(request, {
      cloudflare: { env, ctx },
      db,
      getCurrentUser,
      assertAdminUser,
      assertLoggedInUser,
    });
  },
} satisfies ExportedHandler<Env>;
