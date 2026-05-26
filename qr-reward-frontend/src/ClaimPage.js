import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const ClaimPage = () => {
    const { qr_id } = useParams();
    const [qrData, setQrData] = useState(null);
    const [status, setStatus] = useState('loading');
    const [formData, setFormData] = useState({ mobile: '', upi: '', otp: '' });
    const [otpSent, setOtpSent] = useState(false);

    const API_BASE = "http://localhost:8000";

    useEffect(() => {
        const verifyQR = async () => {
            try {
                // CORE FIX: ID ko safely strip, trim aur lowercase mein convert karke bhejenge
                const cleanId = String(qr_id).toLowerCase().trim();
                
                const response = await axios.get(`${API_BASE}/claim/${cleanId}`);
                setQrData(response.data);
                setStatus(response.data.is_redeemed ? 'redeemed' : 'active');
            } catch (err) { 
                console.error("Verification API Error:", err);
                setStatus('error'); 
            }
        };
        if (qr_id) verifyQR();
    }, [qr_id]);

    const handleSendOtp = async () => {
        if (!formData.mobile || formData.mobile.length < 10) {
            alert("Please enter a valid mobile number");
            return;
        }
        try {
            const response = await axios.post(`${API_BASE}/send-otp`, {
                mobile: formData.mobile
            });

            if (response.data.status === "Success") {
                setOtpSent(true);
                alert("OTP sent! Check your terminal or mobile.");
            } else {
                alert(response.data.message);
            }
        } catch (error) {
            console.error("Error sending OTP", error);
            alert("Failed to connect to backend");
        }
    };

    const handleVerifyAndRedeem = async () => {
        if (!formData.otp || formData.otp.length < 4) {
            alert("Please enter a valid 4-digit OTP");
            return;
        }

        try {
            // 1. Verify OTP
            const verifyRes = await axios.post(`${API_BASE}/verify-otp`, {
                mobile: formData.mobile,
                otp_code: formData.otp
            });

            if (verifyRes.data.status === "Success") {
                // 2. Redeem Call (Ensuring sanitation on active endpoint mapping)
                const cleanId = String(qr_id).toLowerCase().trim();
                const redeemRes = await axios.post(`${API_BASE}/redeem/${cleanId}`, null, {
                    params: {
                        mobile: formData.mobile,
                        upi: formData.upi
                    }
                });

                if (redeemRes.data.status === "Success") {
                    setStatus('redeemed');
                } else {
                    alert(redeemRes.data.message || "Redemption failed");
                }
            }
        } catch (error) {
            console.error("Verification Error:", error);
            const errorMsg = error.response?.data?.detail || "Invalid or Expired OTP. Please try again.";
            alert(errorMsg);
        }
    };

    if (status === 'loading') return <div style={loaderStyle}>⚡ Verifying Secure Voucher Node...</div>;
    if (status === 'error') return <div style={errorContainerStyle}>❌ Invalid or Expired Voucher Code</div>;

    // Fallback variable mapping protection
    const displayAmount = qrData?.amount || qrData?.assigned_amount || 0;

    return (
        <div style={containerStyle}>
            <div style={cardStyle}>
                {status === 'active' && (
                    <div>
                        <div style={badgeStyle}>🎉 PHYSICAL VOUCHER UNLOCKED</div>
                        <h2 style={mainTitleStyle}>You've Won!</h2>
                        
                        <div style={rewardWrapper}>
                            <p style={{ color: '#94a3b8', margin: 0, fontSize: '12px', fontWeight: '700', letterSpacing: '0.5px' }}>CASHBACK REWARD</p>
                            <h1 style={amountStyle}>₹{displayAmount}</h1>
                            <div style={statusBadge}>READY TO CLAIM ✅</div>
                        </div>

                        <div style={formStyle}>
                            <label style={labelStyle}>Customer Mobile Number</label>
                            <input 
                                type="number" 
                                placeholder="Enter 10-digit mobile" 
                                style={inputStyle} 
                                value={formData.mobile}
                                disabled={otpSent}
                                onChange={e => setFormData({...formData, mobile: e.target.value})} 
                            />
                            
                            {!otpSent ? (
                                <button onClick={handleSendOtp} style={buttonStyle}>Get Verification OTP</button>
                            ) : (
                                <>
                                    <label style={labelStyle}>Enter Verification Code</label>
                                    <input 
                                        type="text" 
                                        placeholder="Enter 4-Digit OTP" 
                                        style={inputStyle} 
                                        value={formData.otp}
                                        onChange={e => setFormData({...formData, otp: e.target.value})} 
                                    />
                                    
                                    <label style={labelStyle}>UPI Address Payout Destination</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. name@apl, mobile@ybl" 
                                        style={inputStyle} 
                                        value={formData.upi}
                                        onChange={e => setFormData({...formData, upi: e.target.value})} 
                                    />
                                    <button onClick={handleVerifyAndRedeem} style={{...buttonStyle, backgroundColor: '#10b981', color: '#020617'}}>
                                        Verify & Instant Transfer
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
                
                {status === 'redeemed' && (
                    <div style={{ padding: '20px 0' }}>
                        <h1 style={{ fontSize: '64px', margin: '0 0 20px 0' }}>🎉</h1>
                        <h2 style={{ color: '#ffffff', fontWeight: '800', marginBottom: '10px' }}>Payout Successful!</h2>
                        <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.6' }}>
                            The cashback reward of <strong style={{color: '#10b981'}}>₹{displayAmount}</strong> has been routed to your UPI address destination.
                        </p>
                        <div style={{ marginTop: '25px', padding: '12px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', color: '#10b981', fontSize: '12px', fontWeight: '700', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                            TRANSACTION SETTLED VIA UPI GATEWAY
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- PREMIUM DARK TECH STYLING ---
const containerStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#020617', padding: '20px', fontFamily: '"Segoe UI", Roboto, sans-serif' };
const cardStyle = { backgroundColor: '#0f172a', padding: '30px', borderRadius: '20px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)', width: '100%', maxWidth: '380px', textAlign: 'center', border: '1px solid #1e293b' };
const badgeStyle = { backgroundColor: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', display: 'inline-block', letterSpacing: '0.5px', marginBottom: '15px' };
const mainTitleStyle = { margin: '0 0 20px 0', color: '#ffffff', fontSize: '24px', fontWeight: '800' };
const rewardWrapper = { backgroundColor: '#020617', padding: '25px', borderRadius: '14px', border: '1px solid #1e293b', marginBottom: '25px' };
const amountStyle = { fontSize: '48px', color: '#10b981', margin: '10px 0', fontWeight: '900', letterSpacing: '-1px' };
const statusBadge = { color: '#10b981', fontSize: '12px', fontWeight: '800', letterSpacing: '0.5px' };
const formStyle = { display: 'flex', flexDirection: 'column', textAlign: 'left', gap: '6px' };
const labelStyle = { fontSize: '11px', fontWeight: '700', color: '#64748b', marginTop: '8px', letterSpacing: '0.5px' };
const inputStyle = { padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#020617', color: '#ffffff', width: '100%', boxSizing: 'border-box', fontSize: '15px', outline: 'none' };
const buttonStyle = { backgroundColor: '#38bdf8', color: '#020617', padding: '14px', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', fontSize: '14px', marginTop: '15px', letterSpacing: '0.5px', boxShadow: '0 4px 6px -1px rgba(56, 189, 248, 0.2)' };
const loaderStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontWeight: 'bold', backgroundColor: '#020617', color: '#38bdf8', fontSize: '16px' };
const errorContainerStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontWeight: 'bold', backgroundColor: '#020617', color: '#f43f5e', fontSize: '16px', padding: '20px', textAlign: 'center' };

export default ClaimPage;