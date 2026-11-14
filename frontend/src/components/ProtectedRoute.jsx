// Route guard: sends logged-out users to /login and blocks roles
// that are not allowed on a page (role-based access in the UI).
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { Spinner } from "./ui";

export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner label="Checking your session" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <h1 className="text-2xl font-bold">You don't have access to this page</h1>
        <p className="mt-2 text-ink-soft">This area is for {roles.join(" or ")} accounts.</p>
      </div>
    );
  }
  return children;
}
