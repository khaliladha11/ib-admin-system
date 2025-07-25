import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import Navbar from "../components/Navbar";
import "../styles/DetailRequest.css";
import Swal from 'sweetalert2';
import { FcSurvey, FcManager, FcViewDetails, FcVoicePresentation, FcInfo } from "react-icons/fc";

const DetailRequest = () => {
    const { id } = useParams();
    const [request, setRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState([]);
    const petugasId = parseInt(sessionStorage.getItem("userId"));

    const [laporan, setLaporan] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isProsesDimulai, setIsProsesDimulai] = useState(false);
    const [laporanCheckup, setLaporanCheckup] = useState("");
    const [checkups, setCheckups] = useState([]);

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

    const fetchCheckups = async () => {
        try {
        const res = await axios.get(`http://localhost:5000/api/requests/${id}/checkups`);
        setCheckups(res.data);
        } catch (err) {
        console.error("Gagal mengambil data checkup:", err);
        }
    };

    useEffect(() => {
        fetchDetail();
        fetchLogs();
        fetchCheckups();
    }, [id]);

    useEffect(() => {
        const fetchCheckups = async () => {
            try {
                const res = await axios.get(`http://localhost:5000/api/requests/${id}/checkups`);
                setCheckups(res.data);
            } catch (err) {
                console.error("Gagal mengambil data checkup:", err);
            }
        };
        fetchCheckups();
    }, [id]);


    const handleProsesIB = async () => {
        try {
            await axios.put(`http://localhost:5000/api/requests/petugas/${id}/proses`);
            setIsProsesDimulai(true);
            Swal.fire({
                icon: 'success',
                title: 'Proses IB Dimulai',
                text: 'Proses IB sudah dimulai.'
            });
            fetchDetail();
        } catch (error) {
            console.error("Gagal memulai proses IB:", error);
            Swal.fire({
                icon: 'error',
                title: 'Gagal',
                text: 'Tidak dapat memulai proses IB.'
            });
        }
    };

    const handleSubmitLaporan = async () => {
        setIsSubmitting(true);
        try {
            await axios.put(`http://localhost:5000/api/requests/petugas/${id}/laporan`, {
                isi_laporan: laporan,
            });
            Swal.fire({
                icon: 'success',
                title: 'Laporan Terkirim',
                text: 'Laporan berhasil dikirim.'
            });
            fetchDetail();
            fetchLogs();
        } catch (err) {
            console.error("Gagal mengirim laporan:", err);
            Swal.fire({
                icon: 'error',
                title: 'Gagal',
                text: 'Terjadi kesalahan saat mengirim laporan.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleKonfirmasiCheckup = async (checkupId) => {
        try {
            await axios.put(`http://localhost:5000/api/checkups/${checkupId}/confirm`);
            Swal.fire({
                icon: 'success',
                title: 'Checkup Dikonfirmasi',
                text: 'Checkup telah berhasil dikonfirmasi.'
            });
            fetchDetail();
            fetchCheckups();
        } catch (err) {
            console.error("Gagal konfirmasi checkup:", err);
            Swal.fire({
                icon: 'error',
                title: 'Gagal',
                text: 'Gagal mengkonfirmasi checkup.'
            });
        }
    };

    const handleSubmitCheckup = async (checkupId) => {
        try {
            await axios.put(`http://localhost:5000/api/checkups/${checkupId}/submit`, {
                laporan: laporanCheckup,
            });
            Swal.fire({
                icon: 'success',
                title: 'Laporan Checkup',
                text: 'Laporan checkup berhasil dikirim.'
            });
            fetchDetail();
            fetchLogs();
            fetchCheckups();
        } catch (err) {
            console.error("Gagal mengirim laporan checkup:", err);
            Swal.fire({
                icon: 'error',
                title: 'Gagal',
                text: 'Terjadi kesalahan saat mengirim laporan checkup.'
            });
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
                <h3><FcManager/> Petugas yang Ditugaskan</h3>
                <p><strong>Nama Petugas:</strong> {request.nama_petugas}</p>
            </section>
            )}

            <section className="section">
            <h3><FcViewDetails/> Data Peternak</h3>
            <p><strong>User ID:</strong> {request.user_id}</p>
            <p><strong>Nama Peternak:</strong> {request.nama_peternak}</p>
            </section>

            <section className="section">
            <h3><FcViewDetails/> Detail Permintaan</h3>
            <p><strong>Jenis IB:</strong> {request.jenis_ib}</p>
            <p><strong>Jumlah Ternak:</strong> {request.jumlah_ternak}</p>
            <p><strong>Lokasi:</strong>{" "}
                <a
                href={`https://www.google.com/maps?q=${request.latitude},${request.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                >
                Lihat di Google Maps
                </a>
            </p>
            </section>

            <section className="section">
            {/* Proses IB */}
            {request.status === "Diproses" && (!request.proses_at && !isProsesDimulai) && (
                <button className="verify-btn" onClick={handleProsesIB}>
                Mulai Proses IB
                </button>
            )}

            {(request.proses_at || isProsesDimulai) && !request.laporan_terisi && (
                <div>
                <h3><FcManager/> Form Laporan IB</h3>
                <textarea
                    placeholder="Isi laporan IB..."
                    rows={4}
                    style={{ width: "100%", padding: "10px" }}
                    value={laporan}
                    onChange={(e) => setLaporan(e.target.value)}
                />
                <button
                    onClick={handleSubmitLaporan}
                    disabled={isSubmitting || laporan.trim() === ""}
                    className="detail-btnflag"
                >
                    Kirim Laporan
                </button>
                </div>
            )}
            </section>

            {/* Checkup Section */}
            {checkups.map((c) => (
            <section className="section" key={c.id}>
                <h3><FcSurvey/> {c.tipe}</h3>
                <p><strong>Status: </strong>{c.status}</p>
                <p><strong>Petugas:</strong> {c.nama_petugas}</p>
                    {c.status === "Belum Dikonfirmasi" && c.petugas_id === petugasId && (
                        <section key={c.id} className="section">
                            <p>Checkup: {c.jenis}</p>
                            <button className="verify-btn" onClick={() => handleKonfirmasiCheckup(c.id)}>
                                Konfirmasi Checkup
                            </button>
                        </section>
                    )}
                {c.petugas_id === petugasId && c.status === "Dikonfirmasi" && (
                <div>
                    <h4><FcManager/> Form Laporan Checkup</h4>
                    <textarea
                    value={laporanCheckup}
                    onChange={(e) => setLaporanCheckup(e.target.value)}
                    placeholder="Isi laporan checkup..."
                    rows={4}
                    style={{ width: "100%", padding: "10px" }}
                    />
                    <button
                    onClick={() => handleSubmitCheckup(c.id)}
                    disabled={!laporanCheckup.trim()}
                    >
                    Kirim Laporan Checkup
                    </button>
                </div>
                )}
                    {c.laporan && (
                        <section className="section">
                            <h3>Laporan: {c.tipe}</h3>
                            <p>{c.laporan}</p>
                        </section>
                    )}
            </section>
            ))}

            {request.laporan_ib_text && (
                <section className="section">
                    <h3><FcManager/> Laporan Proses IB (oleh Petugas)</h3>
                    <p>{request.laporan_ib_text}</p>
                    <p><span className="status-badge selesai">Tahap IB Awal Selesai</span></p>
                </section>
            )}

            {request.laporan_ib_status && (
                <section className="section">
                    <h3><FcVoicePresentation/> Laporan Keberhasilan / Gagal IB dari Peternak</h3>
                    <p><strong>Status:</strong> {request.laporan_ib_status}</p>
                    <p>{request.laporan_ib_text}</p>
                </section>
            )}

            {request.status === "Gagal" && request.laporan_peternak_text && (
                <section className="section">
                    <h3><FcVoicePresentation/> Laporan Keguguran dari Peternak</h3>
                    <p>{request.laporan_peternak_keguguran}</p>
                </section>
            )}

                {request.laporan_peternak_kelahiran && (
                <section className="section">
                    <h3><FcVoicePresentation/> Laporan Kehamilan dari Peternak</h3>
                    <p>{request.laporan_peternak_kelahiran}</p>
                </section>
            )}

            <section className="section">
            <h3><FcInfo/> Log Aktivitas</h3>
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
        </div>
        </div>
    );
};

export default DetailRequest;
