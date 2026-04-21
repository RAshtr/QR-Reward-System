import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const ClaimPage = () => {
    const { qr_id } = useParams();
    const [qrData, setQrData] = useState(null);
    const [status, setStatus] = useState('loading'); // loading, active, processing, redeemed, error
    const [formData, setFormData] = useState({ mobile: '', upi: '' });
    const [txnId, setTxnId] = useState('');

    const API_BASE = "http://localhost:8000";

    useEffect(() => {
        const verifyQR = async () => {
            try {
                const response = await axios.get(`${API_BASE}/claim/${qr_id}`);
                setQrData(response.data);
                setStatus(response.data.is_redeemed ? 'redeemed' : 'active');
            } catch (err) { 
                setStatus('error'); 
            }
        };
        verifyQR();
    }, [qr_id]);

    const handleClaim = async (e) => {
        e.preventDefault();
        
        if (formData.mobile.length !== 10 || !formData.upi.includes('@')) {
            return alert("Please enter a valid 10-digit number and UPI ID");
        }

        setStatus('processing');

        try {
            const response = await axios.post(`${API_BASE}/redeem/${qr_id}`, null, {
                params: {
                    mobile: formData.mobile,
                    upi: formData.upi
                }
            });

            if (response.data.status === "Success") {
                setTxnId(response.data.transaction_id);
                setStatus('redeemed');
            } else {
                // If backend returns "Limit Exceeded", we stop processing immediately
                alert(response.data.message);
                setStatus('active'); 
            }

        } catch (err) {
            console.error("Redeem Error:", err);
            const errorMessage = err.response?.data?.detail || "Payment Failed. Try again.";
            alert(errorMessage);
            setStatus('active'); // Ensure we return to form on error
        }
    };

    if (status === 'loading') return <div style={containerStyle}>Verifying Reward...</div>;
    if (status === 'error') return <div style={containerStyle}>Invalid or Expired QR Code.</div>;

    return (
        <div style={containerStyle}>
            {/* Inline CSS for Spinner Animation */}
            <style>
                {`
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                `}
            </style>

            <div style={cardStyle}>
                {status === 'active' && (
                    <div style={{animation: 'fadeIn 0.5s'}}>
                        <h3 style={{color: '#7f8c8d', margin: 0}}>You've Unlocked</h3>
                        <h1 style={{fontSize: '50px', color: '#27ae60', margin: '10px 0'}}>₹{qrData?.amount}</h1>
                        <p style={{color: '#34495e'}}>Enter details to receive payment instantly</p>
                        <form onSubmit={handleClaim} style={formStyle}>
                            <input type="number" placeholder="Mobile Number" style={inputStyle} onChange={e => setFormData({...formData, mobile: e.target.value})} required />
                            <input type="text" placeholder="UPI ID (e.g. 9876543210@ybl)" style={inputStyle} onChange={e => setFormData({...formData, upi: e.target.value})} required />
                            <button type="submit" style={claimButton}>Claim to Bank Account</button>
                        </form>
                    </div>
                )}

                {status === 'processing' && (
                    <div style={{textAlign: 'center', padding: '20px', animation: 'fadeIn 0.3s'}}>
                        <div style={spinnerStyle}></div>
                        <h3 style={{marginTop: '20px', color: '#3498db'}}>Processing Payout...</h3>
                        <p style={{fontSize: '14px', color: '#666'}}>Please wait, contacting bank servers...</p>
                    </div>
                )}

                {status === 'redeemed' && (
                    <div style={{animation: 'fadeIn 0.5s'}}>
                        <div style={successIcon}>✓</div>
                        <h2 style={{color: '#2c3e50'}}>Payment Successful!</h2>
                        <p style={{color: '#27ae60', fontWeight: 'bold', fontSize: '20px'}}>₹{qrData?.amount} Sent</p>
                        <div style={receiptBox}>
                            <p style={receiptLine}><span>Status:</span> <span style={{color: 'green'}}>Success</span></p>
                            <p style={receiptLine}><span>Txn ID:</span> <span>{txnId}</span></p>
                            <p style={receiptLine}><span>To:</span> <span>{formData.mobile}</span></p>
                        </div>
                        <button onClick={() => window.location.href = '/'} style={closeButton}>Done</button>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- STYLES (Cleaned Up) ---
const containerStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f0f2f5', padding: '20px' };
const cardStyle = { backgroundColor: '#fff', padding: '40px', borderRadius: '24px', textAlign: 'center', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', maxWidth: '400px', width: '100%' };
const formStyle = { display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' };
const inputStyle = { padding: '15px', borderRadius: '12px', border: '2px solid #eee', fontSize: '16px' };
const claimButton = { backgroundColor: '#27ae60', color: '#fff', padding: '18px', border: 'none', borderRadius: '12px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' };
const successIcon = { width: '80px', height: '80px', backgroundColor: '#27ae60', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', margin: '0 auto 20px' };
const receiptBox = { backgroundColor: '#f8f9fa', padding: '20px', borderRadius: '15px', margin: '20px 0', textAlign: 'left' };
const receiptLine = { display: 'flex', justifyContent: 'space-between', margin: '8px 0', fontSize: '12px' };
const closeButton = { width: '100%', padding: '15px', backgroundColor: '#2c3e50', color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer' };
const spinnerStyle = { width: '50px', height: '50px', border: '5px solid #f3f3f3', borderTop: '5px solid #3498db', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' };

export default ClaimPage;