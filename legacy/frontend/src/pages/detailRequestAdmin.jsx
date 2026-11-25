import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import Navbar from "../components/Navbar";
import "../styles/DetailRequest.css";
import { FcSurvey, FcManager, FcViewDetails, FcVoicePresentation, FcInfo } from "react-icons/fc";
import Swal from 'sweetalert2';

const DetailRequest = () => {
    const { id } = useParams();
    const [request, setRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState([]);
    const [checkups, setCheckups] = useState([]);

    // state untuk modal dan data
    const [showVerifikasiModal, setShowVerifikasiModal] = useState(false);
    const [showTolakModal, setShowTolakModal] = useState(false);
    const [petugasList, setPetugasList] = useState([]);
    const [selectedPetugasId, setSelectedPetugasId] = useState("");
    const [catatanTolak, setCatatanTolak] = useState("");
    const [showGantiModal, setShowGantiModal] = useState(false);
    const [newPetugasId, setNewPetugasId] = useState("");
    const [showCheckupModal, setShowCheckupModal] = useState(false);
    const [selectedCheckupType, setSelectedCheckupType] = useState('');
    const [selectedCheckupPetugas, setSelectedCheckupPetugas] = useState('');


    const isRequestTimeout = (verifikasiAt) => {
        if (!verifikasiAt) return false;
        const now = new Date();
        const verifTime = new Date(verifikasiAt);
        const diff = (now - verifTime) / 1000 / 60;
        return diff > 30;
    };

    const openVerifikasiModal = async () => {
        try {
        const res = await axios.get("http://localhost:5000/api/requests/petugas/list");
        setPetugasList(res.data);
        setShowVerifikasiModal(true);
        } catch (error) {
        console.error("Gagal mengambil daftar petugas:", error);
        }
    };

const handleVerifikasi = async () => {
    try {
        await axios.put(`http://localhost:5000/api/requests/${id}/verify`, {
            petugas_id: selectedPetugasId,
        });
        Swal.fire({
            icon: 'success',
            title: 'Berhasil Diverifikasi',
            text: 'Permintaan berhasil diverifikasi',
        }).then(() => {
            // reload hanya setelah user klik OK
            window.location.reload();
        });
    } catch (err) {
        console.error("Gagal verifikasi permintaan:", err);
        Swal.fire({
            icon: 'error',
            title: 'Oops...',
            text: 'Terjadi kesalahan saat verifikasi',
        });
    }
};


    const handleTolak = async () => {
        try {
            await axios.put(`http://localhost:5000/api/requests/${id}/reject`, {
                catatan: catatanTolak,
            });
            Swal.fire({
                icon: 'success',
                title: 'Permintaan Ditolak',
                text: 'Permintaan berhasil ditolak.',
            }).then(() => {
                setShowTolakModal(false);
                window.location.reload();
            });
        } catch (error) {
            console.error("Gagal menolak permintaan:", error);
            Swal.fire({
                icon: 'error',
                title: 'Oops...',
                text: 'Terjadi kesalahan saat menolak permintaan.',
            });
        }
    };


    const handleGantiPetugas = async () => {
        try {
            await axios.put(`http://localhost:5000/api/requests/${id}/ganti-petugas`, {
                petugas_id: newPetugasId,
            });
            Swal.fire({
                icon: 'success',
                title: 'Petugas Diganti',
                text: 'Petugas berhasil diganti.',
            }).then(() => {
                window.location.reload();
            });
        } catch (err) {
            console.error("Gagal mengganti petugas:", err);
            Swal.fire({
                icon: 'error',
                title: 'Oops...',
                text: 'Terjadi kesalahan saat mengganti petugas.',
            });
        }
    };


    const handleTugaskanCheckup = (tipe) => {
        setSelectedCheckupType(tipe);
        setShowCheckupModal(true);
    };

    const submitCheckupAssignment = async () => {
        if (!selectedCheckupPetugas || !selectedCheckupType) {
            Swal.fire({
                icon: 'warning',
                title: 'Data Tidak Lengkap',
                text: 'Pilih petugas dan tipe checkup terlebih dahulu.'
            });
            return;
        }
        try {
            const res = await axios.post(`http://localhost:5000/api/requests/${id}/checkup/assign`, {
                tipe: selectedCheckupType,
                petugas_id: selectedCheckupPetugas
            });
        if (res.status === 200 || res.status === 201) {
                Swal.fire({
                    icon: 'success',
                    title: 'Checkup Ditugaskan',
                    text: 'Checkup berhasil ditugaskan.'
                }).then(() => {
                    setShowCheckupModal(false);
                    setSelectedCheckupPetugas('');
                    setSelectedCheckupType('');
                });
        } else {
                throw new Error("Respon tidak berhasil");
            }
        } catch (err) {
            console.error("Gagal menugaskan checkup:", err);
            Swal.fire({
                icon: 'error',
                title: 'Gagal',
                text: 'Gagal menugaskan checkup.'
            });
        }
        try {
            await fetchCheckups();
        } catch (fetchErr) {
            console.warn("Gagal refresh data checkup (tidak fatal):", fetchErr);
        }
    };


    //reminder
    const kirimReminder = async (jenis) => {
        try {
            await axios.post(`http://localhost:5000/api/requests/${id}/reminder`, { jenis });
            Swal.fire({
                icon: 'success',
                title: 'Berhasil!',
                text: `Reminder laporan ${jenis} telah dikirim ke peternak.`,
                confirmButtonColor: '#3085d6'
            });
        } catch (err) {
            console.error("Gagal mengirim reminder:", err);
            Swal.fire({
                icon: 'error',
                title: 'Oops...',
                text: 'Gagal mengirim reminder.'
            });
        }
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
            {/* Header Utama */}
            <div className="header">
                    <div className="header-info">
                        <h2>Detail Permintaan #{request.id}</h2>
                        <p>Tanggal Pengajuan: {new Date(request.tanggal).toLocaleDateString('id-ID')}</p>
                    </div>
                    <span className={`status-badge ${request.status.toLowerCase().replace(/\s+/g, '-')}`}>
                        {request.status}
                    </span>
                </div>

            {/* Aksi Utama Admin */}
                {request.status === "Menunggu Verifikasi" && (
                    <div className="actions-panel">
                        <button className="verify-btn" onClick={openVerifikasiModal}>Verifikasi & Tugaskan</button>
                        <button className="reject-btn" onClick={() => setShowTolakModal(true)}>Tolak Permintaan</button>
                    </div>
                )}
                    {request.status === "Diproses" && !request.proses_at && isRequestTimeout(request.verifikasi_at) && (
                    <div className="actions-panel">
                        <button className="verify-btn" onClick={() => setShowGantiModal(true)}>Ganti Petugas (Belum Merespon)</button>
                    </div>
                )}

                {/* Notifikasi Reminder */}
                {request.flag_laporan_ib && (
                    <div className="warning-section">
                        ⚠️ Peternak belum mengirimkan laporan hasil IB awal.
                        <button className="detail-btnflag" onClick={() => kirimReminder("IB")}>
                            Ingatkan Peternak
                        </button>
                    </div>
                )}
                {request.flag_laporan_kelahiran && (
                    <div className="warning-section">
                        ⚠️ Peternak belum mengirimkan laporan kelahiran.
                        <button className="detail-btnflag" onClick={() => kirimReminder("Kelahiran")}>
                            Ingatkan Peternak
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

                        {request.status === "Gagal" && request.laporan_peternak_kematian && (
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
                            {checkups.map(c => (
                                <div key={c.id} className="checkup-box">
                                    <h4>{c.tipe}</h4>
                                    <p><strong>Petugas:</strong> {c.nama_petugas || 'Belum ditugaskan'}</p>
                                    <p><strong>Status:</strong> {c.status}</p>
                                    {c.laporan && <p className="laporan-text"><strong>Laporan:</strong> {c.laporan}</p>}
                                    {(c.petugas_id == null && c.status === "Menunggu Penugasan") && (
                                        <button className="verify-btn" onClick={() => handleTugaskanCheckup(c.tipe)}>
                                            Tugaskan Petugas
                                        </button>
                                    )}
                                </div>
                            ))}
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

            {/* Modals */}
            {showVerifikasiModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h3>Pilih Petugas</h3>
                        <select value={selectedPetugasId} onChange={(e) => setSelectedPetugasId(e.target.value)}>
                            <option value="">-- Pilih Petugas --</option>
                            {petugasList.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                        </select>
                        <div className="modal-actions">
                            <button onClick={handleVerifikasi} disabled={!selectedPetugasId}>Verifikasi</button>
                            <button onClick={() => setShowVerifikasiModal(false)}>Batal</button>
                        </div>
                    </div>
                </div>
            )}
            {showTolakModal && (
                 <div className="modal-overlay">
                    <div className="modal">
                        <h3>Alasan Penolakan</h3>
                        <textarea value={catatanTolak} onChange={(e) => setCatatanTolak(e.target.value)} placeholder="Tulis catatan untuk peternak..." rows={4}/>
                        <div className="modal-actions">
                            <button onClick={handleTolak}>Tolak</button>
                            <button onClick={() => setShowTolakModal(false)}>Batal</button>
                        </div>
                    </div>
                </div>
            )}
            {showGantiModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h3>Ganti Petugas</h3>
                        <select value={newPetugasId} onChange={(e) => setNewPetugasId(e.target.value)}>
                            <option value="">-- Pilih Petugas --</option>
                            {petugasList.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                        </select>
                        <div className="modal-actions">
                            <button onClick={handleGantiPetugas} disabled={!newPetugasId}>Ganti</button>
                            <button onClick={() => setShowGantiModal(false)}>Batal</button>
                        </div>
                    </div>
                </div>
            )}
            {showCheckupModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h3>Tugaskan Petugas untuk {selectedCheckupType}</h3>
                        <select value={selectedCheckupPetugas} onChange={(e) => setSelectedCheckupPetugas(e.target.value)}>
                            <option value="">-- Pilih Petugas --</option>
                            {petugasList.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                        </select>
                        <div className="modal-actions">
                            <button onClick={submitCheckupAssignment} disabled={!selectedCheckupPetugas}>Tugaskan</button>
                            <button onClick={() => setShowCheckupModal(false)}>Batal</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DetailRequest;