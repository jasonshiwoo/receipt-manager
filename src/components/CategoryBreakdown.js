import React, { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Pie } from 'react-chartjs-2';
import './CategoryBreakdown.css';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend);

export default function CategoryBreakdown() {
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
          endDate.setHours(23, 59, 59, 999);
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
  const getCategoryBreakdown = () => {
    const filteredReceipts = getFilteredReceipts();
    const categoryTotals = {};

    filteredReceipts.forEach(receipt => {
      const category = receipt.category || 'Uncategorized';
      const amount = parseFloat(receipt.total) || 0;
      categoryTotals[category] = (categoryTotals[category] || 0) + amount;
    });

    // Convert to array and sort by amount
    const sortedCategories = Object.entries(categoryTotals)
      .sort(([,a], [,b]) => b - a);

    return sortedCategories;
  };

  // Generate colors for pie chart
  const generateColors = (count) => {
    const baseColors = [
      '#3B82F6', // Blue
      '#10B981', // Green
      '#F59E0B', // Yellow
      '#EF4444', // Red
      '#8B5CF6', // Purple
      '#F97316', // Orange
      '#06B6D4', // Cyan
      '#84CC16', // Lime
      '#EC4899', // Pink
      '#6366F1', // Indigo
    ];

    const colors = [];
    for (let i = 0; i < count; i++) {
      if (i < baseColors.length) {
        colors.push(baseColors[i]);
      } else {
        // Generate additional colors using HSL
        const hue = (i * 137.508) % 360; // Golden angle approximation
        colors.push(`hsl(${hue}, 70%, 60%)`);
      }
    }
    return colors;
  };

  // Prepare chart data
  const getChartData = () => {
    const categoryData = getCategoryBreakdown();
    
    if (!categoryData.length) {
      return {
        labels: ['No Data'],
        datasets: [{
          data: [1],
          backgroundColor: ['rgba(156, 163, 175, 0.5)'],
          borderColor: ['rgba(156, 163, 175, 1)'],
          borderWidth: 2,
        }]
      };
    }

    const labels = categoryData.map(([category]) => category);
    const amounts = categoryData.map(([, amount]) => amount);
    const colors = generateColors(categoryData.length);

    return {
      labels,
      datasets: [{
        data: amounts,
        backgroundColor: colors,
        borderColor: colors.map(color => color.replace(')', ', 0.8)').replace('rgb', 'rgba')),
        borderWidth: 2,
        hoverOffset: 4,
      }]
    };
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          padding: 20,
          usePointStyle: true,
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((context.parsed / total) * 100).toFixed(1);
            return `${context.label}: $${context.parsed.toFixed(2)} (${percentage}%)`;
          }
        }
      }
    }
  };

  // Get total spending and category count
  const getTotalSpending = () => {
    const filteredReceipts = getFilteredReceipts();
    return filteredReceipts.reduce((total, receipt) => {
      return total + (parseFloat(receipt.total) || 0);
    }, 0);
  };

  const getCategoryCount = () => {
    return getCategoryBreakdown().length;
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
      <div className="category-breakdown">
        <div className="category-breakdown-header">
          <h3>🏷️ Category Breakdown</h3>
        </div>
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  return (
    <div className="category-breakdown">
      <div className="category-breakdown-header">
        <h3>🏷️ Category Breakdown</h3>
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

      <div className="breakdown-summary">
        <div className="summary-item">
          <span className="summary-label">Period:</span>
          <span className="summary-value">{getDateRangeText()}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Total Spent:</span>
          <span className="summary-value total-amount">${getTotalSpending().toFixed(2)}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Categories:</span>
          <span className="summary-value">{getCategoryCount()}</span>
        </div>
      </div>

      <div className="chart-container">
        <Pie data={getChartData()} options={chartOptions} />
      </div>

      {getCategoryBreakdown().length > 0 && (
        <div className="category-list">
          <h4>Category Details</h4>
          <div className="category-items">
            {getCategoryBreakdown().map(([category, amount], index) => {
              const total = getTotalSpending();
              const percentage = total > 0 ? ((amount / total) * 100).toFixed(1) : 0;
              const colors = generateColors(getCategoryBreakdown().length);
              
              return (
                <div key={category} className="category-item">
                  <div className="category-info">
                    <div 
                      className="category-color" 
                      style={{ backgroundColor: colors[index] }}
                    ></div>
                    <span className="category-name">{category}</span>
                  </div>
                  <div className="category-stats">
                    <span className="category-amount">${amount.toFixed(2)}</span>
                    <span className="category-percentage">{percentage}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {getCategoryBreakdown().length === 0 && (
        <div className="no-data-message">
          <p>No spending data available for the selected period.</p>
          <p>Upload some receipts to see your category breakdown!</p>
        </div>
      )}
    </div>
  );
}
