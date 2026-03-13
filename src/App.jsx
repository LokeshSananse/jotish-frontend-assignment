import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import List from "./pages/List";
import Details from "./pages/Details";
import Analytics from "./pages/Analytics";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Protected */}
          <Route
            path="/list"
            element={
              <ProtectedRoute>
                <List />
              </ProtectedRoute>
            }
          />
          <Route
            path="/details/:id"
            element={
              <ProtectedRoute>
                <Details />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <Analytics />
              </ProtectedRoute>
            }
          />

          {/* Catch-all → redirect to /list (which will bounce to /login if unauthed) */}
          <Route path="*" element={<Navigate to="/list" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
