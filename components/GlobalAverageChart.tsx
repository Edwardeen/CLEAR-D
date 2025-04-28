import React, { useEffect, useRef, useState } from 'react';
import Chart from 'chart.js/auto';

interface GlobalAverageData {
  totalAssessments: number;
  averageGlaucomaScore: number;
  averageCancerScore: number;
  monthlyData: {
    month: string;
    avgGlaucomaScore: number;
    avgCancerScore: number;
    count: number;
  }[];
}

const GlobalAverageChart: React.FC = () => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalData, setGlobalData] = useState<GlobalAverageData | null>(null);

  useEffect(() => {
    const fetchGlobalData = async () => {
      try {
        const response = await fetch('/api/global-average-stats');
        if (!response.ok) {
          throw new Error('Failed to fetch global statistics');
        }
        const data = await response.json();
        setGlobalData(data);
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching global stats:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchGlobalData();
  }, []);

  useEffect(() => {
    if (!globalData || !chartRef.current) return;

    // Destroy existing chart if it exists
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    const labels = globalData.monthlyData.map(item => item.month);
    const glaucomaData = globalData.monthlyData.map(item => item.avgGlaucomaScore);
    const cancerData = globalData.monthlyData.map(item => item.avgCancerScore);

    const ctx = chartRef.current.getContext('2d');
    if (ctx) {
      chartInstance.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Average Glaucoma Score',
              data: glaucomaData,
              borderColor: 'rgb(74, 222, 128)', // green
              backgroundColor: 'rgba(74, 222, 128, 0.2)',
              tension: 0.3,
              pointRadius: 4,
              pointBackgroundColor: 'rgb(74, 222, 128)',
            },
            {
              label: 'Average Cancer Score',
              data: cancerData,
              borderColor: 'rgb(192, 132, 252)', // purple
              backgroundColor: 'rgba(192, 132, 252, 0.2)',
              tension: 0.3,
              pointRadius: 4,
              pointBackgroundColor: 'rgb(192, 132, 252)',
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              max: 10,
              title: {
                display: true,
                text: 'Risk Score (0-10)'
              }
            },
            x: {
              title: {
                display: true,
                text: 'Month/Year'
              }
            }
          },
          plugins: {
            tooltip: {
              mode: 'index',
              intersect: false,
            },
            legend: {
              position: 'top',
            },
            title: {
              display: true,
              text: 'Global Average Risk Scores (Monthly)'
            }
          }
        }
      });
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [globalData]);

  if (loading) {
    return (
      <div className="bg-white p-5 rounded-lg shadow-md mb-6">
        <div className="h-64 flex items-center justify-center">
          <p className="text-gray-500">Loading global statistics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white p-5 rounded-lg shadow-md mb-6">
        <div className="h-64 flex items-center justify-center">
          <p className="text-red-500">Error loading global statistics: {error}</p>
        </div>
      </div>
    );
  }

  if (!globalData || globalData.totalAssessments === 0) {
    return (
      <div className="bg-white p-5 rounded-lg shadow-md mb-6">
        <div className="h-64 flex items-center justify-center">
          <p className="text-gray-500">No assessment data available yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-5 rounded-lg shadow-md mb-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Global Risk Assessment Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-4">
          <div className="bg-blue-50 p-3 rounded border border-blue-100 text-center">
            <p className="text-sm text-gray-600">Total Assessments</p>
            <p className="text-2xl font-bold text-blue-600">{globalData.totalAssessments}</p>
          </div>
          <div className="bg-green-50 p-3 rounded border border-green-100 text-center">
            <p className="text-sm text-gray-600">Avg Glaucoma Score</p>
            <p className="text-2xl font-bold text-green-600">{globalData.averageGlaucomaScore}/10</p>
          </div>
          <div className="bg-purple-50 p-3 rounded border border-purple-100 text-center">
            <p className="text-sm text-gray-600">Avg Cancer Score</p>
            <p className="text-2xl font-bold text-purple-600">{globalData.averageCancerScore}/10</p>
          </div>
        </div>
      </div>
      <div className="relative h-64 w-full">
        <canvas ref={chartRef} />
      </div>
      <p className="text-xs text-gray-500 mt-2 italic">
        Data shows monthly average risk scores across all users in the system.
      </p>
    </div>
  );
};

export default GlobalAverageChart; 