import React, { useState } from 'react';
import AccountMenu from './AccountMenu';
import ReceiptUpload from './ReceiptUpload';
import ReceiptList from './ReceiptList';
import ReceiptsPage from './ReceiptsPage';
import TripManager from './TripManager';
import TripDetails from './TripDetails';
import SpendingTrends from './SpendingTrends';
import CategoryBreakdown from './CategoryBreakdown';
import TripExpenses from './TripExpenses';
import './Dashboard.css';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('receipts');
  const [currentView, setCurrentView] = useState('main'); // 'main', 'trip-details', or 'receipts-page'
  const [selectedTripId, setSelectedTripId] = useState(null);
  const [editingTrip, setEditingTrip] = useState(null);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'receipts':
        return (
          <>
            <section className="welcome-section">
              <h2>📄 Receipt Management</h2>
              <p>Capture, process, and organize your receipts with AI-powered OCR</p>
            </section>
            <ReceiptUpload />
            <ReceiptList onViewAllReceipts={handleViewAllReceipts} />
          </>
        );
      case 'trips':
        return (
          <TripManager 
            onViewTripDetails={(tripId) => {
              setSelectedTripId(tripId);
              setCurrentView('trip-details');
            }}
            editingTrip={editingTrip}
            onEditTrip={setEditingTrip}
          />
        );
      case 'analytics':
        return (
          <section className="analytics-section">
            <h2>📊 Analytics</h2>
            <p>Detailed spending reports and insights</p>
            
            <SpendingTrends />
            
            <CategoryBreakdown />
            
            <TripExpenses />
            
            <div className="features-grid">
              <div className="feature-card">
                <h3>📋 Export Reports</h3>
                <p>Generate reports for expense reimbursement</p>
                <span className="coming-soon">Coming Soon</span>
              </div>
            </div>
          </section>
        );
      default:
        return null;
    }
  };

  // Handle navigation back to main view
  const handleBackToMain = () => {
    setCurrentView('main');
    setSelectedTripId(null);
    setEditingTrip(null);
  };

  // Handle navigation to receipts page
  const handleViewAllReceipts = () => {
    setCurrentView('receipts-page');
  };

  // Handle trip editing from details page
  const handleEditTripFromDetails = (trip) => {
    setEditingTrip(trip);
    setCurrentView('main');
  };

  // If we're viewing the receipts page, show the ReceiptsPage component
  if (currentView === 'receipts-page') {
    return (
      <ReceiptsPage 
        onBack={handleBackToMain}
      />
    );
  }

  // If we're viewing trip details, show the TripDetails component
  if (currentView === 'trip-details' && selectedTripId) {
    return (
      <TripDetails 
        tripId={selectedTripId}
        onBack={handleBackToMain}
        onEditTrip={handleEditTripFromDetails}
      />
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          {/* Logo on the left */}
          <div className="logo">
            <h1>RM</h1>
          </div>
          
          {/* Navigation tabs in the center */}
          <nav className="header-nav">
            <div className="nav-tabs">
              <button 
                className={`nav-tab ${activeTab === 'receipts' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('receipts');
                  handleBackToMain();
                }}
              >
                📄 Receipts
              </button>
              <button 
                className={`nav-tab ${activeTab === 'trips' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('trips');
                  handleBackToMain();
                }}
              >
                ✈️ Trips
              </button>
              <button 
                className={`nav-tab ${activeTab === 'analytics' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('analytics');
                  handleBackToMain();
                }}
              >
                📊 Analytics
              </button>
            </div>
          </nav>
          
          {/* Account menu on the right */}
          <div className="account-section">
            <AccountMenu />
          </div>
        </div>
      </header>
      
      <main className="dashboard-main">
        <div className="main-content">
          {renderTabContent()}
        </div>
      </main>
    </div>
  );
}
