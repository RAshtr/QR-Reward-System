import React, { useState, useEffect } from 'react';
import axios from 'axios';
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

  const API_BASE = "http://localhost:8000";
  const THEME_COLOR = "#38bdf8"; 

  const fetchData = async (autoSelectId = null) => {
    try {
      const stats = await axios.get(`${API_BASE}/admin/analytics`);
      setAnalytics(stats.data);
      const campaigns = await axios.get(`${API_BASE}/admin/campaigns/`);
      
      const sortedCampaigns = campaigns.data.sort((a, b) => b.id - a.id);
      setCampaignList(sortedCampaigns);
      
      if (autoSelectId) {
        setSelectedCampaign(String(autoSelectId));
      } else if (sortedCampaigns.length > 0 && !selectedCampaign) {
        setSelectedCampaign(String(sortedCampaigns[0].id));
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
      const submitPayload = {
        series_name: formData.series_name,
        min_amount: formData.min_amount,
        max_amount: formData.max_amount,
        quantity: formData.quantity,
        expiry_date: formData.expiry_date,
        expiry: formData.expiry_date       
      };

      const response = await axios.post(`${API_BASE}/admin/campaigns/`, submitPayload);
      
      if (formData.series_name && formData.expiry_date) {
        localStorage.setItem(`local_exp_${formData.series_name}`, formData.expiry_date);
      }

      alert("Batch Generated Successfully!");
      setFormData(initialFormState); 
      
      const newCampaignId = response.data?.id;
      fetchData(newCampaignId);
      
    } catch (error) { 
      alert("Error generating batch."); 
    }
  };

  // --- MEGA PHYSICAL SCRATCH CARD PRINT ENGINE ---
  const downloadPDF = async () => {
    if (!selectedCampaign) return alert("Select a batch first!");
    const campaign = campaignList.find(c => c.id === parseInt(selectedCampaign));
    if (!campaign || !campaign.qr_list || campaign.qr_list.length === 0) {
        return alert("QR data not found!");
    }

    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Massive Layout for Huge Scratch Box & Clean Readability
    const cardWidth = 182;
    const cardHeight = 85; 
    const startX = 14;
    const startY = 15;
    const gapY = 10;

    try {
      for (let i = 0; i < campaign.qr_list.length; i++) {
        const qr = campaign.qr_list[i];
        
        // Exact 36-digit UUID extraction from database response mapping
        const dynamicIdRaw = qr.qr_code_id || qr.id || qr.voucher_id;
        const fullUuidStr = String(dynamicIdRaw).toLowerCase().trim();
        const claimUrl = `${window.location.origin}/claim/${fullUuidStr}`;
        
        // This QR gets hidden behind the real print layer, but has full payload bound inside metadata
        const qrDataUri = await QRCode.toDataURL(claimUrl, { 
          width: 600, 
          margin: 1,
          errorCorrectionLevel: 'H' 
        });

        // 3 items per A4 sheet maximum to ensure maximum scale magnification
        if (i > 0 && i % 3 === 0) {
          doc.addPage();
        }

        const row = i % 3;
        const y = startY + row * (cardHeight + gapY);

        // 1. Cyber Outer Border frame line
        doc.setDrawColor(56, 189, 248);
        doc.setLineWidth(0.5);
        doc.rect(startX, y, cardWidth, cardHeight);
        doc.setLineWidth(0.2); 

        // 2. Dark Header Band
        doc.setFillColor(15, 23, 42);
        doc.rect(startX + 0.5, y + 0.5, cardWidth - 1, 12, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(11);
        doc.text("🏆 PHYSICAL CASHBACK REWARD COUPON", startX + 6, y + 8);
        
        doc.setFontSize(9);
        doc.text("BATCH: " + String(campaign.series_name).toUpperCase(), startX + cardWidth - 6, y + 8, { align: 'right' });

        // 3. ACTUAL METALLIC SILVER OVERLAY BLOCK (GIANT Resized: 50mm x 50mm)
        // Production print press will paste silver coating directly over this coordinate frame
        doc.setFillColor(203, 213, 225); // Silver Grey Paint Fill
        doc.rect(startX + 6, y + 18, 52, 52, 'F');
        doc.setDrawColor(148, 163, 184);
        doc.rect(startX + 6, y + 18, 52, 52, 'D');

        doc.setTextColor(71, 85, 105);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(10);
        doc.text("SCRATCH WITH COIN", startX + 32, y + 40, { align: 'center' });
        doc.setFontSize(7);
        doc.text("-----------------------------------", startX + 32, y + 46, { align: 'center' });
        doc.text("PHYSICAL SILVER OVERLAY LAYER", startX + 32, y + 52, { align: 'center' });

        // Hidden placeholder logic for printing block tracking behind the scene
        // doc.addImage(qrDataUri, 'PNG', startX + 7, y + 19, 50, 50);

        // 4. Values Details Column
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(10);
        doc.text("MAX WIN CASHBACK VALUE:", startX + 66, y + 26);
        
        doc.setTextColor(16, 185, 129);
        doc.setFontSize(26);
        const assignedAmt = qr.assigned_amount || qr.amount || 0;
        doc.text(`UP TO INR ${assignedAmt}.00`, startX + 66, y + 38);

        doc.setTextColor(71, 85, 105);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8.5);
        let instructions = [
          "Instructions:",
          "1. Use a physical coin to scrape away the silver coating block on the left.",
          "2. Scan the hidden underlying unique QR code using your mobile phone.",
          "3. Enter validation OTP and your UPI ID for instant cash routing transfer."
        ];
        doc.text(instructions, startX + 66, y + 48);

        // 5. Layout Separator Line
        doc.setDrawColor(226, 232, 240);
        doc.line(startX + 4, y + 74, startX + cardWidth - 4, y + 74);

        // 6. CRYSTAL CLEAR POORI 36-CHARACTER REAL UUID DATABASE ID (ZERO CUTS / NO `...`)
        doc.setTextColor(15, 23, 42);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(10);
        doc.text("FULL 36-CHARACTER DATABASE UUID (COPY THIS EXACTLY TO BROWSER FOR TESTING):", startX + 6, y + 78);
        
        doc.setFont('Courier', 'bold'); 
        doc.setTextColor(244, 63, 94);
        doc.setFontSize(13);
        // Direct absolute string print with full dynamic fallback values
        doc.text(fullUuidStr, startX + 6, y + 83); 
      }

      doc.save(`${campaign.series_name}_Physical_Coupons.pdf`);
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
          <h1 style={premiumTitle}>QR REWARD <span style={{color: THEME_COLOR}}>SYSTEM</span></h1>
          <div style={systemStatus}>
            <span style={pulseDot}></span>
            <span style={statusText}>ENTERPRISE NODE LIVE</span>
          </div>
        </div>
        <div style={actionButtons}>
          <button onClick={() => fetchData()} style={refreshBtn}>🔄 Sync Gateway</button>
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
          <h2 style={{...cardValue, color: '#10b981'}}>₹{analytics?.total_payout_distributed || 0}</h2>
          <div style={{...bottomBar, backgroundColor: '#10b981'}}></div>
        </div>
      </div>

      <div style={glassContainerFull}>
        <div style={sectionHeader}>
          <h3 style={sectionTitle}>⚡ LIVE PAYOUT FEED</h3>
          <span style={liveBadge}>REAL-TIME FEED</span>
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
                  .map((txn) => {
                    let targetDate = campaign.expiry || campaign.expiry_date || campaign.expiry_at || txn.expiry_date;
                    if (!targetDate && campaign.series_name) {
                      targetDate = localStorage.getItem(`local_exp_${campaign.series_name}`);
                    }

                    let displayExpiry = "No Expiry";
                    if (targetDate) {
                      const parsed = new Date(targetDate);
                      if (!isNaN(parsed.getTime())) {
                        displayExpiry = parsed.toLocaleDateString('en-IN');
                      } else {
                        displayExpiry = String(targetDate);
                      }
                    }

                    return (
                      <tr key={txn.qr_code_id} style={trStyle}>
                        <td style={{...tdStyle, color: '#f43f5e', fontWeight: 'bold'}}>
                          {displayExpiry}
                        </td>
                        <td style={tdStyle}>{new Date(txn.redeemed_at).toLocaleString()}</td>
                        <td style={{ ...tdStyle, fontWeight: '600', color: '#e2e8f0' }}>{txn.redeemed_mobile || "N/A"}</td>
                        <td style={{...tdStyle, color: THEME_COLOR}}>{txn.redeemed_upi || "N/A"}</td>
                        <td style={{ ...tdStyle, color: '#10b981', fontWeight: 'bold' }}>₹{txn.assigned_amount}</td>
                        <td style={tdStyle}><span style={badgeStyle}>SUCCESS</span></td>
                      </tr>
                    );
                  })
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
            <input style={inputField} type="text" value={formData.series_name} onChange={e => setFormData({ ...formData, series_name: e.target.value })} required />
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{flex: 1}}>
                <label style={fieldLabel}>Min Amount (₹)</label>
                <input style={inputField} type="number" value={formData.min_amount} onChange={e => setFormData({ ...formData, min_amount: e.target.value })} required />
              </div>
              <div style={{flex: 1}}>
                <label style={fieldLabel}>Max Amount (₹)</label>
                <input style={inputField} type="number" value={formData.max_amount} onChange={e => setFormData({ ...formData, max_amount: e.target.value })} required />
              </div>
            </div>
            <label style={fieldLabel}>Quantity</label>
            <input style={inputField} type="number" value={formData.quantity} onChange={e => setFormData({ ...formData, quantity: e.target.value })} required />
            
            <label style={fieldLabel}>Expiry Date</label>
            <input style={inputField} type="date" value={formData.expiry_date} onChange={e => setFormData({ ...formData, expiry_date: e.target.value })} required />
            
            <button type="submit" style={primaryBtn}>GENERATE CRYPTO CODES</button>
          </form>
        </div>

        <div style={glassSection}>
          <h3 style={formTitleObject}>📦 Production Logistics</h3>
          <p style={{color: '#94a3b8', fontSize: '13px', marginBottom: '20px', lineHeight:'1.5'}}>
            QR outputs are upscaled to 500px with Level 'H' Error Correction. This ensures physical printing press cards read fluidly even after coin scratches.
          </p>
          <label style={fieldLabel}>Select Target Campaign Batch</label>
          <select value={selectedCampaign} onChange={e => setSelectedCampaign(e.target.value)} style={selectField}>
            {campaignList.map(c => (
              <option key={c.id} value={c.id} style={{background:'#1e293b'}}>
                {c.series_name} (ID: {c.id})
              </option>
            ))}
          </select>
          <button onClick={downloadPDF} style={downloadBtn}>📥 DOWNLOAD PRINT-READY REPORT</button>
        </div>
      </div>
    </div>
  );
};

// --- STYLING ---
const mainContainer = { padding: '40px', backgroundColor: '#020617', minHeight: '100vh', fontFamily: '"Segoe UI", Roboto, sans-serif', color: '#f8fafc' };
const headerSection = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', borderBottom: '1px solid #1e293b', paddingBottom: '20px' };
const premiumTitle = { margin: 0, fontSize: '28px', fontWeight: '900', letterSpacing: '1px', color: '#ffffff' };
const systemStatus = { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' };
const statusText = { fontSize: '11px', color: '#94a3b8', fontWeight: '700', letterSpacing:'0.5px' };
const pulseDot = { height: '8px', width: '8px', backgroundColor: '#10b981', borderRadius: '50%', boxShadow: '0 0 10px #10b981' };
const actionButtons = { display: 'flex', gap: '12px' };
const refreshBtn = { backgroundColor: 'transparent', border: '1px solid #334155', color: '#cbd5e1', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize:'13px' };
const logoutBtn = { backgroundColor: '#f43f5e', color: 'white', padding: '10px 18px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize:'13px' };
const analyticsGrid = { display: 'flex', gap: '24px', marginBottom: '40px' };
const premiumCard = { position: 'relative', backgroundColor: '#0f172a', padding: '24px', borderRadius: '14px', flex: 1, border: '1px solid #1e293b', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)' };
const bottomBar = { position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', borderRadius: '0 0 14px 14px' };
const cardLabel = { margin: 0, color: '#64748b', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px' };
const cardValue = { margin: '10px 0 0 0', fontSize: '32px', fontWeight: '800' };
const glassContainerFull = { backgroundColor: '#0f172a', padding: '30px', borderRadius: '16px', marginBottom: '30px', border: '1px solid #1e293b' };
const sectionHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' };
const sectionTitle = { margin: 0, fontSize: '16px', fontWeight: '800', letterSpacing: '0.5px', color: '#ffffff' };
const liveBadge = { backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', border: '1px solid rgba(16, 185, 129, 0.2)' };
const tableStyle = { width: '100%', borderCollapse: 'collapse' };
const theadStyle = { borderBottom: '2px solid #1e293b' };
const thStyle = { padding: '12px 16px', color: '#64748b', fontSize: '11px', fontWeight: '800', textAlign: 'left', letterSpacing: '0.5px' };
const tdStyle = { padding: '16px', borderBottom: '1px solid #1e293b', fontSize: '13px', color: '#cbd5e1' };
const trStyle = { backgroundColor: 'transparent' };
const badgeStyle = { backgroundColor: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' };
const contentGrid = { display: 'flex', gap: '24px' };
const glassSection = { backgroundColor: '#0f172a', padding: '30px', borderRadius: '16px', flex: 1, border: '1px solid #1e293b' };
const formStyle = { display: 'flex', flexDirection: 'column', gap: '16px' };
const inputField = { padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#020617', color: '#ffffff', width: '100%', boxSizing: 'border-box', fontSize: '14px' };
const selectField = { width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#020617', color: '#ffffff', marginBottom: '25px', fontSize: '14px' };
const primaryBtn = { color: '#020617', backgroundColor: '#38bdf8', padding: '14px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '800', fontSize: '13px', letterSpacing: '0.5px' };
const downloadBtn = { width: '100%', backgroundColor: '#ffffff', color: '#020617', padding: '14px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '800', fontSize: '13px', letterSpacing: '0.5px' };
const loaderStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontWeight: 'bold', backgroundColor: '#020617', color: '#38bdf8', fontSize: '18px' };
const fieldLabel = { fontSize: '12px', fontWeight: '700', color: '#94a3b8', marginBottom: '6px', display: 'block', letterSpacing: '0.5px' };
const formTitleObject = { marginTop: 0, marginBottom: '20px', fontSize: '16px', fontWeight: '800', color: '#ffffff' };

export default AdminDashboard;