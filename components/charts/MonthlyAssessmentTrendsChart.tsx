import React, { useState, useEffect } from 'react';
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
  Filler,
  BarElement, // Added for bar charts
} from 'chart.js';

// ChartJS registration is global, so if AssessmentTrendsChart is also used, it's already registered.
// If this component can be used standalone, keep the registration.
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  BarElement // Added for bar charts
);

// Define more specific interfaces for clarity
interface ScoreDatasetConfig {
  label: string;
  data: (number | null)[];
  typeName: string;
  borderColor?: string;
  backgroundColor?: string;
  fill?: boolean;
  tension?: number;
  spanGaps?: boolean;
  yAxisID?: string;
}

interface CountDatasetConfig {
  label: string;
  data: (number | null)[];
  typeName: string;
  borderColor?: string;
  backgroundColor?: string;
  type?: 'bar';
  yAxisID?: string;
}

interface ChartData {
  labels: string[];
  datasets: (ScoreDatasetConfig | CountDatasetConfig)[];
}

// Using a consistent color generation logic, similar to AssessmentTrendsChart
const getRandomColor = (typeName: string, forCounts: boolean = false) => {
  let hash = 0;
  for (let i = 0; i < typeName.length; i++) {
    hash = typeName.charCodeAt(i) + ((hash << 5) - hash);
  }
  if (forCounts) {
    hash = (hash * 397) ^ 0x555555; // Modifier for count datasets
  }
  const color = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  const hexColor = "#" + "00000".substring(0, 6 - color.length) + color;

  if (typeName === 'glaucoma') return forCounts ? 'rgba(34, 139, 34, <alpha>)' : 'rgba(75, 192, 192, <alpha>)'; // Darker Green for counts, Teal for scores
  if (typeName === 'cancer') return forCounts ? 'rgba(204, 51, 102, <alpha>)' : 'rgba(255, 99, 132, <alpha>)'; // Darker Pink for counts, Red/Pink for scores
  return hexColor; // Fallback
};


const MonthlyAssessmentTrendsChart: React.FC = () => {
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
          const errorData = await response.json().catch(() => ({ message: 'Failed to fetch monthly chart data' }));
          throw new Error(errorData.message || `Error fetching monthly data: ${response.status}`);
        }
        const apiResponse = await response.json();
        
        const monthlyData = apiResponse.monthlyTrends;

        if (monthlyData && monthlyData.labels && monthlyData.scoreDatasets) {
          const processedScoreDatasets = monthlyData.scoreDatasets.map((ds: any): ScoreDatasetConfig => {
            const baseColor = getRandomColor(ds.typeName || 'default', false);
            return {
              ...ds,
              label: `${ds.label || ds.typeName} Score`,
              borderColor: baseColor.replace('<alpha>', '1'),
              backgroundColor: baseColor.replace('<alpha>', '0.2'),
              fill: true,
              tension: 0.3,
              spanGaps: true,
              yAxisID: 'yScores',
            };
          });

          const processedCountDatasets = (monthlyData.countDatasets || []).map((ds: any): CountDatasetConfig => {
            const baseColor = getRandomColor(ds.typeName || 'default', true);
            return {
              ...ds,
              label: `${ds.label || ds.typeName} Count`,
              type: 'bar',
              backgroundColor: baseColor.replace('<alpha>', '0.7'),
              borderColor: baseColor.replace('<alpha>', '1'),
              yAxisID: 'yCounts',
            };
          });
          
          setChartData({
            labels: monthlyData.labels,
            datasets: [...processedScoreDatasets, ...processedCountDatasets]
          });
        } else {
          console.warn('Monthly trends data not found in API response or is malformed:', apiResponse);
          setChartData(null);
        }
      } catch (err: any) {
        console.error('Error fetching or processing monthly chart data:', err);
        setError(err.message || 'An unknown error occurred while loading monthly trends.');
        setChartData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="text-center p-4">Loading monthly chart data...</div>;
  }

  if (error) {
    return <div className="text-center p-4 text-red-500">Error loading monthly chart: {error}</div>;
  }

  if (!chartData || chartData.datasets.length === 0) {
    return <div className="text-center p-4 text-gray-500">No monthly assessment data available to display trends.</div>;
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Monthly Assessment Score and Volume Trends', // Updated title
        font: { size: 18, weight: 'bold' as const },
        padding: { top: 10, bottom: 20 }
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'Year-Month' },
      },
      y: { // Renamed to yScores for clarity
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: { display: true, text: 'Average Score' },
        beginAtZero: true,
        suggestedMax: 10,
        id: 'yScores',
      },
      yCounts: { // Added for assessment counts
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Assessment Count',
        },
        beginAtZero: true,
        grid: {
          drawOnChartArea: false, // Avoid cluttering with a second grid
        },
        id: 'yCounts',
      },
    },
    interaction: {
      mode: 'nearest' as const,
      axis: 'x' as const,
      intersect: false,
    },
  };

  // Make sure to use the correct chart type. Since we now mix line and bar,
  // the top-level 'type' in Chart.js data object should be 'bar' or 'line' and then override per dataset.
  // Or, as done here, specify type per dataset and Chart.js will handle mixed types.
  // The <Line /> component might need to be changed to <Chart /> if it doesn't support mixed types directly.
  // For react-chartjs-2, <Line /> should handle mixed types if `type` is specified in dataset options.

  return (
    <div className="bg-white shadow rounded-lg p-4 md:p-6 h-96">
      {/* The <Line> component from react-chartjs-2 can render mixed chart types 
          as long as the 'type' is specified in the dataset configuration. */}
      <Line data={chartData as any} options={options} />
    </div>
  );
};

export default MonthlyAssessmentTrendsChart;
