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

    //untuk vitur verifikasi
    const [showVerifikasiModal, setShowVerifikasiModal] = useState(false);
    const [showTolakModal, setShowTolakModal] = useState(false);
    const [petugasList, setPetugasList] = useState([]);
    const [selectedPetugasId, setSelectedPetugasId] = useState("");
    const [catatanTolak, setCatatanTolak] = useState("");

    const [showGantiModal, setShowGantiModal] = useState(false);
    const [newPetugasId, setNewPetugasId] = useState("");

    const isRequestTimeout = (verifikasiAt) => {
        if (!verifikasiAt) return false;
        const now = new Date();
        const verifTime = new Date(verifikasiAt);
        const diff = (now - verifTime) / 1000 / 60; // menit
        return diff > 30;
        };

    const openVerifikasiModal = async () => {
        console.log("Memanggil modal...");
        try {
            const res = await axios.get("http://localhost:5000/api/requests/petugas/list");
            console.log("Data petugas:", res.data);
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
            alert("Permintaan berhasil diverifikasi");
            window.location.reload();
        } catch (err) {
            console.error("Gagal verifikasi permintaan:", err);
            alert("Terjadi kesalahan saat verifikasi");
        }
    };

    const handleTolak = async () => {
        try {
            await axios.put(`http://localhost:5000/api/requests/${id}/reject`, {
                catatan: catatanTolak,
            });
            alert("Permintaan ditolak");
            setShowTolakModal(false);
            window.location.reload();
        } catch (error) {
            console.error("Gagal menolak permintaan:", error);
        }
    };

    const handleGantiPetugas = async () => {
        try {
            await axios.put(`http://localhost:5000/api/requests/${id}/ganti-petugas`, {
            petugas_id: newPetugasId,
            });
            alert("Petugas berhasil diganti");
            window.location.reload();
        } catch (err) {
            console.error("Gagal mengganti petugas:", err);
            alert("Terjadi kesalahan");
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
            {(request.status === "Menunggu Verifikasi" || 
                (request.status === "Diproses" && !request.proses_at && isRequestTimeout(request.verifikasi_at))) && (
                <div className="actions">
                    {request.status === "Menunggu Verifikasi" && (
                    <>
                        <button className="verify-btn" onClick={openVerifikasiModal}>Verifikasi</button>
                        <button className="reject-btn" onClick={() => setShowTolakModal(true)}>Tolak</button>
                    </>
                    )}
                    {request.status === "Diproses" && !request.proses_at && isRequestTimeout(request.verifikasi_at) && (
                    <button className="verify-btn" onClick={() => setShowGantiModal(true)}>
                        Ganti Petugas
                    </button>
                    )}
                </div>
                )}

                {request.status === "Menunggu Check-up" && (
                    <div className="actions">
                        <button className="verify-btn" onClick={() => setShowCheckupModal(true)}>
                        Tugaskan Petugas Check-up
                        </button>
                    </div>
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
            {request.laporan_text && (
                <section className="section">
                    <h3>Laporan dari Petugas</h3>
                    <p>{request.laporan_text}</p>
                </section>
                )}

        </div>
        {/* Modal Verifikasi */}
            {showVerifikasiModal && (
            <div className="modal-overlay">
                <div className="modal">
                    <h3>Pilih Petugas</h3>
                    <select value={selectedPetugasId} onChange={(e) => setSelectedPetugasId(e.target.value)}>
                        <option value="">-- Pilih Petugas --</option>
                        {petugasList.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                    <div className="modal-actions">
                        <button onClick={handleVerifikasi} disabled={!selectedPetugasId}>Verifikasi</button>
                        <button onClick={() => setShowVerifikasiModal(false)}>Batal</button>
                    </div>
                </div>
            </div>
            )}

            {/* Modal Tolak */}
                {showTolakModal && (
                <div className="modal-overlay">
                    <div className="modal">
                    <h3>Alasan Penolakan</h3>
                    <textarea
                        value={catatanTolak}
                        onChange={(e) => setCatatanTolak(e.target.value)}
                        placeholder="Tulis catatan untuk peternak..."
                        rows={4}
                        style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
                    />
                    <div className="modal-actions">
                        <button onClick={handleTolak}>Tolak</button>
                        <button onClick={() => setShowTolakModal(false)}>Batal</button>
                    </div>
                    </div>
                </div>
                )}
            
            {/* Modal ganti petugas */}
            {showGantiModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h3>Ganti Petugas</h3>
                        <select value={newPetugasId} onChange={(e) => setNewPetugasId(e.target.value)}>
                        <option value="">-- Pilih Petugas --</option>
                        {petugasList.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                        </select>
                        <div className="modal-actions">
                        <button
                            onClick={handleGantiPetugas}
                            disabled={!newPetugasId}
                        >
                            Ganti
                        </button>
                        <button onClick={() => setShowGantiModal(false)}>Batal</button>
                        </div>
                    </div>
                    </div>
                )}

        </div>
    );
    
};


export default DetailRequest;
