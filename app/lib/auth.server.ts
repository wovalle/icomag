import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { Resend } from "resend";

import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../database/schema";

type Ctx = {
  db: DrizzleD1Database<typeof schema>;
  env: Env;
};

let authInstance: ReturnType<typeof betterAuth>;

export function createBetterAuth(
  database: BetterAuthOptions["database"],
  ctx: Ctx
) {
  const env = ctx.env;
  if (!authInstance) {
    authInstance = betterAuth({
      appName: "Icomag",
      database,
      plugins: [
        magicLink({
          sendMagicLink: async ({ email, token, url }, request) => {
            const resend = new Resend(env.RESEND_API_KEY);

            const user = await ctx.db.query.owners.findFirst({
              where: eq(schema.owners.email, email),
            });

            if (!user) {
              console.info("User not found, skipping email");
              return;
            }

            // In development, print to console instead of sending email
            if (env.NODE_ENV === "development") {
              console.log("\n🔗 Magic Link for", email);
              console.log("Token:", token);
              console.log("Click here to login:", url);
              console.log("─".repeat(50));
              return;
            }

            // In production, send via Resend
            try {
              await resend.emails.send({
                from: "Icomag <noreply@emails.willy.im>",
                to: [email],
                subject: "Your Magic Link - icomag.willy.im",
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">Welcome to Icomag!</h2>
                    <p>Click the link below to sign in to your account:</p>
                    <a href="${url}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 16px 0;">
                      Sign In to Icomag
                    </a>
                    <p style="color: #666; font-size: 14px;">This link will expire in 5 minutes.</p>
                    <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
                  </div>
                `,
              });
            } catch (error) {
              console.error("Failed to send magic link email:", error);
              throw error;
            }
          },
          expiresIn: 60 * 5, // 5 minutes
        }),
      ],
      secret: process.env.BETTER_AUTH_SECRET,
      baseURL: process.env.BETTER_AUTH_URL,
      session: {
        expiresIn: 60 * 60 * 24 * 30, // 30 days
        updateAge: 60 * 60 * 24, // 1 day
      },
    });
  }

  return authInstance;
}

export function getAuth(ctx: Ctx) {
  if (!authInstance) {
    const db = ctx.db;

    authInstance = createBetterAuth(
      drizzleAdapter(db, {
        schema,
        provider: "sqlite",
      }),
      ctx
    );
  }

  return authInstance;
}
