import type { User } from "better-auth";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { createRequestHandler } from "react-router";
import { getAuth } from "../app/lib/auth.server";
import {
  RepositoryFactory,
  createRepositoryFactory,
} from "../app/repositories/RepositoryFactory";
import { AttachmentService } from "../app/services/attachmentService";
import { AuditService } from "../app/services/auditService";
import { ADMIN_EMAILS } from "../app/static";
import type { Owner } from "../app/types";
import * as schema from "../database/schema";

interface Env extends Cloudflare.Env {
  R2: R2Bucket;
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

export default {
  async fetch(request, env, ctx) {
    const db = drizzle(env.DB, { schema });

    const auth = getAuth({
      env,
      db,
    });

    const session = await auth.api.getSession(request);

    const auditService = new AuditService(db, {
      user: session?.user,
    });

    // Create repository factory with audit service
    const dbRepository = createRepositoryFactory(db, auditService);

    const attachmentService = new AttachmentService(db, {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      accountId: env.R2_ACCOUNT_ID,
      bucketName: "icona",
    });

    return requestHandler(request, {
      env,
      cloudflare: { env, ctx },
      dbRepository,
      attachmentService,
      auditService,
      auth,
      getSession: async () => {
        const session = await auth.api.getSession({
          headers: request.headers,
        });

        if (!session) {
          return null;
        }

        const user = (await dbRepository.getOwnersRepository().findOne({
          where: eq(schema.owners.email, session.user.email),
        })) as Owner;

        return {
          sessionUser: session.user,
          currentUser: user,
          isAdmin: ADMIN_EMAILS.includes(session.user.email ?? ""),
        };
      },
    });
  },
} satisfies ExportedHandler<Env>;

declare module "react-router" {
  export interface AppLoadContext {
    env: Env;
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
    dbRepository: RepositoryFactory;
    attachmentService: AttachmentService;
    auditService: AuditService;
    auth: ReturnType<typeof getAuth>;
    getSession: () => Promise<{
      sessionUser: User;
      currentUser: Owner;
      isAdmin: boolean;
    } | null>;
  }
}
