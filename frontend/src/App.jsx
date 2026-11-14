import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import { ToastProvider } from "./components/Toast";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import { LoginPage, RegisterPage } from "./pages/AuthPages";
import Dashboard from "./pages/Dashboard";
import RequestsPage from "./pages/RequestsPage";
import NewRequest from "./pages/NewRequest";
import RequestDetail from "./pages/RequestDetail";
import Profile from "./pages/Profile";
import Users from "./pages/admin/Users";
import Categories from "./pages/admin/Categories";
import Reports from "./pages/admin/Reports";
import AuditLog from "./pages/admin/AuditLog";

function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <Link to="/" className="mt-4 inline-block font-semibold text-teal hover:underline">Go to your dashboard</Link>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="requests" element={<RequestsPage />} />
              <Route path="requests/new" element={<ProtectedRoute roles={["student", "staff"]}><NewRequest /></ProtectedRoute>} />
              <Route path="requests/:id" element={<RequestDetail />} />
              <Route path="profile" element={<Profile />} />
              <Route path="admin/users" element={<ProtectedRoute roles={["admin"]}><Users /></ProtectedRoute>} />
              <Route path="admin/categories" element={<ProtectedRoute roles={["admin"]}><Categories /></ProtectedRoute>} />
              <Route path="admin/reports" element={<ProtectedRoute roles={["admin"]}><Reports /></ProtectedRoute>} />
              <Route path="admin/audit" element={<ProtectedRoute roles={["admin"]}><AuditLog /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
