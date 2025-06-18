import { LogOut } from "lucide-react";
import { Link, useLocation } from "react-router";
import { authClient } from "~/lib/auth-client";
import { useCurrentUser, useIsAdmin } from "../hooks";

export function Menu() {
  const location = useLocation();
  const user = useCurrentUser();
  const isAdmin = useIsAdmin();

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
      window.location.href = "/auth/signin";
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === path ? "btn-active" : "";
    }

    return location.pathname.startsWith(path) ? "btn-active" : "";
  };

  return (
    <div className="navbar mb-6">
      <div className="navbar-start">
        <div className="dropdown">
          <div tabIndex={0} role="button" className="btn btn-ghost lg:hidden">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h8m-8 6h16"
              />
            </svg>
          </div>
          <ul
            tabIndex={0}
            className="menu dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box text-lg"
          >
            <li>
              <Link to="/" className={isActive("/")}>
                Home
              </Link>
            </li>
            <li>
              <Link to="/balance" className={isActive("/balance")}>
                Balance
              </Link>
            </li>
            <li>
              <Link to="/owners" className={isActive("/owners")}>
                Owners
              </Link>
            </li>
            <li>
              <Link to="/batches" className={isActive("/batches")}>
                Batches
              </Link>
            </li>
            <li>
              <Link to="/transactions" className={isActive("/transactions")}>
                Transactions
              </Link>
            </li>
            <li>
              <Link to="/tags" className={isActive("/tags")}>
                Tags
              </Link>
            </li>
            {isAdmin && (
              <li>
                <Link to="/audit-logs" className={isActive("/audit-logs")}>
                  Audit Logs
                </Link>
              </li>
            )}
          </ul>
        </div>
        <Link to="/" className="btn btn-ghost text-xl">
          <img src="/logo-rect.png" alt="Icona Management" className="h-10" />
        </Link>
      </div>

      <div className="navbar-center hidden lg:flex">
        <ul className="menu menu-horizontal px-1">
          <li>
            <Link to="/" className={`btn btn-ghost ${isActive("/")}`}>
              Home
            </Link>
          </li>
          <li>
            <Link
              to="/balance"
              className={`btn btn-ghost ${isActive("/balance")}`}
            >
              Balance
            </Link>
          </li>
          <li>
            <Link
              to="/owners"
              className={`btn btn-ghost ${isActive("/owners")}`}
            >
              Owners
            </Link>
          </li>
          <li>
            <Link
              to="/batches"
              className={`btn btn-ghost ${isActive("/batches")}`}
            >
              Batches
            </Link>
          </li>
          <li>
            <Link
              to="/transactions"
              className={`btn btn-ghost ${isActive("/transactions")}`}
            >
              Transactions
            </Link>
          </li>
          <li>
            <Link to="/tags" className={`btn btn-ghost ${isActive("/tags")}`}>
              Tags
            </Link>
          </li>
          {isAdmin && (
            <li>
              <Link
                to="/audit-logs"
                className={`btn btn-ghost ${isActive("/audit-logs")}`}
              >
                Audit Logs
              </Link>
            </li>
          )}
        </ul>
      </div>
      <div className="navbar-end">
        <div className="flex items-center gap-4">
          {user && (
            <>
              <span className="hidden sm:inline text-sm">
                Welcome, {user.name.split(" ")[0]}
              </span>
              <button
                onClick={handleSignOut}
                className="btn btn-outline btn-sm"
              >
                <LogOut size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
