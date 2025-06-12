import { useUser } from "@clerk/react-router";
import { Link } from "react-router";

export default function UnauthorizedPage() {
  const { isSignedIn } = useUser();

  return (
    <div className="flex flex-col items-center ">
      <div className="card card-bordered bg-base-100 w-full max-w-md shadow-lg">
        <div className="card-body">
          <h2 className="card-title text-error">Access Denied</h2>

          {isSignedIn ? (
            <p>
              You don't have permission to access this resource. This area
              requires admin privileges.
            </p>
          ) : (
            <p>You need to be logged in to access this resource.</p>
          )}

          <div className="card-actions justify-end mt-6">
            {isSignedIn ? (
              <Link to="/" className="btn btn-primary">
                Return to Home
              </Link>
            ) : (
              <Link to="/sign-in" className="btn btn-primary">
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
