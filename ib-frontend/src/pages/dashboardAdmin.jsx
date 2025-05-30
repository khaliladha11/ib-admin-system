import React, { useState, useEffect } from "react";
import axios from "axios";
import Navbar from "../components/Navbar";
import '../styles/DashboardAdmin.css';
import { Link } from 'react-router-dom';

const DashboardAdmin = () => {
    const [requests, setRequests] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Fetch data dari backend
    useEffect(() => {
        const fetchData = async () => {
        try {
            const res = await axios.get("http://localhost:5000/api/requests");
            setRequests(res.data);
        } catch (err) {
            console.error("Gagal mengambil data permintaan:", err.message);
        }
        };
        fetchData();
    }, []);

    const [selectedStatus, setSelectedStatus] = useState('Semua');
    const [selectedDate, setSelectedDate] = useState('');
    const [sortOrder, setSortOrder] = useState("terbaru");

    // Filter berdasarkan nama peternak, date, dan status
    const filteredRequests = [...requests]
    .filter(req => {
        const matchesSearch = req.nama_peternak.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = selectedStatus === 'Semua' || req.status === selectedStatus;
        return matchesSearch && matchesStatus;
        })
    .sort((a, b) => {
        const dateA = new Date(a.tanggal);
        const dateB = new Date(b.tanggal);
        return sortOrder === 'terbaru' ? dateB - dateA : dateA - dateB;
    });


    return (
        <div>
        <Navbar />
        <div className="container">
            <h2>Daftar Permintaan</h2>

            {/* Search & Controls */}
            <div className="table-controls">
            <label>Show 
                <select className="entry-select">
                <option>10</option>
                <option>20</option>
                </select> entries
            
                <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="search-input"
                />

                <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                    <option value="terbaru">Terbaru</option>
                    <option value="terlama">Terlama</option>
                </select>

                <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                    <option value="Semua">Semua Status</option>
                    <option value="Menunggu Verifikasi">Menunggu Verifikasi</option>
                    <option value="Sedang Diproses">Sedang Diproses</option>
                    <option value="Selesai">Selesai</option>
                    <option value="Ditolak">Ditolak</option>
                </select>
            </label>

            <input
                type="text"
                placeholder="Search..."
                className="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
            </div>

            {/* Table */}
            <table className="request-table">
            <thead>
                <tr>
                <th>ID</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Status</th>
                <th>Action</th>
                </tr>
            </thead>
            <tbody>
                {filteredRequests.map((req, index) => (
                <tr key={index}>
                    <td>#{req.id}</td>
                    <td>{req.nama_peternak}</td>
                    <td>{new Date(req.tanggal).toLocaleDateString('id-ID')}</td>
                    <td>
                    <span className={`status-badge ${req.status.replace(/\s+/g, '-').toLowerCase()}`}>
                        {req.status}
                    </span>
                    </td>
                    <td>
                    <Link to={`/admin/permintaan/${req.id}`}>
                        <button className="detail-btn">Detail</button>
                    </Link>
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        </div>
        </div>
    );
};

export default DashboardAdmin;
