import { createClerkClient } from "@clerk/react-router/api.server";
import { getAuth } from "@clerk/react-router/ssr.server";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import {
  createRequestHandler,
  redirect,
  type LoaderFunctionArgs,
} from "react-router";
import {
  RepositoryFactory,
  createRepositoryFactory,
} from "../app/repositories/RepositoryFactory";
import { AttachmentService } from "../app/services/attachmentService";
import * as schema from "../database/schema";

interface Env extends Cloudflare.Env {
  VITE_CLERK_PUBLISHABLE_KEY: string;
  R2: R2Bucket;
}

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
    db: DrizzleD1Database<typeof schema>;
    dbRepository: RepositoryFactory;
    attachmentService: AttachmentService;
    getCurrentUser: (loaderArgs: LoaderFunctionArgs) => Promise<{
      email: string | null;
      isAdmin: boolean;
      id: string;
      firstName: string | null;
      lastName: string | null;
    }>;
    assertAdminUser: (loaderArgs: LoaderFunctionArgs) => Promise<void>;
    assertLoggedInUser: (loaderArgs: LoaderFunctionArgs) => Promise<void>;
  }
}

// List of admin emails
const ADMIN_EMAILS = ["hey@willy.im", "eliascaseres@gmail.com"];

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

export default {
  async fetch(request, env, ctx) {
    const db = drizzle(env.DB, { schema });
    const dbRepository = createRepositoryFactory(db);

    const getCurrentUser = async (args: LoaderFunctionArgs) => {
      const auth = await getAuth(args);

      const user = await createClerkClient({
        secretKey: env.CLERK_SECRET_KEY,
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

    const assertAdminUser = async (args: LoaderFunctionArgs) => {
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

      if (result) {
        throw result;
      }
    };

    const assertLoggedInUser = async (args: LoaderFunctionArgs) => {
      let result: Response | null = null;
      const currentUrl = new URL(args.request.url);
      const unauthorizedUrl = `/unauthorized?back=${currentUrl.pathname}`;

      try {
        const user = await getCurrentUser(args);

        if (!user.email) {
          result = redirect(unauthorizedUrl);
        }
      } catch (error) {
        console.error("Error getting current user:", error);
        result = redirect(unauthorizedUrl);
      }

      if (result) {
        throw result;
      }
    };

    const attachmentService = new AttachmentService(db, {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      accountId: env.R2_ACCOUNT_ID,
      bucketName: "icona",
    });

    return requestHandler(request, {
      cloudflare: { env, ctx },
      db,
      dbRepository,
      attachmentService,
      getCurrentUser,
      assertAdminUser,
      assertLoggedInUser,
    });
  },
} satisfies ExportedHandler<Env>;
