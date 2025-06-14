import { useState } from "react";
import { authClient } from "../lib/auth-client";
import type { Route } from "./+types/auth.signin";

export async function loader({ context, request }: Route.LoaderArgs) {
  const session = await context.auth.api.getSession({
    headers: request.headers,
  });

  return {
    baseURL: context.cloudflare.env.BETTER_AUTH_URL,
    user: session?.user,
  };
}

export default function SignIn({ loaderData }: Route.ComponentProps) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    if (!email) {
      setError("Email is required");
      setIsSubmitting(false);
      return;
    }

    try {
      const result = await authClient.signIn.magicLink({
        email,
        callbackURL: "/", // Redirect to home after successful login
      });

      if (result.error) {
        console.error("Magic link result error:", result);
        setError(
          result.error.message || "Unknown error when sending magic link"
        );
      } else {
        setSuccess(
          `Magic link sent! If ${email} is registered, check your email to sign in.`
        );
      }
    } catch (error) {
      console.error("Magic link error:", error);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pt-16 flex items-center justify-center ">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to Icomag
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter your email to receive a magic link
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label htmlFor="email" className="sr-only">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
              placeholder="Email address"
              disabled={isSubmitting}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          {success && (
            <div className="rounded-md bg-green-50 p-4">
              <div className="text-sm text-green-700">{success}</div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Sending..." : "Send Magic Link"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
