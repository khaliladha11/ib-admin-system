import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/loginPage';
import DashboardAdmin from './pages/dashboardAdmin';
import DashboardPetugas from './pages/dashboardPetugas';
import DetailRequestAdmin from './pages/detailRequestAdmin';
import DetailRequestPetugas from "./pages/DetailRequestPetugas";

function App() {
  useEffect(() => {
    const role = sessionStorage.getItem("role");
    if (role === "admin") {
      document.title = "IB Admin";
    } else if (role === "petugas") {
      document.title = "IB Petugas";
    } else {
      document.title = "IB";
    }
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/admin/dashboard" element={<DashboardAdmin />} />
        <Route path="/petugas/dashboard" element={<DashboardPetugas />} />
        <Route path="/admin/permintaan/:id" element={<DetailRequestAdmin />} />
        <Route path="/petugas/permintaan/:id" element={<DetailRequestPetugas />} />
      </Routes>
    </Router>
  );
}

export default App;
