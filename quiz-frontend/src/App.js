import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import PlayerPage from './pages/PlayerPage';
import AdminPage from './pages/AdminPage';
import HostPage from './pages/HostPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/player" element={<PlayerPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/host" element={<HostPage />} />
      </Routes>
    </BrowserRouter>
  );
}