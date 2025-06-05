import React, { useEffect, useState } from "react";
import axios from "axios";
import Navbar from "../components/Navbar";
import { Link } from "react-router-dom";
import '../styles/DashboardAdmin.css'; // Gunakan CSS yang sama agar seragam

const DashboardPetugas = () => {
    const [requests, setRequests] = useState([]);
    const [overdueReports, setOverdueReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedStatus, setSelectedStatus] = useState('Semua');
    const [selectedDate, setSelectedDate] = useState('');
    const [sortOrder, setSortOrder] = useState("terbaru");

    const [currentPage, setCurrentPage] = useState(1);
    const [entriesPerPage, setEntriesPerPage] = useState(5);

    const petugasId = sessionStorage.getItem("userId");

    const [pendingReports, setPendingReports] = useState([]);
    // Fetch data permintaan
    useEffect(() => {
    const fetchRequests = async () => {
            try {
                const res = await axios.get(`http://localhost:5000/api/requests/petugas/${petugasId}/requests`);
                setRequests(res.data);
            } catch (err) {
                console.error("Gagal mengambil data permintaan untuk petugas:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchRequests();
    }, [petugasId]);

    // Fetch data laporan yang sudah lewat 24 jam
    useEffect(() => {
        const fetchOverdueReports = async () => {
            try {
                const res = await axios.get(`http://localhost:5000/api/requests/petugas/${petugasId}/laporan/lewat`);
                setOverdueReports(res.data);
            } catch (err) {
                console.error("Gagal mengambil laporan terlambat:", err);
            }
        };
        if (petugasId) fetchOverdueReports();
    }, [petugasId]);

    //filter notifikasi laporan
    useEffect(() => {
        const fetchTimeouts = async () => {
            try {
            const res = await axios.get("http://localhost:5000/api/requests/pending/timeout");
            const data = res.data.filter(req => 
                req.petugas_id === parseInt(petugasId) &&
                !req.laporan_terisi // filter yang belum isi laporan
            );
            setPendingReports(data);
            } catch (err) {
            console.error("Gagal mengambil data keterlambatan:", err);
            }
        };

        fetchTimeouts();
        }, [petugasId, requests]); // ← agar refresh setelah laporan masuk

    // Petugas melakukan chekup
    const [checkupRequests, setCheckupRequests] = useState([]);

    useEffect(() => {
    const fetchCheckupRequests = async () => {
        try {
        const res = await axios.get("http://localhost:5000/api/requests");
        const data = res.data.filter(req =>
            req.checkup_petugas_id === parseInt(petugasId) &&
            req.checkup_status === 'Belum Dikonfirmasi'
        );
        setCheckupRequests(data);
        } catch (err) {
        console.error("Gagal mengambil permintaan checkup:", err);
        }
    };
    fetchCheckupRequests();
    }, [petugasId]);

    
    // 🔍 Filter & Sort
    const filteredRequests = requests
    .filter(req => {
        const matchSearch = req.nama_peternak?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchStatus = selectedStatus === 'Semua' || req.status === selectedStatus;
        const matchDate = selectedDate === '' || new Date(req.tanggal).toLocaleDateString('id-ID') === new Date(selectedDate).toLocaleDateString('id-ID');

        // Petugas bisa melihat permintaan jika dia ditugaskan sebagai petugas utama atau petugas checkup
        const isAssignedToThisPetugas =
            parseInt(req.petugas_id) === parseInt(petugasId) ||
            parseInt(req.checkup_petugas_id) === parseInt(petugasId);

        return matchSearch && matchStatus && matchDate && isAssignedToThisPetugas;
    })
    .sort((a, b) => {
        const dateA = new Date(a.tanggal);
        const dateB = new Date(b.tanggal);
        return sortOrder === 'terbaru' ? dateB - dateA : dateA - dateB;
    });

    const indexOfLastEntry = currentPage * entriesPerPage;
    const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
    const currentEntries = filteredRequests.slice(indexOfFirstEntry, indexOfLastEntry);
    const totalPages = Math.ceil(filteredRequests.length / entriesPerPage);

    if (loading) return <p>Memuat data...</p>;

    return (
        <div>
            <Navbar />
            <div className="container">
                <h2>Permintaan IB yang Ditugaskan</h2>
                {/* 🔔 Notifikasi checkup */}
                {checkupRequests.length > 0 && (
                    <section className="section">
                        <h3>Permintaan Checkup Baru</h3>
                        <ul>
                        {checkupRequests.map(req => (
                            <li key={req.id}>
                            Permintaan #{req.id} siap untuk checkup.
                            <Link to={`/petugas/permintaan/${req.id}`}>
                                <button>Detail</button>
                            </Link>
                            </li>
                        ))}
                        </ul>
                    </section>
                    )}

                {/* 🔔 Notifikasi laporan belum diisi */}
                {overdueReports.length > 0 && (
                    <div className="warning-section">
                        <h4 style={{ color: "red" }}>⚠️ Laporan Belum Diisi:</h4>
                        <ul>
                            {overdueReports.map(req => (
                                <li key={req.id}>
                                    Permintaan #{req.id} oleh {req.nama_peternak}
                                    <Link to={`/petugas/permintaan/${req.id}`}>
                                        <button style={{ marginLeft: "10px" }}>Isi Laporan</button>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
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
                        className="search-input"
                    />

                    <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                        <option value="terbaru">Terbaru</option>
                        <option value="terlama">Terlama</option>
                    </select>

                    <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                        <option value="Semua">Semua Status</option>
                        <option value="Diproses">Diproses</option>
                        <option value="Selesai">Selesai</option>
                    </select>

                    <input
                        type="text"
                        placeholder="Cari nama peternak..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>

                {filteredRequests.length === 0 ? (
                    <p>Tidak ada permintaan IB yang ditugaskan.</p>
                ) : (
                    <>
                        <table className="request-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Nama Peternak</th>
                                    <th>Tanggal</th>
                                    <th>Status</th>
                                    <th>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentEntries.map((req) => (
                                    <tr key={req.id}>
                                        <td>#{req.id}</td>
                                        <td>{req.nama_peternak}</td>
                                        <td>{new Date(req.tanggal).toLocaleDateString("id-ID")}</td>
                                        <td>
                                            <span className={`status-badge ${req.status.toLowerCase().replace(/\s+/g, '-')}`}>
                                                {req.status}
                                            </span>
                                        </td>
                                        <td>
                                            <Link to={`/petugas/permintaan/${req.id}`}>
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
                    </>
                )}
            </div>
        </div>
    );
};

export default DashboardPetugas;
