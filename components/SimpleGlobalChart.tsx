import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

// Simple type definition for our chart data
type WeeklyData = {
  week: string;
  avgGlaucomaScore?: number;
  avgCancerScore?: number;
  count: number;
};

interface SimpleGlobalChartProps {
  weeklyData: WeeklyData[];
  title?: string;
}

const SimpleGlobalChart: React.FC<SimpleGlobalChartProps> = ({ 
  weeklyData = [],
  title = 'Global Risk Score Trends'
}) => {
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    // Use dummy data if no data provided
    const chartData = weeklyData.length > 0 ? weeklyData : [
      { week: "2024-01", avgGlaucomaScore: 3.5, avgCancerScore: 2.8, count: 14 },
      { week: "2024-02", avgGlaucomaScore: 3.7, avgCancerScore: 3.1, count: 18 },
      { week: "2024-03", avgGlaucomaScore: 4.1, avgCancerScore: 3.3, count: 12 },
      { week: "2024-04", avgGlaucomaScore: 3.9, avgCancerScore: 3.4, count: 15 }
    ];
    
    console.log('Chart data being used:', chartData);
    
    try {
      // Simple label format
      const labels = chartData.map(d => `Week ${d.week}`);
      
      // Prepare datasets
      const datasets = [];
      
      // Add glaucoma dataset
      const hasGlaucomaData = chartData.some(d => typeof d.avgGlaucomaScore === 'number' && !isNaN(d.avgGlaucomaScore as number));
      if (hasGlaucomaData) {
        datasets.push({
          label: 'Glaucoma Risk Score',
          data: chartData.map(d => {
            const score = d.avgGlaucomaScore || 0;
            return typeof score === 'number' && !isNaN(score) ? score : 0;
          }),
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.5)',
          tension: 0.1
        });
      }
      
      // Add cancer dataset
      const hasCancerData = chartData.some(d => typeof d.avgCancerScore === 'number' && !isNaN(d.avgCancerScore as number));
      if (hasCancerData) {
        datasets.push({
          label: 'Cancer Risk Score',
          data: chartData.map(d => {
            const score = d.avgCancerScore || 0;
            return typeof score === 'number' && !isNaN(score) ? score : 0;
          }),
          borderColor: 'rgb(244, 114, 182)',
          backgroundColor: 'rgba(244, 114, 182, 0.5)',
          tension: 0.1
        });
      }
      
      // Add a "no data" dataset if needed
      if (datasets.length === 0) {
        datasets.push({
          label: 'No Data Available',
          data: [0],
          borderColor: '#cccccc',
          backgroundColor: '#f5f5f5',
          borderDash: [5, 5],
          tension: 0,
          pointRadius: 0,
        });
      }
      
      // Create chart
      const ctx = chartRef.current.getContext('2d');
      if (ctx) {
        chartInstance.current = new Chart(ctx, {
          type: 'line',
          data: {
            labels,
            datasets
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
                  text: 'Risk Score'
                }
              },
              x: {
                title: {
                  display: true,
                  text: 'Time Period'
                }
              }
            },
            plugins: {
              tooltip: { mode: 'index', intersect: false },
              legend: { position: 'top' },
              title: { display: true, text: title }
            }
          }
        });
      }
    } catch (error) {
      console.error('Error rendering chart:', error);
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [weeklyData, title]);

  return (
    <div className="relative w-full h-72 bg-white p-2 sm:p-4 rounded-lg shadow-md">
      <canvas ref={chartRef} />
    </div>
  );
};

export default SimpleGlobalChart; 