import React, { useMemo } from 'react';
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

interface UserTrendChartProps {
  data: { date: string; score: number }[];
  title: string;
  color: string;
}

const UserTrendChart: React.FC<UserTrendChartProps> = ({ data, title, color }) => {
  // Chart options
  const options: ChartOptions<'line'> = useMemo(() => ({
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: title,
        font: {
          size: 16,
          weight: 'bold'
        },
        color: '#333'
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        titleColor: '#333',
        bodyColor: '#333',
        borderColor: color,
        borderWidth: 1,
        padding: 10,
        boxPadding: 5,
        displayColors: false,
        callbacks: {
          label: function(context) {
            return `Score: ${context.parsed.y.toFixed(2)}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 10,
        title: {
          display: true,
          text: 'Risk Score',
          color: '#666'
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Assessment Date',
          color: '#666'
        },
        grid: {
          display: false
        }
      }
    }
  }), [title, color]);

  // Chart data
  const chartData = useMemo(() => ({
    labels: data.map(item => item.date),
    datasets: [
      {
        label: title,
        data: data.map(item => item.score),
        borderColor: color,
        backgroundColor: `${color}33`, // Add transparency
        borderWidth: 3,
        pointBackgroundColor: color,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        fill: true,
        tension: 0.3,
        pointHoverBackgroundColor: color,
        pointHoverBorderColor: '#fff',
        pointHoverBorderWidth: 3
      }
    ]
  }), [data, title, color]);

  return (
    <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
      {data.length > 0 && (
        <div className="flex justify-between items-center mb-2 text-sm text-gray-600">
          <div>
            First assessment: {data[0].date}
          </div>
          <div>
            Latest score: <span className="font-bold" style={{ color }}>{data[data.length - 1].score.toFixed(1)}</span>
          </div>
        </div>
      )}
      <div className="h-64">
        <Line options={options} data={chartData} />
      </div>
      {data.length > 1 && (
        <div className="mt-3 text-sm text-gray-600">
          <div className="flex justify-between">
            <div>Assessments: {data.length}</div>
            <div>
              Trend: {data[data.length - 1].score > data[0].score 
                ? <span className="text-red-600">↗ Increasing</span> 
                : data[data.length - 1].score < data[0].score 
                  ? <span className="text-green-600">↘ Decreasing</span> 
                  : <span className="text-gray-600">→ Stable</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserTrendChart; 