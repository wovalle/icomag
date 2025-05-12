import { SignIn } from "@clerk/react-router";

export default function SignInPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <SignIn
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        appearance={{
          elements: {
            formButtonPrimary: "btn btn-primary",
            card: "shadow-xl p-8 rounded-lg",
            footerAction: "link link-primary",
          },
        }}
      />
    </div>
  );
}
