import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import PlayerPage from "./pages/PlayerPage";
import AdminPage from "./pages/AdminPage";
import HostPage from "./pages/HostPage";
import ErrorBoundary from "./components/ErrorBoundary";

// Token yoksa anasayfaya yonlendirir.
// /admin ve /host giris gerektiren sayfalari korur.
function PrivateRoute({ children }) {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/player" element={<PlayerPage />} />
          <Route
            path="/admin"
            element={
              <PrivateRoute>
                <AdminPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/host"
            element={
              <PrivateRoute>
                <HostPage />
              </PrivateRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
