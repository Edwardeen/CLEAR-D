import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const TestChart = () => {
  // Static test data
  const testData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Glaucoma Risk Score',
        data: [3.5, 4.2, 4.8, 5.1, 4.9, 5.3],
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.5)',
        tension: 0.1
      },
      {
        label: 'Cancer Risk Score',
        data: [2.8, 3.2, 3.6, 3.9, 4.1, 4.3],
        borderColor: 'rgb(244, 114, 182)',
        backgroundColor: 'rgba(244, 114, 182, 0.5)',
        tension: 0.1
      }
    ]
  };

  // Chart options
  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Test Chart - Static Data'
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Risk Score'
        },
        min: 0,
        max: 10
      },
      x: {
        title: {
          display: true,
          text: 'Month'
        }
      }
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Simple Test Chart</h2>
      <div className="h-80">
        <Line data={testData} options={chartOptions} />
      </div>
      
      <div className="mt-4 bg-gray-50 p-4 rounded">
        <h3 className="font-medium mb-2">Test Data Summary</h3>
        <p>This chart uses hard-coded data to verify that Chart.js rendering is working correctly.</p>
        <p className="text-sm mt-2">Data Points: Glaucoma (6), Cancer (6)</p>
      </div>
    </div>
  );
};

export default TestChart; 