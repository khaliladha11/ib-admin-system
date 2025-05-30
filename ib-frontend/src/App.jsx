import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/loginPage';
import DashboardAdmin from './pages/dashboardAdmin';
import DashboardPetugas from './pages/dashboardPetugas';
import DetailRequest from './pages/detailRequest';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/admin/dashboard" element={<DashboardAdmin />} />
        <Route path="/petugas/dashboard" element={<DashboardPetugas />} />
        <Route path="/admin/permintaan/:id" element={<DetailRequest />} />
      </Routes>
    </Router>
  );
}

export default App;
