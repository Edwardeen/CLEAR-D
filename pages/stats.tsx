import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface WeeklyAverage {
  week: string;
  avgGlaucomaScore: number;
  avgCancerScore: number;
  count: number;
}

interface MonthlyData {
  month: string;
  avgGlaucomaScore: number;
  avgCancerScore: number;
  count: number;
}

interface GlobalAverageData {
  totalAssessments: number;
  averageGlaucomaScore: number;
  averageCancerScore: number;
  monthlyData: MonthlyData[];
}

// Interfaces for the data from /api/charts/assessment-trends
interface ApiDataset {
  label: string;
  data: (number | null)[];
  typeName: string;
}

interface TrendData {
  labels: string[];
  scoreDatasets: ApiDataset[];
  countDatasets: ApiDataset[];
}

// Interface for the global summary statistics
interface GlobalStatsSummary {
  totalAssessments: number;
  averageGlaucomaScore: number;
  averageCancerScore: number;
}

// Helper to generate colors (similar to doctor dashboard)
const getTrendColor = (typeName: string, datasetType: 'score' | 'count') => {
  // Simple consistent colors for Glaucoma and Cancer
  if (typeName === 'glaucoma') {
    return datasetType === 'score' ? 'rgba(75, 192, 192, <alpha>)' : 'rgba(34, 139, 34, <alpha>)'; // Teal/Green
  }
  if (typeName === 'cancer') {
    return datasetType === 'score' ? 'rgba(255, 99, 132, <alpha>)' : 'rgba(204, 51, 102, <alpha>)'; // Red/Pink
  }
  // Fallback for other types
  let hash = 0;
  for (let i = 0; i < typeName.length; i++) {
    hash = typeName.charCodeAt(i) + ((hash << 5) - hash);
  }
  if (datasetType === 'count') hash = (hash * 397) ^ 0x555555;
  const color = (hash & 0x00FFFFFF).toString(16).toUpperCase();
  return `#${"00000".substring(0, 6 - color.length)}${color}`; // Return as hex, alpha handled by chart options
};

const StatsPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [weeklyAverages, setWeeklyAverages] = useState<WeeklyAverage[]>([]);
  const [globalAverages, setGlobalAverages] = useState<GlobalAverageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New state structure
  const [weeklyTrends, setWeeklyTrends] = useState<TrendData | null>(null);
  const [monthlyTrends, setMonthlyTrends] = useState<TrendData | null>(null);
  const [globalStatsSummary, setGlobalStatsSummary] = useState<GlobalStatsSummary | null>(null);

  // Use refs to access current state values without adding them to dependencies
  const weeklyTrendsRef = useRef<TrendData | null>(null);
  const monthlyTrendsRef = useRef<TrendData | null>(null);
  const globalStatsSummaryRef = useRef<GlobalStatsSummary | null>(null);

  // Keep refs in sync with state
  useEffect(() => {
    weeklyTrendsRef.current = weeklyTrends;
    monthlyTrendsRef.current = monthlyTrends;
    globalStatsSummaryRef.current = globalStatsSummary;
  }, [weeklyTrends, monthlyTrends, globalStatsSummary]);

  const fetchAllStatsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching all stats data...');
      
      // Fetch trend data (weekly/monthly scores and counts)
      try {
        const trendsRes = await fetch('/api/charts/assessment-trends');
        if (trendsRes.ok) {
          const trendsData = await trendsRes.json();
          console.log('Received trend data:', trendsData);
          if (trendsData.weeklyTrends && trendsData.monthlyTrends) {
            setWeeklyTrends(trendsData.weeklyTrends);
            setMonthlyTrends(trendsData.monthlyTrends);
          }
        } else {
          console.warn('Unable to access trend statistics:', trendsRes.status);
        }
      } catch (trendErr: any) {
        console.warn('Error fetching trend data:', trendErr.message);
      }
      
      // Fetch global average stats for summary cards
      try {
        const averagesRes = await fetch('/api/global-average-stats');
        if (averagesRes.ok) {
          const averagesData = await averagesRes.json();
          console.log('Received global averages data:', averagesData);
          if (averagesData && typeof averagesData.totalAssessments === 'number') {
            setGlobalStatsSummary({
              totalAssessments: averagesData.totalAssessments,
              averageGlaucomaScore: averagesData.averageGlaucomaScore,
              averageCancerScore: averagesData.averageCancerScore,
            });
          }
        } else {
          console.warn('Unable to access global statistics:', averagesRes.status);
        }
      } catch (avgErr: any) {
        console.warn('Error fetching global averages:', avgErr.message);
      }

      // Only set error if we couldn't fetch any data
      if (!weeklyTrendsRef.current && !monthlyTrendsRef.current && !globalStatsSummaryRef.current) {
        setError('Unable to fetch statistics. You may not have sufficient permissions to view this data.');
      }

    } catch (err: any) {
      console.error('Error fetching stats page data:', err);
      setError(err.message || 'An unexpected error occurred while fetching statistics.');
    } finally {
      setLoading(false);
    }
  }, [setWeeklyTrends, setMonthlyTrends, setGlobalStatsSummary, setError, setLoading]);

  useEffect(() => {
    // Redirect if not authenticated
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/stats');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchAllStatsData();
    }
  }, [status, fetchAllStatsData]);

  // Updated chart options to support dual axes
  const dualAxisChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
        mode: 'index' as const,
        intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Time Period'
        }
      },
      yScores: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        beginAtZero: true,
        suggestedMax: 10,
        title: {
          display: true,
          text: 'Average Score (0-10)'
        },
      },
      yCounts: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        beginAtZero: true,
        title: {
          display: true,
          text: 'Number of Assessments'
        },
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
            precision: 0
        }
      }
    }
  };

  const processTrendDataForChart = (trendData: TrendData | null, periodType: 'Week' | 'Month') => {
    if (!trendData || !trendData.labels || trendData.labels.length === 0) {
      return {
        labels: ['No Data'],
        datasets: [{ label: 'No Data Available', data: [0], borderColor: '#cccccc', tension: 0 }]
      };
    }

    let processedLabels = [...trendData.labels];
    let processedScoreDatasets = JSON.parse(JSON.stringify(trendData.scoreDatasets || [])); // Deep copy
    let processedCountDatasets = JSON.parse(JSON.stringify(trendData.countDatasets || [])); // Deep copy

    const WEEKS_TO_SHOW = 5;
    const MONTHS_TO_SHOW = 6;

    if (periodType === 'Week' && processedLabels.length > WEEKS_TO_SHOW) {
      processedLabels = processedLabels.slice(-WEEKS_TO_SHOW);
      processedScoreDatasets.forEach((ds: ApiDataset) => {
        ds.data = ds.data.slice(-WEEKS_TO_SHOW);
      });
      processedCountDatasets.forEach((ds: ApiDataset) => {
        ds.data = ds.data.slice(-WEEKS_TO_SHOW);
      });
    } else if (periodType === 'Month' && processedLabels.length > MONTHS_TO_SHOW) {
      processedLabels = processedLabels.slice(-MONTHS_TO_SHOW);
      processedScoreDatasets.forEach((ds: ApiDataset) => {
        ds.data = ds.data.slice(-MONTHS_TO_SHOW);
      });
      processedCountDatasets.forEach((ds: ApiDataset) => {
        ds.data = ds.data.slice(-MONTHS_TO_SHOW);
      });
    }

    const scoreChartDatasets = processedScoreDatasets.map((ds: ApiDataset) => {
      const baseColor = getTrendColor(ds.typeName, 'score');
      return {
        type: 'line' as const,
        label: `${ds.label || ds.typeName + ' Score'}`,
        data: ds.data,
        borderColor: baseColor.replace('<alpha>', '1'),
        backgroundColor: baseColor.replace('<alpha>', '0.2'),
        fill: true,
        tension: 0.3,
        yAxisID: 'yScores',
        spanGaps: true,
      };
    });

    const countChartDatasets = processedCountDatasets.map((ds: ApiDataset) => {
      const baseColor = getTrendColor(ds.typeName, 'count');
      return {
        type: 'bar' as const,
        label: `${ds.label || ds.typeName + ' Count'}`,
        data: ds.data,
        backgroundColor: baseColor.replace('<alpha>', '0.7'),
        borderColor: baseColor.replace('<alpha>', '1'),
        yAxisID: 'yCounts',
      };
    });
    
    return {
      labels: processedLabels,
      datasets: [...scoreChartDatasets, ...countChartDatasets]
    };
  };
  
  const weeklyChartJsData = processTrendDataForChart(weeklyTrends, 'Week');
  const monthlyChartJsData = processTrendDataForChart(monthlyTrends, 'Month');

  // Specific options for weekly chart
  const weeklyChartOptions: ChartOptions<'line'> = {
    ...dualAxisChartOptions,
    plugins: {
        ...dualAxisChartOptions.plugins,
        title: {
            display: true,
            text: 'Weekly Score & Volume Trends'
        }
    },
    scales: {
        ...dualAxisChartOptions.scales,
        x: {
            ...dualAxisChartOptions.scales?.x,
            title: {
                display: true,
                text: 'Year-Week'
            }
        }
    }
  };

  // Specific options for monthly chart
  const monthlyChartOptions: ChartOptions<'line'> = {
    ...dualAxisChartOptions,
    plugins: {
        ...dualAxisChartOptions.plugins,
        title: {
            display: true,
            text: 'Monthly Score & Volume Trends'
        }
    },
    scales: {
        ...dualAxisChartOptions.scales,
        x: {
            ...dualAxisChartOptions.scales?.x,
            title: {
                display: true,
                text: 'Year-Month'
            }
        }
    }
  };

  if (status === 'loading' && loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-8">Global Health Statistics</h1>
      
      {loading && !error && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading global statistics...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 p-4 rounded-md text-red-600 mb-4 text-center">
          <p>{error}</p>
          <button 
            onClick={fetchAllStatsData}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Global Stats Summary */}
          {globalStatsSummary && (
            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
              <h2 className="text-2xl font-semibold mb-6 text-center">Global Assessment Overview</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <h3 className="text-lg font-medium mb-2 text-blue-800">Total Assessments</h3>
                  <p className="text-3xl font-bold text-blue-600">{globalStatsSummary.totalAssessments.toLocaleString()}</p>
                  <p className="mt-2 text-sm text-blue-700">
                    This represents the total number of health assessments completed by all users on the CLEAR-D platform.
                    A higher number indicates broader data collection and more reliable statistics.
                  </p>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                  <h3 className="text-lg font-medium mb-2 text-green-800">Average Glaucoma Risk</h3>
                  <p className="text-3xl font-bold text-green-600">{globalStatsSummary.averageGlaucomaScore.toFixed(2)}/10</p>
                  <p className="mt-2 text-sm text-green-700">
                    The average glaucoma risk score across all assessments. Scores range from 0-10, with higher scores indicating increased risk.
                    Factors like diabetes, age, and family history contribute to higher scores.
                  </p>
                </div>
                
                <div className="bg-pink-50 p-4 rounded-lg border border-pink-100">
                  <h3 className="text-lg font-medium mb-2 text-pink-800">Average Cancer Risk</h3>
                  <p className="text-3xl font-bold text-pink-600">{globalStatsSummary.averageCancerScore.toFixed(2)}/10</p>
                  <p className="mt-2 text-sm text-pink-700">
                    The average cancer risk score across all assessments. Scores range from 0-10, with higher scores indicating increased risk.
                    Risk factors include family history, lifestyle choices, and exposure to carcinogens.
                  </p>
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-4">What These Numbers Mean</h3>
                <p className="text-gray-700 mb-3">
                  These global averages provide context for your personal assessment results. Compare your scores against 
                  these averages to understand how your health risks compare to the broader population.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-700 font-medium mb-2">Glaucoma Risk Scale:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li><span className="text-green-600 font-medium">0-2:</span> Low risk - Routine monitoring, lifestyle advice</li>
                      <li><span className="text-yellow-600 font-medium">2.1-4.9:</span> Moderate risk - Eye drops, laser therapy</li>
                      <li><span className="text-orange-500 font-medium">5-7.9:</span> High risk - Surgery or combination treatments</li>
                      <li><span className="text-red-600 font-medium">8-10:</span> Critical/Acute risk - Immediate intervention</li>
                    </ul>
                  </div>
                  
                  <div>
                    <p className="text-gray-700 font-medium mb-2">Cancer Risk Scale:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li><span className="text-green-600 font-medium">0-2:</span> Low risk - Targeted Therapy</li>
                      <li><span className="text-yellow-600 font-medium">3-4:</span> Moderate risk - Immunotherapy</li>
                      <li><span className="text-orange-400 font-medium">5-6:</span> Localized disease likely - Radiation Therapy</li>
                      <li><span className="text-orange-600 font-medium">7-8:</span> High risk - Chemotherapy</li>
                      <li><span className="text-red-600 font-medium">9-10:</span> Very high risk - Surgery + Chemo/Radiation</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Weekly Trends Chart - Updated */}
          {weeklyTrends && weeklyTrends.labels && weeklyTrends.labels.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
              <h2 className="text-2xl font-semibold mb-4">Weekly Assessment Score & Volume Trends (Last {Math.min(weeklyTrends.labels.length, 5)} Weeks)</h2>
              <div className="h-80">
                <Line options={weeklyChartOptions} data={weeklyChartJsData} />
              </div>
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-medium mb-2">Understanding Weekly Trends</h3>
                <p className="text-gray-700 mb-3">
                  This chart shows the average risk scores (lines) and assessment volumes (bars) for primary illness types over recent weeks. 
                  Observing these trends helps identify patterns or emerging health concerns across the population.
                </p>
              </div>
            </div>
          )}
          
          {/* Monthly Trends Chart */}
          {monthlyTrends && monthlyTrends.labels && monthlyTrends.labels.length > 0 && (
            <div className="bg-white p-6 rounded-lg shadow-md mb-8">
              <h2 className="text-2xl font-semibold mb-4">Monthly Assessment Score & Volume Trends (Last {Math.min(monthlyTrends.labels.length, 6)} Months)</h2>
              <div className="h-80">
                <Line options={monthlyChartOptions} data={monthlyChartJsData} />
              </div>
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-lg font-medium mb-2">Understanding Monthly Trends</h3>
                <p className="text-gray-700 mb-3">
                  This chart displays the monthly average risk scores (lines) and assessment volumes (bars), providing a broader 
                  perspective on health trends. Monthly averages help smooth out short-term fluctuations.
                </p>
              </div>
            </div>
          )}
          
          {/* Data Interpretation Guide */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-4">Interpreting Your Results</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-blue-800">How to Use These Statistics</h3>
                <p className="text-gray-700 mt-1">
                  Compare your personal risk scores with these global averages to better understand your relative health position.
                  If your scores are significantly higher than average, consider consulting healthcare professionals for personalized advice.
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-blue-800">Risk Factors for Glaucoma</h3>
                <ul className="list-disc list-inside mt-1 text-gray-700">
                  <li>Elevated intraocular pressure</li>
                  <li>Family history of glaucoma</li>
                  <li>Age over 60</li>
                  <li>Diabetes</li>
                  <li>Previous eye injuries</li>
                  <li>Long-term corticosteroid use</li>
                </ul>
              </div>
              
                            <div>
                <h3 className="text-lg font-medium text-blue-800">Risk Factors for Cancer</h3>
                <ul className="list-disc list-inside mt-1 text-gray-700">
                  <li>Family history of cancer</li>
                  <li>Tobacco use</li>
                  <li>Excessive alcohol consumption</li>
                  <li>Excessive exposure to sunlight</li>
                  <li>Certain chronic viral infections</li>
                  <li>Exposure to radiation or chemicals</li>
                </ul>
              </div>
              
              {/* 
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                <h3 className="text-lg font-medium text-yellow-800">Important Disclaimer</h3>
                <p className="text-yellow-700 mt-1">
                  These statistics are meant for informational purposes only and do not constitute medical advice. 
                  Always consult healthcare professionals for personalized medical guidance based on your individual health situation.
                </p>
              </div>
              */}
              </div>
            </div>
        </>
      )}
    </div>
  );
};

export default StatsPage; 