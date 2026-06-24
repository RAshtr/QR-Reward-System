import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const ClaimPage = () => {
    const { qr_id } = useParams();
    
    const [qrData, setQrData] = useState(null);
    const [status, setStatus] = useState('loading');
    const [formData, setFormData] = useState({ mobile: '', name: '', upi: '', otp: '' });
    
    const [customerTrack, setCustomerTrack] = useState(null);
    const [isVerifiedCustomer, setIsVerifiedCustomer] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showLockPopup, setShowLockPopup] = useState(false);
    const [campaignStartDate, setCampaignStartDate] = useState("");

    const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

    // Initial QR Validation
    useEffect(() => {
        const verifyQR = async () => {
            try {
                const cleanId = String(qr_id).toLowerCase().trim();
                const response = await fetch(`${API_BASE}/claim/${cleanId}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });

                const data = await response.json();

                if (!response.ok) {
                    if (data.detail && data.detail.includes("campaign_not_started")) {
                        setCampaignStartDate(data.detail.split(":")[1]);
                        setShowLockPopup(true);
                        setStatus('active');
                        return;
                    }
                    throw new Error(data.detail || "Invalid Code");
                }

                setQrData(data);
                setStatus(data.is_redeemed ? 'redeemed' : 'active');

            } catch (err) {
                alert("Backend Error: " + err.message);
                setStatus('error');
            }
        };

        if (qr_id) { verifyQR(); }
    }, [qr_id, API_BASE]);

    // 🎯 TRACKING LOGIC: Customer hits Verify to see remaining scans
    const handleCustomerTrack = async () => {
        if (!formData.name.trim()) {
            alert("Please enter your name");
            return;
        }
        if (!formData.mobile || formData.mobile.length !== 10) {
            alert("Please enter a valid 10-digit mobile number");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/customer/check-progress`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mobile: formData.mobile,
                    name: formData.name,
                    qr_id: qr_id
                })
            });
            const data = await res.json();
            
            if (res.ok) {
                setCustomerTrack(data);
                setIsVerifiedCustomer(true);
                // 🎯 ALERT POPUP: X To Go For Bumper Offer!
                alert(`Hey ${data.customer_name}! ${data.remaining_scans} to go for Bumper Offer!`);
            } else {
                alert("Tracking Failed");
            }
        } catch (err) {
            alert("Tracking Error: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    if (status === 'loading') return <div style={loaderStyle}>⚡ Verifying Secure Voucher Node...</div>;
    if (status === 'error') return <div style={errorContainerStyle}>❌ Backend Connection Failed</div>;

    // Bumper hits multiply amount by 5x or give premium bumper message
    const displayAmount = customerTrack?.is_bumper_hit ? (qrData?.assigned_amount * 5) : (qrData?.assigned_amount || 0);

    return (
        <div style={containerStyle}>
            {showLockPopup && (
                <div style={overlayStyle}>
                    <div style={popupCardStyle}>
                        <h2>Campaign Not Started</h2>
                        <div style={dateBadge}>📅 {campaignStartDate}</div>
                    </div>
                </div>
            )}

            <div style={cardStyle}>
                {status === 'active' && (
                    <div>
                        <div style={badgeStyle}>🎉 PHYSICAL VOUCHER UNLOCKED</div>
                        
                        {/* Dynamic Progress Header */}
                        {isVerifiedCustomer && (
                            <div style={{ backgroundColor: '#1e293b', padding: '10px', borderRadius: '8px', fontSize: '13px', color: '#38bdf8', marginBottom: '15px' }}>
                                📊 Progress: {customerTrack?.remaining_scans} scans remaining for Bumper!
                            </div>
                        )}

                        <div style={rewardWrapper}>
                            <h1 style={amountStyle}>₹{displayAmount}</h1>
                            {customerTrack?.is_bumper_hit && <span style={{color:'#ea580c', fontWeight:'bold'}}>🔥 BUMPER CASHBACK UNLOCKED!</span>}
                        </div>

                        <div style={formStyle}>
                            {/* STEP 1: NAME AND MOBILE VERIFICATION */}
                            {!isVerifiedCustomer ? (
                                <>
                                    <label style={labelStyle}>Your Full Name</label>
                                    <input 
                                        type="text" 
                                        placeholder="Enter your name" 
                                        style={inputStyle}
                                        value={formData.name}
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                    />
                                    <label style={labelStyle}>Mobile Number</label>
                                    <input 
                                        type="number" 
                                        placeholder="Enter 10-digit mobile" 
                                        style={inputStyle}
                                        value={formData.mobile}
                                        onChange={e => setFormData({...formData, mobile: e.target.value})}
                                    />
                                    <button onClick={handleCustomerTrack} disabled={loading} style={buttonStyle}>
                                        {loading ? "Tracking Progress..." : "Check My Bumper Progress"}
                                    </button>
                                </>
                            ) : (
                                /* STEP 2: UPI PAYOUT FOR VERIFIED CUSTOMERS */
                                <>
                                    <p style={{color:'#94a3b8', fontSize:'13px'}}>Verified User: <strong>{formData.name}</strong></p>
                                    <label style={labelStyle}>UPI Address</label>
                                    <input 
                                        type="text" 
                                        placeholder="name@apl" 
                                        style={inputStyle}
                                        value={formData.upi}
                                        onChange={e => setFormData({...formData, upi: e.target.value})}
                                    />
                                    <button style={{...buttonStyle, backgroundColor: '#10b981', color: '#020617'}}>
                                        Claim Instant Cashback
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
                
                {status === 'redeemed' && (
                    <div style={{ color: 'white' }}>🎉 Payout Successful!</div>
                )}
            </div>
        </div>
    );
};

// Styles configuration (keep your existing styles underneath)
const containerStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#020617', padding: '20px' };
const cardStyle = { backgroundColor: '#0f172a', padding: '30px', borderRadius: '20px', width: '100%', maxWidth: '380px', textAlign: 'center', border: '1px solid #1e293b' };
const badgeStyle = { backgroundColor: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', display: 'inline-block' };
const rewardWrapper = { backgroundColor: '#020617', padding: '20px', borderRadius: '14px', marginTop: '15px' };
const amountStyle = { fontSize: '42px', color: '#10b981', margin: '5px 0', fontWeight: '900' };
const formStyle = { display: 'flex', flexDirection: 'column', textAlign: 'left', gap: '8px', marginTop: '15px' };
const labelStyle = { fontSize: '11px', color: '#64748b', fontWeight: '700' };
const inputStyle = { padding: '12px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#020617', color: 'white', width: '100%', boxSizing: 'border-box' };
const buttonStyle = { backgroundColor: '#38bdf8', color: '#020617', padding: '14px', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', marginTop: '10px' };
const loaderStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#020617', color: '#38bdf8' };
const errorContainerStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#020617', color: '#f43f5e' };
const overlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(2, 6, 23, 0.95)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 };
const popupCardStyle = { backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '20px', padding: '30px', color: 'white', textAlign: 'center' };
const dateBadge = { backgroundColor: '#020617', color: '#38bdf8', padding: '10px 20px', borderRadius: '20px', marginTop: '15px', fontWeight: '700' };

export default ClaimPage;