import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';

const AdminDashboard = ({ onLogout }) => {
  const [analytics, setAnalytics] = useState(null);
  const [campaignList, setCampaignList] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [loading, setLoading] = useState(true);
  
  const initialFormState = {
    series_name: '', 
    min_amount: '', 
    max_amount: '', 
    quantity: '', 
    start_date: '',   
    expiry_date: '',
    is_bumper: false  
  };

  const [formData, setFormData] = useState(initialFormState);

  const API_BASE = window.location.origin.includes("localhost") 
    ? "http://localhost:8000" 
    : window.location.origin.replace(":3000", ":8000");

  const THEME_COLOR = "#38bdf8"; 

  const fetchData = async (autoSelectId = null) => {
    try {
      const statsRes = await fetch(`${API_BASE}/admin/analytics`);
      const statsData = await statsRes.json();
      setAnalytics(statsData);

      const campaignsRes = await fetch(`${API_BASE}/admin/campaigns/`);
      const campaignsData = await campaignsRes.json();
      
      if (Array.isArray(campaignsData) && campaignsData.length > 0) {
        const sortedCampaigns = campaignsData.sort((a, b) => Number(b.id) - Number(a.id));
        setCampaignList(sortedCampaigns);
        
        if (autoSelectId) {
          setSelectedCampaign(String(autoSelectId));
        } else if (sortedCampaigns.length > 0) {
          setSelectedCampaign(String(sortedCampaigns[0].id));
        }
      } else {
        setCampaignList([]);
        setSelectedCampaign("");
      }
      loading && setLoading(false);
    } catch (error) {
      console.error("Fetch Error Matrix:", error);
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitPayload = {
        series_name: String(formData.series_name || "BATCH").trim(),
        min_amount: formData.min_amount ? Number(formData.min_amount) : 1,
        max_amount: formData.max_amount ? Number(formData.max_amount) : 5,
        quantity: formData.quantity ? Number(formData.quantity) : 1,
        start_date: String(formData.start_date || "2026-06-18"), 
        expiry_date: String(formData.expiry_date || "2026-12-31"),
        is_bumper: Boolean(formData.is_bumper) 
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

      alert("Batch Generated Successfully!");
      setFormData(initialFormState); 
      await fetchData(resData.id);
    } catch (error) { 
      console.error("Submission Failure:", error.message);
      alert("Error generating batch: " + error.message); 
    }
  };

  // 🎯 FIX: Google Open QR API ke cross-origin constraints ko fix karne ka foolproof browser tareeka
  const loadImageAsBase64 = (url) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous'; 
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = (e) => reject(new Error("CORS image conversion pipeline crashed"));
      img.src = url;
    });
  };

  const downloadPDF = async () => {
    if (!selectedCampaign) return alert("Select a batch from the list first!");
    const campaign = campaignList.find(c => String(c.id) === String(selectedCampaign));
    if (!campaign || !campaign.qr_list || campaign.qr_list.length === 0) {
      return alert("QR data not found inside this target batch!");
    }

    const doc = new jsPDF('p', 'mm', 'a4');
    
    const cardWidth = 45; 
    const cardHeight = 20; 
    const startX = 14; 
    const startY = 18; 
    
    const gapX = 4;
    const gapY = 3;
    const maxColumns = 4;
    const maxRows = 10; 

    try {
      alert("Generating high-quality sticker sheet. Download will start automatically...");
      
      for (let i = 0; i < campaign.qr_list.length; i++) {
        const qr = campaign.qr_list[i];
        const fullUuidStr = String(qr.qr_code_id || qr.id).toLowerCase().trim();
        
        // Target path where scan routes client destination
        const targetScanUrl = `https://qr-reward-system-gilt.vercel.app/claim/${fullUuidStr}`;
        
        // Cloud engine rendering architecture point bypass configuration
        const fastQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(targetScanUrl)}`;
        
        const base64ImageString = await loadImageAsBase64(fastQrUrl);

        const itemsPerPage = maxColumns * maxRows; 
        if (i > 0 && i % itemsPerPage === 0) doc.addPage();
        
        const pageIndex = i % itemsPerPage;
        const col = pageIndex % maxColumns;
        const row = Math.floor(pageIndex / maxColumns);
        
        const x = startX + col * (cardWidth + gapX);
        const y = startY + row * (cardHeight + gapY);

        // Layout border logic
        doc.setDrawColor(203, 213, 225);
        doc.rect(x, y, cardWidth, cardHeight);
        
        doc.addImage(base64ImageString, 'PNG', x + 25, y + 1, 18, 18);
        
        doc.setFontSize(7);
        doc.setFont("Helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("MARUTHI", x + 2, y + 4);
        
        doc.setFontSize(5);
        doc.setTextColor(29, 78, 216);
        doc.text("Scratch & Scan to Win", x + 2, y + 8);
        doc.text("Instant Payout", x + 2, y + 11);
        
        doc.setFontSize(4);
        doc.setTextColor(148, 163, 184);
        doc.text(`S/N: ${fullUuidStr.substring(0, 14).toUpperCase()}...`, x + 2, y + 17);
      }
      
      doc.save(`${campaign.series_name}_Official_Maruthi_Stickers.pdf`);
    } catch (err) { 
      console.error(err);
      alert("Failed to render PDF engine labels locally: " + err.message); 
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
          <p style={cardLabel}>TOTAL PAYOUT DISTRIBUTED</p>
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
            
            <label style={fieldLabel}>Start Date (Active From)</label>
            <input style={inputField} type="date" value={formData.start_date || ''} onChange={e => setFormData({ ...formData, start_date: e.target.value })} required />

            <label style={fieldLabel}>Expiry Date</label>
            <input style={inputField} type="date" value={formData.expiry_date || ''} onChange={e => setFormData({ ...formData, expiry_date: e.target.value })} required />
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px', marginBottom: '5px', padding: '10px 0' }}>
              <input 
                type="checkbox" 
                id="is_bumper"
                checked={formData.is_bumper || false} 
                onChange={e => setFormData({ ...formData, is_bumper: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label htmlFor="is_bumper" style={{ fontSize: '13px', fontWeight: '700', color: '#cbd5e1', cursor: 'pointer' }}>
                🔥 Enable 64-Scan Bumper Cashback Loyalty Progress Tracker
              </label>
            </div>

            <button type="submit" style={primaryBtn}>GENERATE CRYPTO CODES</button>
          </form>
        </div>

        <div style={glassSection}>
          <h3 style={formTitleObject}>📦 Logistics</h3>
          <select value={selectedCampaign} onChange={e => setSelectedCampaign(e.target.value)} style={selectField}>
            {campaignList && campaignList.length > 0 ? (
              campaignList.map(c => (
                <option key={c.id} value={c.id} style={{background:'#1e293b'}}>
                  {c.series_name || `Batch #${c.id}`} {c.is_bumper ? '🔥 [BUMPER]' : ''}
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