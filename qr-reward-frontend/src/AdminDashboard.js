import React, { useState, useEffect } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';

const AdminDashboard = ({ onLogout }) => {
  const [analytics, setAnalytics] = useState(null);
  const [campaignList, setCampaignList] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    series_name: '', min_amount: 0, max_amount: 0, quantity: 0, expiry_date: ''
  });

  const API_BASE = "http://localhost:8000";

  const fetchData = async () => {
    try {
      // Analytics Endpoint: /admin/analytics
      const stats = await axios.get(`${API_BASE}/admin/analytics`);
      setAnalytics(stats.data);
      
      // Campaigns List Endpoint: /admin/campaigns/
      const campaigns = await axios.get(`${API_BASE}/admin/campaigns/`);
      setCampaignList(campaigns.data);
      
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
      // POST Endpoint: /admin/campaigns/
      await axios.post(`${API_BASE}/admin/campaigns/`, formData);
      alert("Batch Generated Successfully!");
      fetchData();
    } catch (error) { 
      console.error("Submit Error:", error);
      alert("Error connecting to server."); 
    }
  };

  const downloadPDF = async () => {
    if (!selectedCampaign) return alert("Select a batch!");
    const campaign = campaignList.find(c => c.id === parseInt(selectedCampaign));
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.text(`Campaign: ${campaign.series_name}`, 14, 15);

    const tableData = await Promise.all(campaign.qr_list.map(async (qr) => {
      // User Claim URL: http://localhost:3000/claim/id
      const claimUrl = `${window.location.origin}/claim/${qr.qr_code_id}`;
      const qrDataUri = await QRCode.toDataURL(claimUrl, { width: 200, margin: 1 });
      return { id: qr.qr_code_id, amount: qr.assigned_amount, status: qr.is_redeemed ? "Used" : "Active", qrImage: qrDataUri };
    }));

    autoTable(doc, {
      head: [["ID", "Amount (INR)", "Status", "QR Code"]],
      body: tableData.map(i => [i.id, i.amount, i.status, ""]),
      startY: 25,
      styles: { minCellHeight: 35, verticalAlign: 'middle', halign: 'center' },
      didDrawCell: (data) => {
        if (data.column.index === 3 && data.cell.section === 'body') {
          doc.addImage(tableData[data.row.index].qrImage, 'PNG', data.cell.x + 5, data.cell.y + 2, 30, 30);
        }
      }
    });
    doc.save(`${campaign.series_name}_Report.pdf`);
  };

  if (loading) return <div style={loaderStyle}>Syncing Premium Dashboard...</div>;

  return (
    <div style={mainContainer}>
      {/* Header, Analytics, Recent Redemptions components same as before... */}
      <div style={headerSection}>
        <div>
          <h1 style={titleStyle}>QR Code Reward <span style={{ color: '#3498db' }}>System</span></h1>
          <p style={subtitleStyle}>Professional Campaign Management System</p>
        </div>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button onClick={fetchData} style={refreshButton}>🔄 Sync Data</button>
          <button onClick={onLogout} style={logoutButton}>🚪 Logout</button>
        </div>
      </div>

      <div style={analyticsGrid}>
        <div style={cardStyle}>
          <p style={cardLabel}>Total Campaigns</p>
          <h2 style={cardValue}>{analytics?.total_campaigns}</h2>
        </div>
        <div style={cardStyle}>
          <p style={cardLabel}>Active QRs</p>
          <h2 style={cardValue}>{analytics?.total_qrs_generated}</h2>
        </div>
        <div style={{ ...cardStyle, borderLeft: '5px solid #2ecc71' }}>
          <p style={cardLabel}>Total Payout</p>
          <h2 style={{ ...cardValue, color: '#2ecc71' }}>₹{analytics?.total_payout_distributed}</h2>
        </div>
      </div>

      <div style={glassSectionFull}>
        <h3 style={sectionTitle}>Recent Redemptions</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr style={theadStyle}>
                <th style={thStyle}>Time</th>
                <th style={thStyle}>Mobile Number</th>
                <th style={thStyle}>UPI ID</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Transaction ID</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {campaignList.flatMap(c => c.qr_list)
                .filter(qr => qr.is_redeemed)
                .sort((a, b) => new Date(b.redeemed_at) - new Date(a.redeemed_at))
                .map((txn, index) => (
                  <tr key={index} style={trStyle}>
                    <td>{txn.redeemed_at ? new Date(txn.redeemed_at).toLocaleString() : 'N/A'}</td>
                    <td style={{ ...tdStyle, fontWeight: 'bold' }}>{txn.redeemed_mobile}</td>
                    <td style={tdStyle}>{txn.redeemed_upi}</td>
                    <td style={{ ...tdStyle, color: '#27ae60', fontWeight: 'bold' }}>₹{txn.assigned_amount}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '12px' }}>{txn.transaction_id}</td>
                    <td style={tdStyle}><span style={badgeSuccess}>Completed</span></td>
                  </tr>
                ))}
            </tbody>
          </table>
          {campaignList.flatMap(c => c.qr_list).filter(qr => qr.is_redeemed).length === 0 &&
            <p style={{ textAlign: 'center', color: '#95a5a6', padding: '20px' }}>No transactions found yet.</p>
          }
        </div>
      </div>

      <div style={contentGrid}>
        <div style={glassSection}>
          <h3 style={sectionTitle}>Create New Batch</h3>
          <form onSubmit={handleSubmit} style={formStyle}>
            <input style={inputField} type="text" placeholder="Batch Name" onChange={e => setFormData({ ...formData, series_name: e.target.value })} required />
            <div style={{ display: 'flex', gap: '10px' }}>
              <input style={inputField} type="number" placeholder="Min" onChange={e => setFormData({ ...formData, min_amount: e.target.value })} required />
              <input style={inputField} type="number" placeholder="Max" onChange={e => setFormData({ ...formData, max_amount: e.target.value })} required />
            </div>
            <input style={inputField} type="number" placeholder="Quantity" onChange={e => setFormData({ ...formData, quantity: e.target.value })} required />
            <input style={inputField} type="date" onChange={e => setFormData({ ...formData, expiry_date: e.target.value })} required />
            <button type="submit" style={primaryButton}>Generate Smart QRs</button>
          </form>
        </div>

        <div style={glassSection}>
          <h3 style={sectionTitle}>Export Reports</h3>
          <select value={selectedCampaign} onChange={e => setSelectedCampaign(e.target.value)} style={selectField}>
            <option value="">-- Choose Campaign --</option>
            {campaignList.map(c => <option key={c.id} value={c.id}>{c.series_name}</option>)}
          </select>
          <button onClick={downloadPDF} disabled={!selectedCampaign} style={downloadButton}>📥 Download PDF</button>
        </div>
      </div>
    </div>
  );
};

// Styles remain exactly as they were in your previous code...
const mainContainer = { padding: '40px', backgroundColor: '#f0f4f8', minHeight: '100vh', fontFamily: 'sans-serif' };
const headerSection = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' };
const titleStyle = { margin: 0, fontSize: '28px', color: '#2c3e50' };
const subtitleStyle = { margin: 0, color: '#7f8c8d', fontSize: '14px' };
const analyticsGrid = { display: 'flex', gap: '20px', marginBottom: '30px' };
const cardStyle = { backgroundColor: '#fff', padding: '20px', borderRadius: '15px', flex: 1, boxShadow: '0 4px 15px rgba(0,0,0,0.05)' };
const cardLabel = { margin: 0, color: '#95a5a6', fontSize: '12px', fontWeight: 'bold' };
const cardValue = { margin: '10px 0 0 0', fontSize: '28px' };
const contentGrid = { display: 'flex', gap: '20px' };
const glassSection = { backgroundColor: '#fff', padding: '25px', borderRadius: '15px', flex: 1, boxShadow: '0 4px 15px rgba(0,0,0,0.05)' };
const glassSectionFull = { backgroundColor: '#fff', padding: '25px', borderRadius: '15px', marginBottom: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' };
const sectionTitle = { marginTop: 0, color: '#34495e', borderLeft: '4px solid #3498db', paddingLeft: '10px' };
const formStyle = { display: 'flex', flexDirection: 'column', gap: '10px' };
const inputField = { padding: '12px', borderRadius: '8px', border: '1px solid #ddd' };
const selectField = { width: '100%', padding: '12px', borderRadius: '8px', marginBottom: '15px' };
const primaryButton = { backgroundColor: '#3498db', color: 'white', padding: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' };
const downloadButton = { width: '100%', backgroundColor: '#2c3e50', color: 'white', padding: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer' };
const refreshButton = { backgroundColor: '#fff', color: '#3498db', padding: '8px 15px', border: '1px solid #3498db', borderRadius: '5px', cursor: 'pointer' };
const logoutButton = { backgroundColor: '#e74c3c', color: 'white', padding: '8px 15px', border: 'none', borderRadius: '5px', cursor: 'pointer' };
const loaderStyle = { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' };

const tableStyle = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' };
const theadStyle = { backgroundColor: '#f8f9fa', borderBottom: '2px solid #eee' };
const thStyle = { padding: '12px', color: '#7f8c8d', fontSize: '14px' };
const tdStyle = { padding: '12px', borderBottom: '1px solid #eee', fontSize: '14px' };
const trStyle = { transition: '0.3s' };
const badgeSuccess = { backgroundColor: '#d4edda', color: '#155724', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' };

export default AdminDashboard;