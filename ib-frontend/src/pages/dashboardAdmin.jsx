import React, { useState, useEffect } from "react";
import axios from "axios";
import Navbar from "../components/Navbar";
import '../styles/DashboardAdmin.css';
import { Link } from 'react-router-dom';

const DashboardAdmin = () => {
    const [requests, setRequests] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('Semua');
    const [selectedDate, setSelectedDate] = useState('');
    const [sortOrder, setSortOrder] = useState("terbaru");
    const [timeoutRequests, setTimeoutRequests] = useState([]);

    //tabel
    const [currentPage, setCurrentPage] = useState(1);
    const [entriesPerPage, setEntriesPerPage] = useState(5);

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

    // Untuk pagination
    const indexOfLastEntry = currentPage * entriesPerPage;
    const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
    const currentEntries = filteredRequests.slice(indexOfFirstEntry, indexOfLastEntry);
    const totalPages = Math.ceil(filteredRequests.length / entriesPerPage);

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

    useEffect(() => {
        const fetchTimeouts = async () => {
            try {
            const res = await axios.get('http://localhost:5000/api/requests/pending/timeout');
            setTimeoutRequests(res.data); // <-- buat state `timeoutRequests`
            } catch (err) {
            console.error("Gagal mengambil request yang belum diproses:", err);
            }
        };

        fetchTimeouts();
        }, []);


    return (
        <div>
            <Navbar />
            <div className="container">
            <h2>Daftar Permintaan</h2>

            {/* Search & Controls */}
            <div className="table-controls">
                <label>
                Show{" "}
                <select
                    className="entry-select"
                    value={entriesPerPage}
                    onChange={(e) => {
                    setEntriesPerPage(Number(e.target.value));
                    setCurrentPage(1);
                    }}
                >
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="20">20</option>
                </select>{" "}
                entries
                </label>

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
                <option value="Diproses">Sedang Diproses</option>
                <option value="Selesai">Selesai</option>
                <option value="Ditolak">Ditolak</option>
                </select>

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
                {currentEntries.map((req, index) => (
                    <tr key={index}>
                    <td>#{req.id}</td>
                    <td>{req.nama_peternak}</td>
                    <td>{new Date(req.tanggal).toLocaleDateString("id-ID")}</td>
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

            {/* Pagination */}
            <div className="pagination">
                <button onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1}>
                Previous
                </button>

                {[...Array(totalPages)].map((_, i) => (
                <button
                    key={i}
                    className={currentPage === i + 1 ? "active-page" : ""}
                    onClick={() => setCurrentPage(i + 1)}
                >
                    {i + 1}
                </button>
                ))}

                <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                >
                Next
                </button>
            </div>

            {/* Timeout Section */}
            {timeoutRequests.length > 0 && (
                <section className="section">
                <h3>Permintaan IB Belum Diproses (lebih dari 30 menit)</h3>
                <ul>
                    {timeoutRequests.map((req) => (
                    <li key={req.id}>
                        Permintaan #{req.id} oleh {req.nama_peternak} belum diproses.
                        <Link to={`/admin/permintaan/${req.id}`}>
                        <button>Detail</button>
                        </Link>
                    </li>
                    ))}
                </ul>
                </section>
            )}
            </div>
        </div>
        );
};

export default DashboardAdmin;
