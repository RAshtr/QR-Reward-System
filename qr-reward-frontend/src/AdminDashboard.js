import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';

const AdminDashboard = ({ onLogout }) => {
  const [analytics, setAnalytics] = useState(null);
  const [campaignList, setCampaignList] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [loading, setLoading] = useState(true);
  
  const initialFormState = {
    series_name: '', min_amount: '', max_amount: '', quantity: '', expiry_date: ''
  };

  const [formData, setFormData] = useState(initialFormState);

  // FIXED INTERFACE ZONE - Numeric path lock matching your active network node
  const API_BASE = "https://qr-reward-system.onrender.com"; // Apne sahi Render URL se replace karein
  const THEME_COLOR = "#38bdf8"; 

  const fetchData = async (autoSelectId = null) => {
    try {
      const statsRes = await fetch(`${API_BASE}/admin/analytics`);
      const statsData = await statsRes.json();
      setAnalytics(statsData);

      const campaignsRes = await fetch(`${API_BASE}/admin/campaigns/`);
      const campaignsData = await campaignsRes.json();
      
      if (Array.isArray(campaignsData) && campaignsData.length > 0) {
        // Strict Type sorting checking to always bring newest batch at top
        const sortedCampaigns = campaignsData.sort((a, b) => Number(b.id) - Number(a.id));
        setCampaignList(sortedCampaigns);
        
        // Strict string coercion validation to resolve dropdown visibility glitch
        if (autoSelectId) {
          setSelectedCampaign(String(autoSelectId));
        } else if (sortedCampaigns.length > 0) {
          setSelectedCampaign(String(sortedCampaigns[0].id));
        }
      } else {
        setCampaignList([]);
        setSelectedCampaign("");
      }
      setLoading(false);
    } catch (error) {
      console.error("Fetch Error:", error);
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // 100% FIXED TYPE MATRIX: Parsing parameters directly into safe backend sanitizer numbers
      const submitPayload = {
        series_name: String(formData.series_name || "BATCH").trim(),
        min_amount: formData.min_amount ? Number(formData.min_amount) : 1,
        max_amount: formData.max_amount ? Number(formData.max_amount) : 5,
        quantity: formData.quantity ? Number(formData.quantity) : 1,
        expiry_date: String(formData.expiry_date || "2026-12-31"),
        expiry: String(formData.expiry_date || "2026-12-31")       
      };

      const response = await fetch(`${API_BASE}/admin/campaigns/`, {
        method: 'POST',
        headers: { 
          'Accept': 'application/json',
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(submitPayload)
      });

      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.detail || "Server validation failed");
      }
      
      if (formData.series_name && formData.expiry_date) {
        localStorage.setItem(`local_exp_${formData.series_name}`, formData.expiry_date);
      }

      alert("Batch Generated Successfully!");
      setFormData(initialFormState); 
      
      // Deep response state injection
      await fetchData(resData.id);
    } catch (error) { 
      console.error("Submission Error Matrix:", error.message);
      alert("Error generating batch."); 
    }
  };

  const downloadPDF = async () => {
    if (!selectedCampaign) return alert("Select a batch from the list first!");
    const campaign = campaignList.find(c => String(c.id) === String(selectedCampaign));
    if (!campaign || !campaign.qr_list || campaign.qr_list.length === 0) {
        return alert("QR data not found inside this target batch!");
    }

    // FIXED MOBILE SCANNING COLLAPSE: Routing direct onto explicit LAN React standard IP endpoint instead of localhost
    const baseLiveUrl = "https://qr-reward-system-gilt.vercel.app";
    const doc = new jsPDF('p', 'mm', 'a4');
    
    const cardWidth = 182;
    const cardHeight = 85; 
    const startX = 14;
    const startY = 15;
    const gapY = 10;

    try {
      for (let i = 0; i < campaign.qr_list.length; i++) {
        const qr = campaign.qr_list[i];
        const fullUuidStr = String(qr.qr_code_id || qr.id || qr.voucher_id).toLowerCase().trim();
        const claimUrl = `${baseLiveUrl}/claim/${fullUuidStr}`;
        
        const qrDataUri = await QRCode.toDataURL(claimUrl, { width: 500, margin: 1, errorCorrectionLevel: 'H' });

        if (i > 0 && i % 3 === 0) doc.addPage();
        const row = i % 3;
        const y = startY + row * (cardHeight + gapY);

        doc.setDrawColor(15, 23, 42);
        doc.setLineWidth(0.6);
        doc.rect(startX, y, cardWidth, cardHeight);

        doc.setFillColor(15, 23, 42);
        doc.rect(startX + 0.5, y + 0.5, cardWidth - 1, 14, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(12);
        doc.text("MARUTHI ELECTRODES", startX + 6, y + 9);
        
        doc.setFontSize(8.5);
        doc.setTextColor(148, 163, 184);
        doc.text("SERIES: " + String(campaign.series_name).toUpperCase(), startX + cardWidth - 6, y + 9, { align: 'right' });

        doc.setFillColor(255, 255, 255);
        doc.rect(startX + 5, y + 19, 52, 52, 'F');
        doc.addImage(qrDataUri, 'PNG', startX + 5, y + 19, 52, 52);

        doc.setTextColor(15, 23, 42);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(13);
        doc.text("WELCOME TO MARUTHI ELECTRODES REWARDS", startX + 64, y + 26);
        
        doc.setTextColor(71, 85, 105);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8.5);
        let instructions = [
          "Congratulations! You have received an official corporate reward token.",
          "",
          "How to Claim Your Reward:",
          "1. Open your smartphone camera or any secure digital lens scanner.",
          "2. Scan the QR code on the left side to load your web gateway.",
          "3. Enter your active mobile number and complete secure OTP verification.",
          "4. Provide your valid UPI ID to execute instant bank routing transfer.",
          "",
          "Note: Payout processing is monitored and handled securely via corporate node."
        ];
        doc.text(instructions, startX + 64, y + 34);

        doc.setDrawColor(226, 232, 240);
        doc.line(startX + 4, y + 74, startX + cardWidth - 4, y + 74);

        doc.setTextColor(100, 116, 139);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.text("SECURE SYSTEM TRACKING UUID:", startX + 6, y + 78);
        
        doc.setFont('Helvetica', 'bold'); 
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(9.5);
        doc.text(fullUuidStr, startX + 6, y + 82); 
      }
      doc.save(`${campaign.series_name}_Maruthi_Electrodes_Coupons.pdf`);
    } catch (err) { 
      console.error(err);
      alert("Failed to generate PDF"); 
    }
  };

  if (loading) return <div style={loaderStyle}>⚡ Establishing Secure Node Session...</div>;

  return (
    <div style={mainContainer}>
      <div style={headerSection}>
        <div>
          <h1 style={premiumTitle}>MARUTHI <span style={{color: THEME_COLOR}}>ELECTRODES</span></h1>
          <div style={systemStatus}>
            <span style={pulseDot}></span>
            <span style={statusText}>PORTAL LIVE</span>
          </div>
        </div>
        <div style={actionButtons}>
          <button onClick={() => fetchData(selectedCampaign)} style={refreshBtn}>🔄 Sync Gateway</button>
          <button onClick={onLogout} style={logoutBtn}>Disconnect</button>
        </div>
      </div>

      <div style={analyticsGrid}>
        <div style={premiumCard}>
          <p style={cardLabel}>TOTAL ACTIVE CAMPAIGNS</p>
          <h2 style={{...cardValue, color: THEME_COLOR}}>{analytics?.total_campaigns || 0}</h2>
          <div style={{...bottomBar, backgroundColor: THEME_COLOR}}></div>
        </div>
        <div style={premiumCard}>
          <p style={cardLabel}>TOTAL QRs GENERATED</p>
          <h2 style={{...cardValue, color: '#a855f7'}}>{analytics?.total_qrs_generated || 0}</h2>
          <div style={{...bottomBar, backgroundColor: '#a855f7'}}></div>
        </div>
        <div style={premiumCard}>
          <p style={cardLabel}>TOTAL UPI PAYOUT DISTRIBUTED</p>
          <h2 style={{...cardValue, color: '#10b981'}}>₹{Math.floor(analytics?.total_payout_distributed || 0)}</h2>
          <div style={{...bottomBar, backgroundColor: '#10b981'}}></div>
        </div>
      </div>

      <div style={glassContainerFull}>
        <div style={sectionHeader}>
          <h3 style={sectionTitle}>⚡ LIVE PAYOUT FEED</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr style={theadStyle}>
                <th style={thStyle}>VALID UNTIL</th>
                <th style={thStyle}>REDEEMED AT</th>
                <th style={thStyle}>CUSTOMER MOBILE</th>
                <th style={thStyle}>UPI ADDRESS</th>
                <th style={thStyle}>AMOUNT</th>
                <th style={thStyle}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {campaignList && campaignList.map(campaign => (
                campaign.qr_list && campaign.qr_list
                  .filter(qr => qr.is_redeemed === true)
                  .map((txn) => (
                    <tr key={txn.qr_code_id || txn.id} style={trStyle}>
                      <td style={{...tdStyle, color: '#f43f5e', fontWeight: 'bold'}}>{campaign.expiry_date}</td>
                      <td style={tdStyle}>{new Date(txn.redeemed_at).toLocaleString()}</td>
                      <td style={{ ...tdStyle, fontWeight: '600' }}>{txn.redeemed_mobile}</td>
                      <td style={{...tdStyle, color: THEME_COLOR}}>{txn.redeemed_upi}</td>
                      <td style={{ ...tdStyle, color: '#10b981', fontWeight: 'bold' }}>₹{txn.assigned_amount}</td>
                      <td style={tdStyle}><span style={badgeStyle}>SUCCESS</span></td>
                    </tr>
                  ))
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={contentGrid}>
        <div style={glassSection}>
          <h3 style={formTitleObject}>🛠️ Configure Voucher Batch</h3>
          <form onSubmit={handleSubmit} style={formStyle}>
            <label style={fieldLabel}>Campaign Series Name</label>
            <input style={inputField} type="text" value={formData.series_name || ''} onChange={e => setFormData({ ...formData, series_name: e.target.value })} required />
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{flex: 1}}>
                <label style={fieldLabel}>Min Amount (₹)</label>
                <input style={inputField} type="number" value={formData.min_amount || ''} onChange={e => setFormData({ ...formData, min_amount: e.target.value })} required />
              </div>
              <div style={{flex: 1}}>
                <label style={fieldLabel}>Max Amount (₹)</label>
                <input style={inputField} type="number" value={formData.max_amount || ''} onChange={e => setFormData({ ...formData, max_amount: e.target.value })} required />
              </div>
            </div>
            <label style={fieldLabel}>Quantity</label>
            <input style={inputField} type="number" value={formData.quantity || ''} onChange={e => setFormData({ ...formData, quantity: e.target.value })} required />
            <label style={fieldLabel}>Expiry Date</label>
            <input style={inputField} type="date" value={formData.expiry_date || ''} onChange={e => setFormData({ ...formData, expiry_date: e.target.value })} required />
            <button type="submit" style={primaryBtn}>GENERATE CRYPTO CODES</button>
          </form>
        </div>

        <div style={glassSection}>
          <h3 style={formTitleObject}>📦 Logistics</h3>
          <select value={selectedCampaign} onChange={e => setSelectedCampaign(e.target.value)} style={selectField}>
            {campaignList && campaignList.length > 0 ? (
              campaignList.map(c => (
                <option key={c.id} value={c.id} style={{background:'#1e293b'}}>
                  {c.series_name || `Batch #${c.id}`}
                </option>
              ))
            ) : (
              <option style={{background:'#1e293b'}}>No Active Batches Found</option>
            )}
          </select>
          <button onClick={downloadPDF} style={downloadBtn}>📥 DOWNLOAD REPORT</button>
        </div>
      </div>
    </div>
  );
};

const mainContainer = { padding: '40px', backgroundColor: '#020617', minHeight: '100vh', fontFamily: 'sans-serif', color: '#f8fafc' };
const headerSection = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' };
const premiumTitle = { margin: 0, fontSize: '28px', fontWeight: '900' };
const systemStatus = { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' };
const statusText = { fontSize: '11px', color: '#94a3b8' };
const pulseDot = { height: '8px', width: '8px', backgroundColor: '#10b981', borderRadius: '50%' };
const actionButtons = { display: 'flex', gap: '12px' };
const refreshBtn = { backgroundColor: 'transparent', border: '1px solid #334155', color: '#cbd5e1', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer' };
const logoutBtn = { backgroundColor: '#f43f5e', color: 'white', padding: '10px 18px', border: 'none', borderRadius: '8px', cursor: 'pointer' };
const analyticsGrid = { display: 'flex', gap: '24px', marginBottom: '40px' };
const premiumCard = { position: 'relative', backgroundColor: '#0f172a', padding: '24px', borderRadius: '14px', flex: 1, border: '1px solid #1e293b' };
const bottomBar = { position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px' };
const cardLabel = { margin: 0, color: '#64748b', fontSize: '11px', fontWeight: '800' };
const cardValue = { margin: '10px 0 0 0', fontSize: '32px', fontWeight: '800' };
const glassContainerFull = { backgroundColor: '#0f172a', padding: '30px', borderRadius: '16px', marginBottom: '30px', border: '1px solid #1e293b' };
const sectionHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' };
const sectionTitle = { margin: 0, fontSize: '16px', fontWeight: '800' };
const tableStyle = { width: '100%', borderCollapse: 'collapse' };
const theadStyle = { borderBottom: '2px solid #1e293b' };
const thStyle = { padding: '12px 16px', color: '#64748b', fontSize: '11px', textAlign: 'left' };
const tdStyle = { padding: '16px', borderBottom: '1px solid #1e293b', fontSize: '13px' };
const trStyle = { backgroundColor: 'transparent' };
const badgeStyle = { backgroundColor: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '4px 8px', borderRadius: '4px' };
const contentGrid = { display: 'flex', gap: '24px' };
const glassSection = { backgroundColor: '#0f172a', padding: '30px', borderRadius: '16px', flex: 1, border: '1px solid #1e293b' };
const formStyle = { display: 'flex', flexDirection: 'column', gap: '16px' };
const inputField = { padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#020617', color: '#ffffff', width: '100%', boxSizing: 'border-box' };
const selectField = { width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#020617', color: '#ffffff', marginBottom: '25px' };
const primaryBtn = { color: '#020617', backgroundColor: '#38bdf8', padding: '14px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' };
const downloadBtn = { width: '100%', backgroundColor: '#ffffff', color: '#020617', padding: '14px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '800' };
const loaderStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#020617', color: '#38bdf8' };
const fieldLabel = { fontSize: '12px', fontWeight: '700', color: '#94a3b8', marginBottom: '6px' };
const formTitleObject = { marginTop: 0, marginBottom: '20px', fontSize: '16px', fontWeight: '800' };

export default AdminDashboard;