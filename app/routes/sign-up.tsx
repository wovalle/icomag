import { SignUp } from "@clerk/react-router";

export default function SignUpPage() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <SignUp
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
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
