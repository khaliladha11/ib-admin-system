// src/components/Navbar.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import './Navbar.css';

const Navbar = () => {
    const navigate = useNavigate();

    const name = localStorage.getItem('name');
    const role = localStorage.getItem('role');

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('name');
        navigate('/');
    };

    const goToHome = () => {
        if (role === 'admin') {
            navigate('/admin/dashboard');
        } else if (role === 'petugas') {
            navigate('/petugas/dashboard');
        }
    };

    return (
        <nav className="navbar">
            <div className="navbar-left">
                <h3>Dashboard</h3>
                {name && role && (
                    <span className="user-info">
                        ({role}) {name}
                    </span>
                )}
            </div>
            <div className="navbar-right">
                <span onClick={goToHome} style={{ cursor: 'pointer' }}>Home</span>
                <button className="logout-btn" onClick={handleLogout}>Logout</button>
            </div>
        </nav>
    );
};

export default Navbar;
