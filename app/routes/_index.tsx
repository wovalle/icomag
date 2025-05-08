import { Link } from "react-router";

export const loader = ({ request }: Route.LoaderArgs) => {
  console.log(Object.fromEntries(request.headers.entries()));

  return {};
};

export default function IndexPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">CRM</h1>

      <div className="tabs tabs-boxed mb-6">
        <Link to="/owners" className="tab">
          Owners
        </Link>
        <Link to="/transactions" className="tab">
          Transactions
        </Link>
        <Link to="/tags" className="tab">
          Tags
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="card shadow-md">
          <div className="card-body">
            <h2 className="card-title">Owners</h2>
            <p>Manage apartment owners and their bank accounts</p>
            <div className="card-actions justify-end">
              <Link to="/owners" className="btn btn-primary">
                View Owners
              </Link>
            </div>
          </div>
        </div>

        <div className="card shadow-md">
          <div className="card-body">
            <h2 className="card-title">Transactions</h2>
            <p>Track all financial transactions and relate them to owners</p>
            <div className="card-actions justify-end">
              <Link to="/transactions" className="btn btn-primary">
                View Transactions
              </Link>
            </div>
          </div>
        </div>

        <div className="card shadow-md">
          <div className="card-body">
            <h2 className="card-title">Tags</h2>
            <p>Manage transaction tags for categorizing payments</p>
            <div className="card-actions justify-end">
              <Link to="/tags" className="btn btn-primary">
                View Tags
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
