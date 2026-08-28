import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/lib/AuthContext";
import { ProtectedRoute } from "@/lib/ProtectedRoute";
import AppShell from "@/layouts/AppShell";
import Dashboard from "@/pages/Dashboard";
import Tasks from "@/pages/Tasks";
import TugasRutin from "@/pages/TugasRutin";
import Spiritual from "@/pages/Spiritual";
import Raport from "@/pages/Raport";
import Monitoring from "@/pages/Monitoring";
import Strategy from "@/pages/Strategy";
import UsersManagement from "@/pages/UsersManagement";
import Profile from "@/pages/Profile";
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import AuthCallback from "@/pages/auth/AuthCallback";
import Pending from "@/pages/auth/Pending";

function AppRouter() {
  const location = useLocation();
  // OAuth callback detection (Emergent returns session_id in URL hash)
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/pending" element={<Pending />} />
      <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/tugas-rutin" element={<TugasRutin />} />
        <Route path="/spiritual" element={<Spiritual />} />
        <Route path="/raport" element={<ProtectedRoute requireSpv><Raport /></ProtectedRoute>} />
        <Route path="/monitoring" element={<ProtectedRoute requireSpv><Monitoring /></ProtectedRoute>} />
        <Route path="/strategy" element={<ProtectedRoute requireSpv><Strategy /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute requireSpv><UsersManagement /></ProtectedRoute>} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/amaliyah" element={<Navigate to="/spiritual" replace />} />
        <Route path="/import" element={<Navigate to="/tasks" replace />} />
        <Route path="/arsip" element={<Navigate to="/tasks" replace />} />
        <Route path="/todo-rutin" element={<Navigate to="/tugas-rutin" replace />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
