import { SignedIn, SignedOut, UserButton } from "@clerk/react-router";
import { Link, useLocation } from "react-router";

export function Menu() {
  const location = useLocation();

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
        </ul>
      </div>
      <div className="navbar-end">
        <SignedOut>
          <Link to="/sign-in" className="btn btn-primary">
            Sign In
          </Link>
        </SignedOut>
        <SignedIn>
          <UserButton afterSignOutUrl="/" />
        </SignedIn>
      </div>
    </div>
  );
}
