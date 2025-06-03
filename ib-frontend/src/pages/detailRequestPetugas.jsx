import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import Navbar from "../components/Navbar";
import "../styles/DetailRequest.css";

const DetailRequest = () => {

    const { id } = useParams();
    const [request, setRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    
    //log aktivitas
    const [logs, setLogs] = useState([]);

    const [laporan, setLaporan] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isProsesDimulai, setIsProsesDimulai] = useState(false);

    const handleProsesIB = async () => {
    try {
        await axios.put(`http://localhost:5000/api/requests/petugas/${id}/proses`);
        setIsProsesDimulai(true); // langsung aktifkan tampilan form laporan
        alert("Proses IB dimulai.");
        // update tampilan tanpa reload
        setRequest(prev => ({ ...prev, proses_at: new Date().toISOString() }));
    } catch (err) {
        console.error("Gagal memulai proses IB:", err);
        alert("Gagal memulai proses IB.");
    }
    };

    const handleSubmitLaporan = async () => {
    setIsSubmitting(true);
    try {
        await axios.put(`http://localhost:5000/api/requests/petugas/${id}/laporan`, {
        isi_laporan: laporan,
        });
        alert("Laporan berhasil dikirim");
        window.location.reload();
    } catch (err) {
        console.error("Gagal mengirim laporan:", err);
        alert("Terjadi kesalahan saat mengirim laporan");
    }
    setIsSubmitting(false);
    };


    useEffect(() => {
    const fetchRequest = async () => {
            try {
                const res = await axios.get(`http://localhost:5000/api/requests/${id}`);
                setRequest(res.data);
                setLoading(false);
            } catch (error) {
                console.error("Gagal mengambil detail permintaan:", error);
            }
        };

        const fetchPetugas = async () => {
            try {
                const res = await axios.get(`http://localhost:5000/api/requests/petugas/list`);
                setPetugasList(res.data);
            } catch (err) {
                console.error("Gagal mengambil daftar petugas:", err);
            }
        };

        fetchRequest();
        fetchPetugas();
        }, [id]);

        useEffect(() => {
            const fetchRequest = async () => {
                try {
                const res = await axios.get(`http://localhost:5000/api/requests/${id}`);
                setRequest(res.data);
                setLoading(false);
                } catch (error) {
                console.error("Gagal mengambil detail permintaan:", error);
                }
            };

            const fetchLogs = async () => {
                try {
                const res = await axios.get(`http://localhost:5000/api/requests/${id}/logs`);
                setLogs(res.data);
                } catch (error) {
                console.error("Gagal mengambil log aktivitas:", error);
                }
            };

            fetchRequest();
            fetchLogs();
            }, [id]);

        //log aktivitas
        useEffect(() => {
            const fetchLogs = async () => {
                try {
                    const res = await axios.get(`http://localhost:5000/api/requests/${id}/logs`);
                    setLogs(res.data);
                } catch (err) {
                    console.error("Gagal mengambil log aktivitas:", err);
                }
            };
            fetchLogs();
        }, [id]);

    if (loading) return <p>Loading...</p>;
    if (!request) return <p>Data tidak ditemukan</p>;
    
    
    return (
        <div>
            <Navbar />
            <div className="detail-container">

            <div className="header">
                <h2>Permintaan: {request.id}</h2>
                <h2>Tanggal: {new Date(request.tanggal).toLocaleDateString()}</h2>
                <span className={`status-badge ${request.status.toLowerCase().replace(/\s+/g, '-')}`}>
                Status: {request.status}
                </span>
            </div>

            {request.nama_petugas && (
                <section className="section">
                <h3>Petugas yang Ditugaskan</h3>
                <p><strong>Nama Petugas:</strong> {request.nama_petugas}</p>
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

            {/* TOMBOL AKSI PETUGAS */}
            <section className="section">
                {/* Tombol hanya muncul jika status "Diproses" dan belum ada proses_at */}
                {request.status === "Diproses" && (!request.proses_at && !isProsesDimulai) && (
                    <button
                    className="verify-btn"
                    onClick={handleProsesIB}
                    >
                    Mulai Proses IB
                    </button>
                )}

                {/* Form laporan muncul jika proses_at sudah ada atau tombol ditekan */}
                {(request.proses_at || isProsesDimulai) && !request.laporan_terisi && (
                    <div>
                    <h3>Form Laporan IB</h3>
                    <textarea
                        placeholder="Isi laporan IB..."
                        rows={4}
                        style={{ width: '100%', padding: '10px' }}
                        value={laporan}
                        onChange={(e) => setLaporan(e.target.value)}
                    />
                    <button
                        onClick={handleSubmitLaporan}
                        disabled={isSubmitting || laporan.trim() === ''}
                    >
                        Kirim Laporan
                    </button>
                    </div>
                )}
                </section>

            <section className="section">
                <h3>Log Aktivitas</h3>
                {logs.length > 0 ? (
                <ul>
                    {logs.map((log) => (
                    <li key={log.id}>
                        <strong>{new Date(log.waktu).toLocaleString('id-ID')}</strong>: {log.deskripsi}
                    </li>
                    ))}
                </ul>
                ) : (
                <p>Belum ada aktivitas.</p>
                )}
            </section>

            </div>
        </div>
        );

    
};


export default DetailRequest;
