import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import Navbar from "../components/Navbar";
import "../styles/DetailRequest.css";

    const DetailRequest = () => {
    const { id } = useParams();
    const [request, setRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState([]);
    const petugasId = parseInt(sessionStorage.getItem("userId")); // ⬅️ Ubah ke integer

    const [laporan, setLaporan] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isProsesDimulai, setIsProsesDimulai] = useState(false);

    const [laporanCheckup, setLaporanCheckup] = useState("");

    const fetchDetail = async () => {
        try {
        const res = await axios.get(`http://localhost:5000/api/requests/${id}`);
        setRequest(res.data);
        } catch (err) {
        console.error("Gagal mengambil detail permintaan:", err);
        } finally {
        setLoading(false);
        }
    };

    const fetchLogs = async () => {
        try {
        const res = await axios.get(`http://localhost:5000/api/requests/${id}/logs`);
        setLogs(res.data);
        } catch (err) {
        console.error("Gagal mengambil log aktivitas:", err);
        }
    };

    useEffect(() => {
        fetchDetail();
        fetchLogs();
    }, [id]);

    const handleProsesIB = async () => {
        try {
        await axios.put(`http://localhost:5000/api/requests/petugas/${id}/proses`);
        setIsProsesDimulai(true);
        alert("Proses IB dimulai");
        fetchDetail();
        } catch (error) {
        console.error("Gagal memulai proses IB:", error);
        }
    };

    const handleSubmitLaporan = async () => {
        setIsSubmitting(true);
        try {
        await axios.put(`http://localhost:5000/api/requests/petugas/${id}/laporan`, {
            isi_laporan: laporan,
        });
        alert("Laporan berhasil dikirim");
        fetchDetail();
        fetchLogs();
        } catch (err) {
        console.error("Gagal mengirim laporan:", err);
        alert("Terjadi kesalahan saat mengirim laporan");
        } finally {
        setIsSubmitting(false);
        }
    };

    const handleKonfirmasiCheckup = async () => {
        try {
        await axios.put(`http://localhost:5000/api/requests/petugas/${id}/checkup/konfirmasi`);
        alert("Checkup dikonfirmasi. Silakan isi laporan checkup.");
        fetchDetail();
        fetchLogs();
        } catch (err) {
        console.error("Gagal konfirmasi checkup:", err);
        }
    };

    const handleSubmitCheckup = async () => {
        try {
        await axios.put(`http://localhost:5000/api/requests/petugas/${id}/checkup/submit`, {
            isi_laporan: laporanCheckup,
        });
        alert("Laporan checkup berhasil dikirim");
        fetchDetail();
        fetchLogs();
        } catch (err) {
        console.error("Gagal mengirim laporan checkup:", err);
        }
    };

    if (loading) return <p>Loading...</p>;
    if (!request) return <p>Data tidak ditemukan</p>;

    return (
        <div>
        <Navbar />
        <div className="detail-container">
            <div className="header">
            <h2>Permintaan: {request.id}</h2>
            <h2>Tanggal: {new Date(request.tanggal).toLocaleDateString()}</h2>
            <span className={`status-badge ${request.status.toLowerCase().replace(/\s+/g, "-")}`}>
                Status: {request.status}
            </span>
            </div>

            {request.nama_petugas && (
            <section className="section">
                <h3>Petugas yang Ditugaskan</h3>
                <p>
                <strong>Nama Petugas:</strong> {request.nama_petugas}
                </p>
            </section>
            )}

            <section className="section">
            <h3>Data Peternak</h3>
            <p><strong>User ID:</strong> {request.user_id}</p>
            <p><strong>Nama Peternak:</strong> {request.nama_peternak}</p>
            </section>

            <section className="section">
            <h3>Detail Permintaan</h3>
            <p><strong>Jenis IB:</strong> {request.jenis_ib}</p>
            <p><strong>Jumlah Ternak:</strong> {request.jumlah_ternak}</p>
            <p>
                <strong>Lokasi:</strong>{" "}
                <a
                href={`https://www.google.com/maps?q=${request.latitude},${request.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                >
                Lihat di Google Maps
                </a>
            </p>
            </section>

            {/* Tombol Proses IB */}
            <section className="section">
            {request.status === "Diproses" &&
                (!request.proses_at && !isProsesDimulai) && (
                <button className="verify-btn" onClick={handleProsesIB}>
                    Mulai Proses IB
                </button>
                )}

            {(request.proses_at || isProsesDimulai) && !request.laporan_terisi && (
                <div>
                <h3>Form Laporan IB</h3>
                <textarea
                    placeholder="Isi laporan IB..."
                    rows={4}
                    style={{ width: "100%", padding: "10px" }}
                    value={laporan}
                    onChange={(e) => setLaporan(e.target.value)}
                />
                <button onClick={handleSubmitLaporan} disabled={isSubmitting || laporan.trim() === ""}>
                    Kirim Laporan
                </button>
                </div>
            )}
            </section>

            {/* Checkup Section */}
            {(request.laporan_terisi && request.checkup_status === "Belum Dikonfirmasi" &&
            request.checkup_petugas_id === petugasId) && (
            <section className="section">
                <button className="verify-btn" onClick={handleKonfirmasiCheckup}>
                Konfirmasi Checkup
                </button>
            </section>
            )}

            {(request.checkup_status === "Dikonfirmasi" && request.checkup_petugas_id === petugasId) && (
            <section className="section">
                <h3>Form Laporan Checkup</h3>
                <textarea
                value={laporanCheckup}
                onChange={(e) => setLaporanCheckup(e.target.value)}
                placeholder="Isi laporan checkup..."
                rows={4}
                style={{ width: "100%", padding: "10px" }}
                />
                <button
                onClick={handleSubmitCheckup}
                disabled={!laporanCheckup.trim()}
                >
                Kirim Laporan Checkup
                </button>
            </section>
            )}

            <section className="section">
            <h3>Log Aktivitas</h3>
            {logs.length > 0 ? (
                <ul>
                {logs.map((log) => (
                    <li key={log.id}>
                    <strong>{new Date(log.waktu).toLocaleString("id-ID")}</strong>: {log.deskripsi}
                    </li>
                ))}
                </ul>
            ) : (
                <p>Belum ada aktivitas.</p>
            )}
            </section>
            {request.laporan_text && (
                <section className="section">
                    <h3>Laporan dari Petugas</h3>
                    <p>{request.laporan_text}</p>
                </section>
                )}
            {request.laporan_checkup_text && (
            <section className="section">
                <h3>Laporan Checkup</h3>
                <p>{request.laporan_checkup_text}</p>
            </section>
            )}
        </div>
        </div>
    );
    };

export default DetailRequest;
