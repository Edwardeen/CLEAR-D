import React, { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
}

interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

// Helper function to generate distinct colors for bars
const generateBarColors = (numColors: number): string[] => {
  const colors: string[] = [];
  // Predefined good-looking colors
  const baseColors = [
    'rgba(54, 162, 235, 0.6)', // Blue
    'rgba(255, 99, 132, 0.6)', // Red
    'rgba(75, 192, 192, 0.6)', // Green (Teal)
    'rgba(255, 206, 86, 0.6)', // Yellow
    'rgba(153, 102, 255, 0.6)', // Purple
    'rgba(255, 159, 64, 0.6)'  // Orange
  ];
  for (let i = 0; i < numColors; i++) {
    colors.push(baseColors[i % baseColors.length]);
  }
  return colors;
};

const IllnessDistributionChart: React.FC = () => {
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/charts/assessment-trends');
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Failed to fetch distribution data' }));
          throw new Error(errorData.message || `Error: ${response.status}`);
        }
        const apiResponse = await response.json();
        
        if (apiResponse.illnessDistribution && apiResponse.illnessDistribution.labels && apiResponse.illnessDistribution.datasets) {
            const rawData = apiResponse.illnessDistribution;
            const backgroundColors = generateBarColors(rawData.labels.length);
            const borderColors = backgroundColors.map(color => color.replace('0.6', '1')); // Make border fully opaque

            setChartData({
                labels: rawData.labels,
                datasets: rawData.datasets.map((ds: ChartDataset) => ({
                    ...ds,
                    backgroundColor: backgroundColors,
                    borderColor: borderColors,
                    borderWidth: 1
                }))
            });
        } else {
            setChartData(null);
            // setError('Illness distribution data not found or malformed in API response.');
        }

      } catch (err: any) {
        setError(err.message || 'An unknown error occurred while fetching distribution data.');
        setChartData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="text-center p-4">Loading distribution chart...</div>;
  }

  if (error) {
    return <div className="text-center p-4 text-red-500">Error loading distribution chart: {error}</div>;
  }

  if (!chartData || chartData.datasets.length === 0 || chartData.datasets[0].data.length === 0) {
    return <div className="text-center p-4 text-gray-500">No assessment distribution data available.</div>;
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // Often not needed for a single dataset bar chart like this
      },
      title: {
        display: true,
        text: 'Assessment Distribution by Illness Type',
        font: {
            size: 16, // Slightly smaller than main trend titles
            weight: 'bold' as const
        },
        padding: {
            top: 10,
            bottom: 20
        }
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += context.parsed.y;
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Illness Type',
        },
      },
      y: {
        title: {
          display: true,
          text: 'Number of Assessments',
        },
        beginAtZero: true,
        ticks: {
            stepSize: 1, // Ensure integer ticks if counts are always whole numbers
            precision: 0 // No decimal places for counts
        }
      },
    },
  };

  return (
    <div className="bg-white shadow rounded-lg p-4 md:p-6 h-96">
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default IllnessDistributionChart; 