// File: detailRequestPetugas.jsx

import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import Navbar from "../components/Navbar";
import "../styles/DetailRequest.css"; // Menggunakan file CSS yang sama dengan admin
import Swal from 'sweetalert2';
import { FcSurvey, FcManager, FcViewDetails, FcInfo, FcVoicePresentation } from "react-icons/fc";

const DetailRequestPetugas = () => {
    const { id } = useParams();
    const [request, setRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState([]);
    const [checkups, setCheckups] = useState([]);
    const petugasId = parseInt(sessionStorage.getItem("userId"));

    // State untuk form laporan
    const [laporanIB, setLaporanIB] = useState("");
    const [laporanCheckup, setLaporanCheckup] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isProsesDimulai, setIsProsesDimulai] = useState(false);

    // Fetch data functions
    const fetchAllData = async () => {
        // Tidak set loading di sini agar tidak berkedip saat refresh
        try {
            const [requestRes, logsRes, checkupsRes] = await Promise.all([
                axios.get(`http://localhost:5000/api/requests/${id}`),
                axios.get(`http://localhost:5000/api/requests/${id}/logs`),
                axios.get(`http://localhost:5000/api/requests/${id}/checkups`)
            ]);
            setRequest(requestRes.data);
            setLogs(logsRes.data);
            setCheckups(checkupsRes.data);
        } catch (error) {
            console.error("Gagal memuat data:", error);
            Swal.fire('Gagal', 'Tidak dapat memuat data permintaan.', 'error');
        } finally {
            setLoading(false); // Set loading false setelah semua fetch selesai
        }
    };

    useEffect(() => {
        setLoading(true); // Hanya set loading di awal
        fetchAllData();
    }, [id]);

    // Handlers
    const handleProsesIB = async () => {
        try {
            await axios.put(`http://localhost:5000/api/requests/petugas/${id}/proses`);
            Swal.fire('Berhasil', 'Proses IB telah dimulai.', 'success');
            setIsProsesDimulai(true);
            fetchAllData();
        } catch (error) {
            console.error("Gagal memulai proses IB:", error);
            Swal.fire('Gagal', 'Tidak dapat memulai proses IB.', 'error');
        }
    };

    const handleSubmitLaporanIB = async () => {
        setIsSubmitting(true);
        try {
            await axios.put(`http://localhost:5000/api/requests/petugas/${id}/laporan`, { isi_laporan: laporanIB });
            Swal.fire('Berhasil', 'Laporan IB berhasil dikirim.', 'success');
            fetchAllData();
        } catch (err) {
            console.error("Gagal mengirim laporan:", err);
            Swal.fire('Gagal', 'Terjadi kesalahan saat mengirim laporan.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleKonfirmasiCheckup = async (checkupId) => {
        try {
            await axios.put(`http://localhost:5000/api/checkups/${checkupId}/confirm`);
            Swal.fire('Berhasil', 'Checkup telah dikonfirmasi.', 'success');
            fetchAllData();
        } catch (err) {
            console.error("Gagal konfirmasi checkup:", err);
            Swal.fire('Gagal', 'Gagal mengkonfirmasi checkup.', 'error');
        }
    };

    const handleSubmitCheckup = async (checkupId) => {
        setIsSubmitting(true);
        try {
            await axios.put(`http://localhost:5000/api/checkups/${checkupId}/submit`, { laporan: laporanCheckup });
            Swal.fire('Berhasil', 'Laporan checkup berhasil dikirim.', 'success');
            setLaporanCheckup(""); // Reset form
            fetchAllData();
        } catch (err) {
            console.error("Gagal mengirim laporan checkup:", err);
            Swal.fire('Gagal', 'Terjadi kesalahan saat mengirim laporan checkup.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <p className="loading-text">Memuat data tugas...</p>;
    if (!request) return <p className="loading-text">Data tidak ditemukan.</p>;

    const isPetugasIB = request.petugas_id === petugasId;

    return (
        <div>
            <Navbar />
            <div className="detail-container">
                {/* Header Utama */}
                <div className="header">
                    <div className="header-info">
                        <h2>Detail Tugas #{request.id}</h2>
                        <p>Tanggal Pengajuan: {new Date(request.tanggal).toLocaleDateString('id-ID')}</p>
                    </div>
                    <span className={`status-badge ${request.status.toLowerCase().replace(/\s+/g, '-')}`}>
                        {request.status}
                    </span>
                </div>

                {/* Panel Aksi Petugas */}
                {isPetugasIB && request.status === "Diproses" && !request.proses_at && !isProsesDimulai && (
                    <div className="actions-panel">
                        <button className="verify-btn" onClick={handleProsesIB}>
                            Mulai Proses IB
                        </button>
                    </div>
                )}

                {/* Grid untuk Informasi */}
                <div className="info-grid">
                    {/* Kolom Kiri */}
                    <div className="info-column">
                        <section className="section">
                            <h3><FcViewDetails /> Data Peternak</h3>
                            <p><strong>User ID:</strong> {request.user_id}</p>
                            <p><strong>Nama Peternak:</strong> {request.nama_peternak}</p>
                        </section>

                        <section className="section">
                            <h3><FcViewDetails /> Detail Permintaan</h3>
                            <p><strong>Jenis IB:</strong> {request.jenis_ib}</p>
                            <p><strong>Jumlah Ternak:</strong> {request.jumlah_ternak}</p>
                            <p><strong>Lokasi:</strong> <a href={`https://www.google.com/maps?q=${request.latitude},${request.longitude}`} target="_blank" rel="noopener noreferrer">Lihat di Google Maps</a></p>
                        </section>
                        {request.nama_petugas && (
                            <section className="section">
                                <h3><FcManager /> Petugas IB Awal</h3>
                                <p><strong>Nama Petugas:</strong> {request.nama_petugas}</p>
                            </section>
                        )}
                    </div>
                    {/* Kolom Kanan */}
                    <div className="info-column">
                        {/* Form Laporan IB Awal */}
                        {(request.proses_at || isProsesDimulai) && !request.laporan_terisi && isPetugasIB && (
                            <section className="section">
                                <h3><FcSurvey /> Form Laporan IB</h3>
                                <textarea
                                    placeholder="Isi laporan IB..."
                                    rows={4}
                                    value={laporanIB}
                                    onChange={(e) => setLaporanIB(e.target.value)}
                                />
                                <button
                                    onClick={handleSubmitLaporanIB}
                                    disabled={isSubmitting || laporanIB.trim() === ""}
                                    className="verify-btn"
                                    style={{marginTop: '10px', width: '100%'}}
                                >
                                    Kirim Laporan
                                </button>
                            </section>
                        )}
                        
                        {request.laporan_ib_text && (
                            <section className="section">
                                <h3><FcSurvey /> Laporan Proses IB (oleh Petugas)</h3>
                                <p>{request.laporan_ib_text}</p>
                            </section>
                        )}

                        {request.laporan_ib_status && (
                            <section className="section">
                                <h3><FcVoicePresentation /> Laporan Hasil IB (dari Peternak)</h3>
                                <p><strong>Status:</strong> {request.laporan_ib_status}</p>
                                <p>{request.laporan_ib_text}</p>
                            </section>
                        )}

                        {request.laporan_peternak_kelahiran && (
                            <section className="section">
                                <h3><FcVoicePresentation /> Laporan Kelahiran (dari Peternak)</h3>
                                <p>{request.laporan_peternak_kelahiran}</p>
                            </section>
                        )}

                        {request.status === "Gagal" && request.laporan_peternak_keguguran && (
                                <section className="section">
                                <h3><FcVoicePresentation /> Laporan Keguguran (dari Peternak)</h3>
                                <p>{request.laporan_peternak_keguguran}</p>
                            </section>
                        )}

                        {request && request.status === "Gagal" && request.laporan_peternak_kematian && (
                            <section className="section">
                                <h3><FcVoicePresentation /> Laporan Kematian Anak Sapi (dari Peternak)</h3>
                                <p>{request.laporan_peternak_kematian}</p>
                            </section>
                        )}

                    </div>
                </div>

                {/* Riwayat Checkup */}
                {checkups.length > 0 && (
                    <section className="section section-full-width">
                        <h3><FcSurvey /> Riwayat Checkup</h3>
                        <div className="checkup-container">
                            {checkups.map(c => {
                                const isPetugasCheckup = c.petugas_id === petugasId;
                                return (
                                    <div key={c.id} className="checkup-box">
                                        <h4>{c.tipe}</h4>
                                        <p><strong>Petugas:</strong> {c.nama_petugas || 'Belum ditugaskan'}</p>
                                        <p><strong>Status:</strong> {c.status}</p>
                                        
                                        {isPetugasCheckup && c.status === "Belum Dikonfirmasi" && (
                                            <button className="verify-btn" onClick={() => handleKonfirmasiCheckup(c.id)}>
                                                Konfirmasi Checkup
                                            </button>
                                        )}
                                        {isPetugasCheckup && c.status === "Dikonfirmasi" && (
                                            <div style={{marginTop: '15px'}}>
                                                <h5>Form Laporan Checkup</h5>
                                                <textarea
                                                    value={laporanCheckup}
                                                    onChange={(e) => setLaporanCheckup(e.target.value)}
                                                    placeholder={`Isi laporan untuk ${c.tipe}...`}
                                                    rows={4}
                                                />
                                                <button
                                                    onClick={() => handleSubmitCheckup(c.id)}
                                                    disabled={isSubmitting || !laporanCheckup.trim()}
                                                    className="verify-btn"
                                                    style={{width: '100%', marginTop: '10px'}}
                                                >
                                                    Kirim Laporan Checkup
                                                </button>
                                            </div>
                                        )}
                                        {c.laporan && <p className="laporan-text"><strong>Laporan:</strong> {c.laporan}</p>}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Log Aktivitas */}
                <section className="section section-full-width">
                    <h3><FcInfo /> Log Aktivitas</h3>
                    <ul className="log-list">
                        {logs.length > 0 ? logs.map((log) => (
                            <li key={log.id}>
                                <strong>{new Date(log.waktu).toLocaleString('id-ID')}</strong>: {log.deskripsi}
                            </li>
                        )) : <p>Belum ada aktivitas.</p>}
                    </ul>
                </section>
            </div>
        </div>
    );
};

export default DetailRequestPetugas;
