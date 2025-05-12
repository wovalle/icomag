import { getAuth } from "@clerk/react-router/ssr.server";
import { redirect } from "react-router";

export const requireAuthentication = async (args: any) => {
  const { userId } = await getAuth(args);

  // Store user ID in context for later use
  if (userId && args.context) {
    args.context.userId = userId;

    // Try to get user email from headers or other sources if needed
    try {
      // This is just a placeholder - in a real app, you might use Clerk's backend API
      // to get the complete user profile including email
      const authHeader = args.request.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        const payload = JSON.parse(atob(token.split(".")[1]));
        args.context.userEmail = payload.email || null;
      }
    } catch (error) {
      console.error("Error extracting user email:", error);
    }
  }

  if (!userId) {
    return redirect("/unauthorized");
  }

  return null;
};

export const requireAdmin = async (args: any) => {
  const { userId } = await getAuth(args);

  // Store user ID in context
  if (userId && args.context) {
    args.context.userId = userId;

    // Try to get user email as in requireAuthentication
    try {
      const authHeader = args.request.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        const payload = JSON.parse(atob(token.split(".")[1]));
        args.context.userEmail = payload.email || null;
      }
    } catch (error) {
      console.error("Error extracting user email:", error);
    }
  }

  if (!userId) {
    return redirect("/unauthorized");
  }

  const adminCheckResult = args.context.assertAdminUser();
  if (adminCheckResult) {
    return redirect("/unauthorized");
  }

  return null;
};
