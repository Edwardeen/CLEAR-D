import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ScoreDataset {
  label: string;
  data: (number | null)[];
  typeName: string;
  borderColor?: string;
  backgroundColor?: string;
  fill?: boolean;
  tension?: number;
  spanGaps?: boolean;
  yAxisID?: string; // For multiple axes
}

interface CountDataset {
  label: string;
  data: (number | null)[];
  typeName: string;
  borderColor?: string;
  backgroundColor?: string;
  yAxisID?: string; // For multiple axes
  type?: 'line' | 'bar'; // Explicitly limit the type to 'line' or 'bar'
}

interface ChartData {
  labels: string[];
  datasets: (ScoreDataset | CountDataset)[];
}

const getRandomColor = (typeName: string, forCounts: boolean = false) => {
  let hash = 0;
  for (let i = 0; i < typeName.length; i++) {
    hash = typeName.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Add a modifier for count datasets to get a different shade or color
  if (forCounts) {
    hash = (hash * 397) ^ 0x555555; // Arbitrary modification for different color scheme
  }
  const color = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  const hexColor = "#" + "00000".substring(0, 6 - color.length) + color;
  
  if (typeName === 'glaucoma') return forCounts ? 'rgba(34, 139, 34, <alpha>)' : 'rgba(75, 192, 192, <alpha>)'; // Darker Green for counts, Teal for scores
  if (typeName === 'cancer') return forCounts ? 'rgba(204, 51, 102, <alpha>)' : 'rgba(255, 99, 132, <alpha>)'; // Darker Pink for counts, Red/Pink for scores
  return hexColor; // Fallback remains the same for other types
};

const AssessmentTrendsChart: React.FC = () => {
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
          const errorData = await response.json().catch(() => ({ message: 'Failed to fetch chart data' }));
          throw new Error(errorData.message || `Error: ${response.status}`);
        }
        const apiResponse = await response.json();
        
        // Updated to use weeklyTrends from the API response
        const weeklyData = apiResponse.weeklyTrends;

        if (weeklyData && weeklyData.labels && weeklyData.scoreDatasets) {
            const processedScoreDatasets = weeklyData.scoreDatasets.map((ds: any) => {
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

            const processedCountDatasets = (weeklyData.countDatasets || []).map((ds: any) => {
                const baseColor = getRandomColor(ds.typeName || 'default', true);
                return {
                    ...ds,
                    label: `${ds.label || ds.typeName} Count`,
                    type: 'bar', // Specify type for chart.js
                    backgroundColor: baseColor.replace('<alpha>', '0.7'),
                    borderColor: baseColor.replace('<alpha>', '1'),
                    yAxisID: 'yCounts',
                };
            });

            setChartData({
                labels: weeklyData.labels,
                datasets: [...processedScoreDatasets, ...processedCountDatasets]
            });
        } else {
            setChartData(null); // Or set to a default empty state
        }

      } catch (err: any) {
        setError(err.message || 'An unknown error occurred');
        setChartData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="text-center p-4">Loading chart data...</div>;
  }

  if (error) {
    return <div className="text-center p-4 text-red-500">Error loading chart: {error}</div>;
  }

  if (!chartData || chartData.datasets.length === 0) {
    return <div className="text-center p-4 text-gray-500">No weekly assessment data available to display trends.</div>;
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
        text: 'Weekly Assessment Score and Volume Trends',
        font: {
            size: 18,
            weight: 'bold' as const
        },
        padding: {
            top: 10,
            bottom: 20
        }
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
            label: function(context: any) {
                let label = context.dataset.label || '';
                if (label) {
                    label += ': ';
                }
                if (context.parsed.y !== null) {
                    label += context.parsed.y.toFixed(2);
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
          text: 'Year-Week',
        },
      },
      y: { // This will be for scores by default, let's rename to yScores
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: {
          display: true,
          text: 'Average Score',
        },
        beginAtZero: true,
        suggestedMax: 10, // Assuming scores are generally up to 10
        id: 'yScores',
      },
      yCounts: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: {
          display: true,
          text: 'Assessment Count',
        },
        beginAtZero: true,
        grid: {
          drawOnChartArea: false, // Only draw grid for yScores axis
        },
        id: 'yCounts',
      },
    },
    interaction: {
        mode: 'nearest' as const,
        axis: 'x' as const,
        intersect: false
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-4 md:p-6 h-96">
      <Line 
        data={chartData as any} 
        options={options} 
      />
    </div>
  );
};

export default AssessmentTrendsChart; 