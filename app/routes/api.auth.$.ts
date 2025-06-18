import type { Route } from "./+types/auth.signin";

export async function loader({ request, context }: Route.LoaderArgs) {
  return context.auth.handler(request);
}

export async function action({ request, context }: Route.ActionArgs) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Handle the auth request first
  const response = await context.auth.handler(request);

  // Log auth events after successful operations
  try {
    if (pathname.includes("/sign-in/magic-link") && request.method === "POST") {
      // Check if sign in was successful by looking at the response
      if (response.ok) {
        const session = await context.auth.api.getSession({
          headers: request.headers,
        });

        if (session?.user) {
          await context.auditService.logSignIn(
            session.user,
            { method: "magic_link" },
            { request }
          );
        }
      }
    } else if (pathname.includes("/sign-out") && request.method === "POST") {
      // For sign out, we need to get the user before the session is destroyed
      const session = await context.auth.api.getSession({
        headers: request.headers,
      });

      if (session?.user) {
        await context.auditService.logSignOut(session.user, {}, { request });
      }
    }
  } catch (error) {
    // Don't fail the auth operation if audit logging fails
    console.error("Failed to log auth event:", error);
  }

  return response;
}
