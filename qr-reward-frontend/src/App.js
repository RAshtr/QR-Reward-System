import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Import all your pages
import AdminDashboard from './AdminDashboard'; 
import ClaimPage from './ClaimPage';
import LoginPage from './LoginPage';

function App() {
  // Check if the user is already logged in (using localStorage)
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem('adminToken') === 'true'
  );

  // Function to handle login
  const login = () => {
    setIsAuthenticated(true);
    localStorage.setItem('adminToken', 'true');
  };

  // Function to handle logout
  const logout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('adminToken');
  };

  return (
    <Router>
      <Routes>
        {/* 1. Public Route: Anyone can see the claim page */}
        <Route path="/claim/:qr_id" element={<ClaimPage />} />

        {/* 2. Login Route */}
        <Route path="/login" element={<LoginPage onLogin={login} />} />

        {/* 3. Protected Route: Only visible if logged in */}
        <Route 
          path="/admin" 
          element={
            isAuthenticated ? (
              <AdminDashboard onLogout={logout} /> 
            ) : (
              <Navigate to="/login" />
            )
          } 
        />

        {/* 4. Default Route: Redirect to admin */}
        <Route path="/" element={<Navigate to="/admin" />} />
      </Routes>
    </Router>
  );
}

export default App;