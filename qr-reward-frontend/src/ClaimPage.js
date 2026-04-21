import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const ClaimPage = () => {
    const { qr_id } = useParams();
    const canvasRef = useRef(null);
    const [qrData, setQrData] = useState(null);
    const [status, setStatus] = useState('loading');
    const [formData, setFormData] = useState({ mobile: '', upi: '', otp: '' });
    const [isScratched, setIsScratched] = useState(false);
    const [otpSent, setOtpSent] = useState(false);
    const [isVerified, setIsVerified] = useState(false);

    const API_BASE = "http://localhost:8000";

    useEffect(() => {
        const verifyQR = async () => {
            try {
                const response = await axios.get(`${API_BASE}/claim/${qr_id}`);
                setQrData(response.data);
                setStatus(response.data.is_redeemed ? 'redeemed' : 'active');
            } catch (err) { setStatus('error'); }
        };
        verifyQR();
    }, [qr_id]);

    useEffect(() => {
        if (status === 'active' && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            
            // 1. Professional Gradient Background (Like Google Pay)
            const grad = ctx.createLinearGradient(0, 0, 300, 300);
            grad.addColorStop(0, '#6a11cb'); // Purple
            grad.addColorStop(1, '#2575fc'); // Blue
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 300, 300);
            
            // 2. Add White Dots Pattern
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            for (let i = 0; i <= 300; i += 20) {
                for (let j = 0; j <= 300; j += 20) {
                    ctx.beginPath();
                    ctx.arc(i, j, 1.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // 3. Draw Gift Icon and Professional Text
            ctx.fillStyle = 'white';
            ctx.font = '50px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('🎁', 150, 140);
            
            ctx.font = 'bold 18px Arial';
            ctx.fillText('SCRATCH TO REVEAL', 150, 180);

            let isDrawing = false;
            const scratch = (x, y) => {
                ctx.globalCompositeOperation = 'destination-out';
                ctx.beginPath();
                ctx.arc(x, y, 35, 0, Math.PI * 2);
                ctx.fill();
                
                // Calculate percentage cleared
                const pixels = ctx.getImageData(0, 0, 300, 300).data;
                let clearCount = 0;
                for (let i = 3; i < pixels.length; i += 4) {
                    if (pixels[i] === 0) clearCount++;
                }
                if (clearCount > (300 * 300) * 0.6) setIsScratched(true);
            };

            canvas.onmousedown = () => (isDrawing = true);
            canvas.onmouseup = () => (isDrawing = false);
            canvas.onmousemove = (e) => {
                if (!isDrawing) return;
                const rect = canvas.getBoundingClientRect();
                scratch(e.clientX - rect.left, e.clientY - rect.top);
            };

            canvas.ontouchmove = (e) => {
                const rect = canvas.getBoundingClientRect();
                const touch = e.touches[0];
                scratch(touch.clientX - rect.left, touch.clientY - rect.top);
            };
        }
    }, [status]);

    const handleSendOTP = async () => {
        try {
            await axios.post(`${API_BASE}/send-otp`, { mobile: formData.mobile });
            setOtpSent(true);
            alert("OTP Sent! Check Terminal.");
        } catch (err) { alert("Error"); }
    };

    if (status === 'loading') return <div style={containerStyle}>Verifying...</div>;

    return (
        <div style={containerStyle}>
            <div style={cardStyle}>
                {status === 'active' && (
                    <div>
                        <h2 style={{ marginBottom: '20px', color: '#333' }}>You've Won!</h2>
                        <div style={scratchWrapper}>
                            {/* REWARD LAYER (BOTTOM) */}
                            <div style={rewardLayer}>
                                <p style={{ color: '#888', margin: 0 }}>Cashback Reward</p>
                                <h1 style={{ fontSize: '55px', color: '#27ae60', margin: '5px 0' }}>₹{qrData?.amount}</h1>
                                <p style={{ color: '#27ae60', fontWeight: 'bold' }}>Unlocked! ✅</p>
                            </div>
                            
                            {/* SCRATCH LAYER (TOP CANVAS) */}
                            {!isScratched && (
                                <canvas 
                                    ref={canvasRef} 
                                    width="300" 
                                    height="300" 
                                    style={{ position: 'absolute', top: 0, left: 0, cursor: 'crosshair', borderRadius: '15px' }}
                                />
                            )}
                        </div>

                        {isScratched && (
                            <div style={formStyle}>
                                <input type="number" placeholder="Mobile Number" style={inputStyle} onChange={e => setFormData({...formData, mobile: e.target.value})} />
                                {!otpSent && <button onClick={handleSendOTP} style={buttonStyle}>Get OTP</button>}
                                {/* Rest of OTP/UPI logic stays the same */}
                            </div>
                        )}
                    </div>
                )}
                {status === 'redeemed' && <h2>🎉 Reward Claimed Successfully!</h2>}
            </div>
        </div>
    );
};

// --- STYLES ---
const containerStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f0f2f5' };
const cardStyle = { backgroundColor: '#fff', padding: '30px', borderRadius: '28px', boxShadow: '0 15px 35px rgba(0,0,0,0.1)', width: '360px', textAlign: 'center' };
const scratchWrapper = { position: 'relative', width: '300px', height: '300px', margin: '0 auto', borderRadius: '15px', overflow: 'hidden', boxShadow: '0 10px 20px rgba(0,0,0,0.15)', border: '4px solid #fff' };
const rewardLayer = { width: '300px', height: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' };
const formStyle = { display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' };
const inputStyle = { padding: '14px', borderRadius: '12px', border: '1px solid #ddd', fontSize: '16px' };
const buttonStyle = { backgroundColor: '#3498db', color: '#fff', padding: '14px', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' };

export default ClaimPage;