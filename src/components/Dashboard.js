import React, { useState } from 'react';
import AccountMenu from './AccountMenu';
import ReceiptUpload from './ReceiptUpload';
import ReceiptList from './ReceiptList';
import TripManager from './TripManager';
import './Dashboard.css';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('receipts');

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
            <ReceiptList />
          </>
        );
      case 'trips':
        return <TripManager />;
      case 'analytics':
        return (
          <section className="analytics-section">
            <h2>📊 Analytics</h2>
            <p>Coming soon: Detailed spending reports and insights</p>
            <div className="features-grid">
              <div className="feature-card">
                <h3>📈 Spending Trends</h3>
                <p>Track your spending patterns over time</p>
              </div>
              <div className="feature-card">
                <h3>🏷️ Category Breakdown</h3>
                <p>See where your money goes by category</p>
              </div>
              <div className="feature-card">
                <h3>✈️ Trip Expenses</h3>
                <p>Analyze costs for each trip</p>
              </div>
              <div className="feature-card">
                <h3>📋 Export Reports</h3>
                <p>Generate reports for expense reimbursement</p>
              </div>
            </div>
          </section>
        );
      default:
        return null;
    }
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>🧾 Receipt Manager</h1>
          <AccountMenu />
        </div>
      </header>
      
      <nav className="dashboard-nav">
        <div className="nav-tabs">
          <button 
            className={`nav-tab ${activeTab === 'receipts' ? 'active' : ''}`}
            onClick={() => setActiveTab('receipts')}
          >
            📄 Receipts
          </button>
          <button 
            className={`nav-tab ${activeTab === 'trips' ? 'active' : ''}`}
            onClick={() => setActiveTab('trips')}
          >
            ✈️ Trips
          </button>
          <button 
            className={`nav-tab ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            📊 Analytics
          </button>
        </div>
      </nav>
      
      <main className="dashboard-main">
        <div className="main-content">
          {renderTabContent()}
        </div>
      </main>
    </div>
  );
}
