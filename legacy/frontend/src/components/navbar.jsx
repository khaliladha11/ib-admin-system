// src/components/Navbar.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import './Navbar.css';

const Navbar = () => {
    const navigate = useNavigate();

    const name = sessionStorage.getItem('name');
    const role = sessionStorage.getItem('role');

    const handleLogout = () => {
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('role');
        sessionStorage.removeItem('name');
        sessionStorage.removeItem('userId'); // Jangan lupa ini juga!
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
                <button className="nav-btn" onClick={goToHome}>Home</button>
                <button className="logout-btn" onClick={handleLogout}>Logout</button>
            </div>
        </nav>
    );
};

export default Navbar;
