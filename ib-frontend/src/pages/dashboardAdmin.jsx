import React, { useState, useEffect } from "react";
import axios from "axios";
import Navbar from "../components/Navbar";
import '../styles/Dashboard.css';
import { Link } from 'react-router-dom';

const DashboardAdmin = () => {
    const [requests, setRequests] = useState([]);
    const [checkupReady, setCheckupReady] = useState([]);
    const [timeoutRequests, setTimeoutRequests] = useState([]);
    const [pendingCheckups, setPendingCheckups] = useState([]);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('Semua');
    const [selectedDate, setSelectedDate] = useState('');
    const [sortOrder, setSortOrder] = useState("terbaru");

    //tabel
    const [entriesPerPage, setEntriesPerPage] = useState(5);
    const [currentPage, setCurrentPage] = useState(1);

    // Filter berdasarkan prioritas flag (updated)
    const filteredRequests = requests
    .filter((req) => {
        const matchSearch = req.nama_peternak?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = selectedStatus === 'Semua' || req.status === selectedStatus;
        const matchDate = selectedDate === '' || new Date(req.tanggal).toLocaleDateString('id-ID') === new Date(selectedDate).toLocaleDateString('id-ID');
        return matchSearch && matchStatus && matchDate;
    })
    .sort((a, b) => {
        const aPrioritas = a.flag_laporan_ib || a.flag_laporan_kebuntingan || a.flag_laporan_kelahiran;
        const bPrioritas = b.flag_laporan_ib || b.flag_laporan_kebuntingan || b.flag_laporan_kelahiran;

        // Prioritaskan yang memiliki flag jemput bola
        if (aPrioritas && !bPrioritas) return -1;
        if (!aPrioritas && bPrioritas) return 1;

        // Kalau dua-duanya sama-sama penting atau sama-sama tidak penting, urutkan berdasarkan tanggal
        const dateA = new Date(a.tanggal);
        const dateB = new Date(b.tanggal);
        return sortOrder === 'terbaru' ? dateB - dateA : dateA - dateB;
    });
    
    // section prioritas
    const priorityRequests = requests.filter(
    (req) =>
        req.flag_laporan_ib ||
        req.flag_laporan_kebuntingan ||
        req.flag_laporan_kelahiran
    );

    // useEffect untuk update flags dan fetch data secara berurutan
    useEffect(() => {
        const updateFlagsThenFetch = async () => {
            try {
                await axios.post("http://localhost:5000/api/requests/update-flags");
                const res = await axios.get("http://localhost:5000/api/requests");
                setRequests(res.data);
            } catch (err) {
                console.error("Gagal update flag atau fetch data:", err);
            }
        };
        updateFlagsThenFetch();
    }, []);

    // Fetch data dari backend

    useEffect(() => {
        const fetchTimeouts = async () => {
            try {
                const res = await axios.get('http://localhost:5000/api/requests/pending/timeout');
                setTimeoutRequests(res.data);
            } catch (err) {
                console.error("Gagal mengambil request yang belum diproses:", err);
            }
        };
        fetchTimeouts();
    }, []);

    useEffect(() => {
        const fetchPendingCheckups = async () => {
            try {
                const res = await axios.get('http://localhost:5000/api/requests/checkups/menunggu');
                setPendingCheckups(res.data);
            } catch (err) {
                console.error("Gagal mengambil checkup menunggu penugasan:", err);
            }
        };

        fetchPendingCheckups();
    }, []);

    
    const [siapCheckupRequests, setSiapCheckupRequests] = useState([]);
    useEffect(() => {
        const fetchSiapCheckup = async () => {
            try {
                const res = await axios.get('http://localhost:5000/api/requests');
                const filtered = res.data.filter(req =>
                    req.laporan_terisi === true &&
                    req.checkup_status === 'Belum Dikonfirmasi'
                );
                setSiapCheckupRequests(filtered);
            } catch (err) {
                console.error("Gagal mengambil data siap checkup:", err);
            }
        };
        fetchSiapCheckup();
    }, []);

    // Untuk pagination
    const indexOfLastEntry = currentPage * entriesPerPage;
    const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
    const currentEntries = filteredRequests.slice(indexOfFirstEntry, indexOfLastEntry);
    const totalPages = Math.ceil(filteredRequests.length / entriesPerPage);

    return (
        <div>
            <Navbar />
            <div className="container">
                <h2>Daftar Permintaan</h2>
                {/* section prioritas */}
                {priorityRequests.length > 0 && (
                    <section className="section warning-section">
                        <h3>⚠️ Permintaan Prioritas (Menunggu Laporan Peternak)</h3>
                        <ul>
                            {priorityRequests.map((req) => (
                                <li key={req.id}>
                                    Permintaan #{req.id} oleh {req.nama_peternak} &nbsp;

                                    {/* Tampilkan jenis flag yang aktif */}
                                    {req.flag_laporan_ib && <span className="badge alert-badge">Butuh Laporan IB</span>}
                                    {req.flag_laporan_kebuntingan && <span className="badge alert-badge">Butuh Laporan Kebuntingan</span>}
                                    {req.flag_laporan_kelahiran && <span className="badge alert-badge">Butuh Laporan Kelahiran</span>}

                                    <Link to={`/admin/permintaan/${req.id}`}>
                                        <button style={{ marginLeft: "10px" }}>Detail</button>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {pendingCheckups.length > 0 && (
                    <section className="section">
                        <h3>Permintaan Checkup Menunggu Penugasan</h3>
                        <ul>
                            {pendingCheckups.map(checkup => (
                                <li key={checkup.id}>
                                    {checkup.tipe} untuk permintaan #{checkup.request_id} dari {checkup.nama_peternak}.
                                    <Link to={`/admin/permintaan/${checkup.request_id}`}>
                                        <button style={{ marginLeft: "10px" }}>Detail</button>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                <div className="table-controls">
                    <label>
                        Show
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
                        </select>
                        entries
                    </label>

                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="entry-select"
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
                        <option value="Berhasil">IB Berhasil</option>
                        <option value="Gagal">IB Gagal</option>
                    </select>

                    <input
                        type="text"
                        placeholder="Search..."
                        className="search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

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
                        {currentEntries.map((req) => (
                            <tr key={req.id} className={
                                req.flag_laporan_ib || req.flag_laporan_kebuntingan || req.flag_laporan_kelahiran
                                    ? "flag-alert"
                                    : ""
                            }>
                            <td>#{req.id}</td>
                            <td>{req.nama_peternak}</td>
                            <td>{new Date(req.tanggal).toLocaleDateString("id-ID")}</td>
                            <td>
                                <span className={`status-badge ${req.status.toLowerCase().replace(/\s+/g, '-')}`}>
                                    {req.status}
                                </span>
                                {(req.flag_laporan_ib || req.flag_laporan_kebuntingan || req.flag_laporan_kelahiran) && (
                                    <span style={{ color: 'red', marginLeft: '5px' }}>⚠️</span>
                                )}
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
                <div className="pagination-wrapper">
                    <div className="pagination">
                        <button onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))} disabled={currentPage === 1}>Previous</button>
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
                        >Next</button>
                    </div>
                </div>

                {siapCheckupRequests.length > 0 && (
                    <section className="section">
                        <h3>Permintaan Siap Checkup</h3>
                        <ul>
                            {siapCheckupRequests.map(req => (
                                <li key={req.id}>
                                    Permintaan #{req.id} oleh {req.nama_peternak} siap untuk checkup.
                                    <Link to={`/admin/permintaan/${req.id}`}>
                                        <button style={{ marginLeft: "10px" }}>Detail</button>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

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
