import { Link, useLocation } from "react-router";

export function Menu() {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname.startsWith(path) ? "btn-active" : "";
  };

  return (
    <div className="navbar bg-base-200 mb-6">
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
            className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52"
          >
            <li>
              <Link to="/" className={isActive("/")}>
                Home
              </Link>
            </li>

            <li>
              <Link to="/owners" className={isActive("/owners")}>
                Owners
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
          iComag
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
              to="/owners"
              className={`btn btn-ghost ${isActive("/owners")}`}
            >
              Owners
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
    </div>
  );
}
