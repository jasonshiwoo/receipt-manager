import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import './SpendingTrends.css';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function SpendingTrends() {
  const [user] = useAuthState(auth);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Fetch receipts from Firestore
  useEffect(() => {
    if (!user) return;

    const receiptsRef = collection(db, 'receipts');
    const q = query(
      receiptsRef,
      where('userId', '==', user.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const receiptsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setReceipts(receiptsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Filter receipts by date range
  const getFilteredReceipts = () => {
    if (!receipts.length) return [];

    const now = new Date();
    let startDate, endDate;

    switch (dateFilter) {
      case 'thisMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'lastMonth':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'last3Months':
        startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        endDate = now;
        break;
      case 'thisYear':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = now;
        break;
      case 'custom':
        if (customStartDate && customEndDate) {
          startDate = new Date(customStartDate);
          endDate = new Date(customEndDate);
          endDate.setHours(23, 59, 59, 999); // Include the entire end date
        } else {
          return receipts;
        }
        break;
      default:
        return receipts;
    }

    return receipts.filter(receipt => {
      const receiptDate = receipt.date?.toDate ? receipt.date.toDate() : new Date(receipt.date);
      return receiptDate >= startDate && receiptDate <= endDate;
    });
  };

  // Calculate spending by category
  const getSpendingByCategory = () => {
    const filteredReceipts = getFilteredReceipts();
    const categoryTotals = {};

    filteredReceipts.forEach(receipt => {
      const category = receipt.category || 'Uncategorized';
      const amount = parseFloat(receipt.total) || 0;
      categoryTotals[category] = (categoryTotals[category] || 0) + amount;
    });

    // Sort by amount and get top 5 categories
    const sortedCategories = Object.entries(categoryTotals)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);

    return sortedCategories;
  };

  // Prepare chart data
  const getChartData = () => {
    const spendingData = getSpendingByCategory();
    
    if (!spendingData.length) {
      return {
        labels: ['No Data'],
        datasets: [{
          label: 'Spending ($)',
          data: [0],
          backgroundColor: ['rgba(156, 163, 175, 0.5)'],
          borderColor: ['rgba(156, 163, 175, 1)'],
          borderWidth: 1,
        }]
      };
    }

    const labels = spendingData.map(([category]) => category);
    const amounts = spendingData.map(([, amount]) => amount);

    // Generate colors for each category
    const colors = [
      'rgba(59, 130, 246, 0.8)',   // Blue
      'rgba(16, 185, 129, 0.8)',   // Green
      'rgba(245, 158, 11, 0.8)',   // Yellow
      'rgba(239, 68, 68, 0.8)',    // Red
      'rgba(139, 92, 246, 0.8)',   // Purple
    ];

    const borderColors = [
      'rgba(59, 130, 246, 1)',
      'rgba(16, 185, 129, 1)',
      'rgba(245, 158, 11, 1)',
      'rgba(239, 68, 68, 1)',
      'rgba(139, 92, 246, 1)',
    ];

    return {
      labels,
      datasets: [{
        label: 'Spending ($)',
        data: amounts,
        backgroundColor: colors.slice(0, amounts.length),
        borderColor: borderColors.slice(0, amounts.length),
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      }]
    };
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Top Spending Categories',
        font: {
          size: 16,
          weight: 'bold'
        },
        color: '#374151'
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `$${context.parsed.y.toFixed(2)}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return '$' + value.toFixed(0);
          }
        },
        grid: {
          color: 'rgba(156, 163, 175, 0.2)'
        }
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          maxRotation: 45,
          minRotation: 0
        }
      }
    }
  };

  // Get total spending for the period
  const getTotalSpending = () => {
    const filteredReceipts = getFilteredReceipts();
    return filteredReceipts.reduce((total, receipt) => {
      return total + (parseFloat(receipt.total) || 0);
    }, 0);
  };

  // Get date range display text
  const getDateRangeText = () => {
    switch (dateFilter) {
      case 'thisMonth':
        return 'This Month';
      case 'lastMonth':
        return 'Last Month';
      case 'last3Months':
        return 'Last 3 Months';
      case 'thisYear':
        return 'This Year';
      case 'custom':
        if (customStartDate && customEndDate) {
          return `${new Date(customStartDate).toLocaleDateString()} - ${new Date(customEndDate).toLocaleDateString()}`;
        }
        return 'Custom Range';
      default:
        return 'All Time';
    }
  };

  if (loading) {
    return (
      <div className="spending-trends">
        <div className="spending-trends-header">
          <h3>📈 Spending Trends</h3>
        </div>
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  return (
    <div className="spending-trends">
      <div className="spending-trends-header">
        <h3>📈 Spending Trends</h3>
        <div className="date-filter">
          <select 
            value={dateFilter} 
            onChange={(e) => setDateFilter(e.target.value)}
            className="date-filter-select"
          >
            <option value="all">All Time</option>
            <option value="thisMonth">This Month</option>
            <option value="lastMonth">Last Month</option>
            <option value="last3Months">Last 3 Months</option>
            <option value="thisYear">This Year</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>
      </div>

      {dateFilter === 'custom' && (
        <div className="custom-date-range">
          <input
            type="date"
            value={customStartDate}
            onChange={(e) => setCustomStartDate(e.target.value)}
            className="date-input"
          />
          <span>to</span>
          <input
            type="date"
            value={customEndDate}
            onChange={(e) => setCustomEndDate(e.target.value)}
            className="date-input"
          />
        </div>
      )}

      <div className="spending-summary">
        <div className="summary-item">
          <span className="summary-label">Period:</span>
          <span className="summary-value">{getDateRangeText()}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Total Spent:</span>
          <span className="summary-value total-amount">${getTotalSpending().toFixed(2)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Receipts:</span>
          <span className="summary-value">{getFilteredReceipts().length}</span>
        </div>
      </div>

      <div className="chart-container">
        <Bar data={getChartData()} options={chartOptions} />
      </div>

      {getSpendingByCategory().length === 0 && (
        <div className="no-data-message">
          <p>No spending data available for the selected period.</p>
          <p>Upload some receipts to see your spending trends!</p>
        </div>
      )}
    </div>
  );
}
