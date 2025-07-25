import React, { useState } from "react";
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../styles/LoginPage.css';
import Swal from 'sweetalert2';

const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

const handleLogin = async (e) => {
    e.preventDefault();
    try {
        const res = await axios.post('http://localhost:5000/api/login', {
            email,
            password,
        });

        sessionStorage.setItem('token', res.data.token);
        sessionStorage.setItem('role', res.data.role);
        sessionStorage.setItem('name', res.data.name);
        sessionStorage.setItem('userId', res.data.id);

        await Swal.fire({
            icon: 'success',
            title: 'Login Berhasil',
            text: `Selamat datang, ${res.data.name}`,
            confirmButtonColor: '#3085d6',
            confirmButtonText: 'OK'
        });

        // title halaman berdasarkan role
        if (res.data.role === 'admin') {
            document.title = 'IB Admin';
            navigate('/admin/dashboard');
        } else if (res.data.role === 'petugas') {
            document.title = 'IB Petugas';
            navigate('/petugas/dashboard');
        } else {
            document.title = 'IB';
            setError('Role tidak dikenali');
            await Swal.fire({
                icon: 'warning',
                title: 'Role tidak dikenali',
                text: 'Silakan hubungi administrator.',
                confirmButtonColor: '#d33',
                confirmButtonText: 'OK'
            });
        }
    } catch (err) {
        console.error("Login error:", err);
        setError('Login gagal. Periksa kembali email dan password.');
        await Swal.fire({
            icon: 'error',
            title: 'Login Gagal',
            text: 'Periksa kembali email dan password Anda.',
            confirmButtonColor: '#d33',
            confirmButtonText: 'OK'
        });
    }
};

return (
    <div className="login-container">
        <h1 className="login-title">Log in</h1>
        <p className="login-subtitle">IB Administration</p>
        {error && <p className="error-message">{error}</p>}
        <form onSubmit={handleLogin} className="login-form">
            <label htmlFor="email">Email</label>
            <input
                id="email"
                type="email"
                placeholder="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="input-field"
            />
            <label htmlFor="password">Password</label>
            <input
                id="password"
                type="password"
                placeholder="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="input-field"
            />
            <button type="submit" className="submit-button">Log in</button>
        </form>
    </div>
    );
};

export default LoginPage;
