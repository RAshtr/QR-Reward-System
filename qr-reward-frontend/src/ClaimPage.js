import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { auth, RecaptchaVerifier, signInWithPhoneNumber } from './firebase';

const ClaimPage = () => {
    // Extract dynamic QR identifier from the route parameters
    const { qr_id } = useParams();
    
    // Core states for managing application data and UI status
    const [qrData, setQrData] = useState(null);
    const [status, setStatus] = useState('loading');
    const [formData, setFormData] = useState({ mobile: '', upi: '', otp: '' });
    
    // State indicators for Firebase Authentication orchestration
    const [otpSent, setOtpSent] = useState(false);
    const [confirmationResult, setConfirmationResult] = useState(null);
    const [loading, setLoading] = useState(false);

    // 🔥 State metrics to capture campaign active locks
    const [showLockPopup, setShowLockPopup] = useState(false);
    const [campaignStartDate, setCampaignStartDate] = useState("");

    // Fallback assignment for backend API integration node
    const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

    // Hooks framework to initialize Google Invisible reCAPTCHA on component mount
    useEffect(() => {
        const recaptchaContainer = document.getElementById('recaptcha-invisible-box');
        
        if (recaptchaContainer && !window.recaptchaVerifier) {
            try {
                window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-invisible-box', {
                    'size': 'invisible',
                    'callback': (response) => {
                        console.log("reCAPTCHA validation token generated successfully");
                    },
                    'expired-callback': () => {
                        console.log("reCAPTCHA validation handshake expired. Evicting cache.");
                        if (window.recaptchaVerifier) {
                            window.recaptchaVerifier.clear();
                            window.recaptchaVerifier = null;
                        }
                    }
                });
            } catch (err) {
                console.error("Critical error during reCAPTCHA verification binding:", err);
            }
        }

        return () => {
            if (window.recaptchaVerifier) {
                try {
                    window.recaptchaVerifier.clear();
                    window.recaptchaVerifier = null;
                } catch (e) {
                    console.error("Memory deallocation failure on reCAPTCHA reference:", e);
                }
            }
        };
    }, []);

    // 🎯 SINGLE CLEAN LIFECYCLE EFFECT WITH CORRECT RESPONSE PARSING
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
                    throw new Error(data.detail || "Invalid or Expired Voucher Code");
                }

                // 🎯 AGAR BACKEND NE BOLA NOT_STARTED TO POPUP ON KARO
                if (data.status === 'not_started') {
                    setCampaignStartDate(data.start_date);
                    setShowLockPopup(true);
                    setStatus('active'); // Keep UI active but layout is overlaid with popup
                    return;
                }

                // Agar aaj ki tareekh hai ya beet chuki hai, toh normal flow load hoga
                setQrData(data);
                setStatus(data.is_redeemed ? 'redeemed' : 'active');

            } catch (err) {
                console.error("Voucher authentication validation error:", err);
                alert("Backend Error: " + err.message);
                setStatus('error');
            }
        };

        if (qr_id) {
            verifyQR();
        }
    }, [qr_id, API_BASE]);

    // Triggers standard dynamic network message payload deployment sequence
    const handleSendOtp = async () => {
        if (!formData.mobile || formData.mobile.length !== 10) {
            alert("Please enter a valid 10-digit mobile number");
            return;
        }

        setLoading(true);
        try {
            const formattedMobile = `+91${formData.mobile.trim()}`;
            
            if (!window.recaptchaVerifier) {
                window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-invisible-box', {
                    'size': 'invisible'
                });
            }
            
            const appVerifier = window.recaptchaVerifier;
            const confirmation = await signInWithPhoneNumber(auth, formattedMobile, appVerifier);
            
            setConfirmationResult(confirmation);
            setOtpSent(true);
            alert("OTP has been sent successfully!");
        } catch (error) {
            console.error("Carrier communication error on Firebase module:", error);
            alert("SMS Engine Failed: " + error.message);
            
            if (window.recaptchaVerifier) {
                try {
                    window.recaptchaVerifier.clear();
                    window.recaptchaVerifier = null;
                } catch (e) {
                    console.error("reCAPTCHA state variable reset breakdown:", e);
                }
            }
        } finally {
            setLoading(false);
        }
    };

    // Submits credentials matrix to clear token matching sequences
    const handleVerifyAndRedeem = async () => {
        if (!formData.otp || formData.otp.length !== 6) {
            alert("Please enter the valid 6-digit OTP received on your phone");
            return;
        }
        if (!formData.upi || !formData.upi.includes('@')) {
            alert("Please enter a valid UPI Destination Address");
            return;
        }

        setLoading(true);
        try {
            const result = await confirmationResult.confirm(formData.otp);
            const user = result.user;
            const idToken = await user.getIdToken();
            const cleanId = String(qr_id).toLowerCase().trim();
            
            const redeemRes = await fetch(`${API_BASE}/redeem/${cleanId}?mobile=${formData.mobile}&upi=${formData.upi}`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                }
            });

            const redeemData = await redeemRes.json();

            if (redeemRes.ok && redeemData.status === "Success") {
                setStatus('redeemed');
            } else {
                alert(`Redemption Failed: ${redeemData.detail || "Transaction declined from backend gateway node"}`);
            }
        } catch (error) {
            console.error("Cryptographic signature match broken or code mismatch:", error);
            alert("Invalid Verification Code: The OTP you entered is wrong or expired.");
        } finally {
            setLoading(false);
        }
    };

    if (status === 'loading') return <div style={loaderStyle}>⚡ Verifying Secure Voucher Node...</div>;
    
    if (status === 'error')
        return (
            <div style={errorContainerStyle}>
                ❌ Backend Connection Failed
            </div>
        );

    const displayAmount = qrData?.amount || qrData?.assigned_amount || 0;

    return (
        <div style={containerStyle}>
            <div id="recaptcha-invisible-box" style={{ position: 'absolute', top: 0, left: 0 }}></div>

            {/* 🔥 LAYOVER POPUP: TRIGGERED WHEN CAMPAIGN NOT STARTED YET 🔥 */}
            {showLockPopup && (
                <div style={overlayStyle}>
                    <div style={popupCardStyle}>
                        <div style={iconCircle}>⏳</div>
                        <h2 style={popupTitleStyle}>Campaign Not Started</h2>
                        <p style={popupSubtitleStyle}>
                            This promotional reward scheme hasn't started yet. The coupon vouchers will automatically activate on:
                        </p>
                        <div style={dateBadge}>
                            📅 {campaignStartDate ? new Date(campaignStartDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Coming Soon'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '700' }}>
                            MARUTHI ELECTRODES SECURITY ACCESS
                        </div>
                    </div>
                </div>
            )}

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
                                disabled={otpSent || loading}
                                onChange={e => setFormData({...formData, mobile: e.target.value})} 
                            />
                            
                            {!otpSent ? (
                                <button onClick={handleSendOtp} disabled={loading} style={buttonStyle}>
                                    {loading ? "Requesting SMS..." : "Get Verification OTP"}
                                </button>
                            ) : (
                                <>
                                    <label style={labelStyle}>Enter 6-Digit Verification Code</label>
                                    <input 
                                        type="text" 
                                        placeholder="Enter 6-Digit OTP" 
                                        style={{...inputStyle, letterSpacing: '4px', textAlign: 'center'}} 
                                        value={formData.otp}
                                        maxLength={6}
                                        disabled={loading}
                                        onChange={e => setFormData({...formData, otp: e.target.value})} 
                                    />
                                    
                                    <label style={labelStyle}>UPI Address Payout Destination</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. name@apl, mobile@ybl" 
                                        style={inputStyle} 
                                        value={formData.upi}
                                        disabled={loading}
                                        onChange={e => setFormData({...formData, upi: e.target.value})} 
                                    />
                                    <button onClick={handleVerifyAndRedeem} disabled={loading} style={{...buttonStyle, backgroundColor: '#10b981', color: '#020617'}}>
                                        {loading ? "Processing Network Node..." : "Verify & Instant Transfer"}
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

// UI Element styles config layouts
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

// 🔥 NEW INLINE STYLES FOR OVERLAY MOCK CARD
const overlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(2, 6, 23, 0.92)', backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, padding: '20px' };
const popupCardStyle = { backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '24px', padding: '40px 24px', maxWidth: '370px', width: '100%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' };
const iconCircle = { width: '80px', height: '80px', backgroundColor: 'rgba(56, 189, 248, 0.08)', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto 24px auto', border: '1px solid rgba(56, 189, 248, 0.15)', fontSize: '36px' };
const popupTitleStyle = { color: '#ffffff', fontSize: '22px', fontWeight: '900', margin: '0 0 12px 0', letterSpacing: '-0.5px' };
const popupSubtitleStyle = { color: '#94a3b8', fontSize: '14px', lineHeight: '1.6', margin: '0 0 28px 0' };
const dateBadge = { display: 'inline-block', backgroundColor: '#020617', border: '1px solid #1e293b', color: '#38bdf8', padding: '10px 20px', borderRadius: '30px', fontWeight: '800', fontSize: '14px', letterSpacing: '0.5px', marginBottom: '28px' };

export default ClaimPage;
