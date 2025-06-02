import React, { useEffect, useState } from "react";
import axios from "axios";
import Navbar from "../components/Navbar";
import { Link } from "react-router-dom";

const DashboardPetugas = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const petugasId = sessionStorage.getItem("userId"); // Simpan ID petugas saat login

    useEffect(() => {
        console.log("ID Petugas:", petugasId); // ← Cek apakah null?
        const fetchRequests = async () => {
        try {
            const res = await axios.get(`http://localhost:5000/api/requests/petugas/${petugasId}/requests`);
            console.log("Data diterima:", res.data); // Tambahkan ini
            setRequests(res.data);
            setLoading(false);
        } catch (err) {
            console.error("Gagal mengambil data permintaan untuk petugas:", err);
            setLoading(false); // Tambahkan ini agar tidak stuck di "Memuat data..."
        }
        };
        fetchRequests();
    }, [petugasId]);

    const filteredRequests = requests.filter(req =>
        req.nama_peternak.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <p>Memuat data...</p>;

    return (
        <div>
        <Navbar />
        <div className="container">
            <h2>Permintaan IB yang Ditugaskan</h2>

            <div className="table-controls">
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
                {filteredRequests.map((req) => (
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
            )}
        </div>
        </div>
    );
};

export default DashboardPetugas;
