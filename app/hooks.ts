import { useRouteLoaderData } from "react-router";
import type { loader } from "./root";

export const useCurrentUser = () => {
  const rootData = useRouteLoaderData<typeof loader>("root");

  return rootData?.currentUser;
};

export const useIsAdmin = () => {
  const rootData = useRouteLoaderData<typeof loader>("root");

  return rootData?.isAdmin ?? false;
};
