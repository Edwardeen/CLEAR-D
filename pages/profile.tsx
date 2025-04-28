import type { NextPage, GetServerSideProps } from 'next';
import { useSession } from 'next-auth/react';
import { getServerSession } from 'next-auth';
import { authOptions } from './api/auth/[...nextauth]';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { IAssessment } from '../models/Assessment';
import React from 'react';
import AssessmentLineChart from '../components/AssessmentLineChart';

// Define interface for global weekly average data
interface WeeklyAverage {
  week: string;
  avgGlaucomaScore: number;
  avgCancerScore: number;
  count: number;
}

interface ProfilePageProps {
  initialAssessments: IAssessment[];
  totalAssessments: number;
  totalPages: number;
  currentPage: number;
  error?: string;
}

const ProfilePage: NextPage<ProfilePageProps> = ({ 
    initialAssessments,
    totalAssessments: initialTotalAssessments,
    totalPages: initialTotalPages,
    currentPage: initialCurrentPage,
    error: initialError
}) => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [assessments, setAssessments] = useState<IAssessment[]>(initialAssessments);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(initialError || null);
  const [currentPage, setCurrentPage] = useState<number>(initialCurrentPage);
  const [totalPages, setTotalPages] = useState<number>(initialTotalPages);
  const [totalAssessments, setTotalAssessments] = useState<number>(initialTotalAssessments);
  const [chartAssessments, setChartAssessments] = useState<IAssessment[]>([]);
  const [loadingChart, setLoadingChart] = useState<boolean>(false);
  
  // Global statistics
  const [globalStats, setGlobalStats] = useState<WeeklyAverage[]>([]);
  const [loadingGlobalStats, setLoadingGlobalStats] = useState<boolean>(false);
  const [globalStatsError, setGlobalStatsError] = useState<string | null>(null);
  
  // Toggle for showing global comparison
  const [showGlobalComparison, setShowGlobalComparison] = useState<boolean>(true);

   // Authentication check client-side (fallback)
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/profile');
    }
  }, [status, router]);

  const fetchAssessments = async (page: number) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/assessments?page=${page}&limit=10`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch assessments');
            }
            const data = await response.json();
            setAssessments(data.assessments);
            setTotalAssessments(data.totalAssessments);
            setTotalPages(data.totalPages);
            setCurrentPage(data.currentPage);
            // Update URL query param without page reload for better UX
            router.push(`/profile?page=${page}`, undefined, { shallow: true });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

     const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) {
            fetchAssessments(newPage);
        }
    };

  // Fetch historical data for chart visualization
  useEffect(() => {
    const fetchChartData = async () => {
      setLoadingChart(true);
      try {
        const response = await fetch('/api/assessment-history?limit=30');
        if (!response.ok) {
          throw new Error('Failed to fetch assessment history for chart');
        }
        const data = await response.json();
        setChartAssessments(data.assessments);
      } catch (err) {
        console.error('Error fetching chart data:', err);
        // We don't need to show this error prominently
      } finally {
        setLoadingChart(false);
      }
    };

    fetchChartData();
  }, []);
  
  // Fetch global stats for comparison
  useEffect(() => {
    const fetchGlobalStats = async () => {
      setLoadingGlobalStats(true);
      setGlobalStatsError(null);
      try {
        const response = await fetch('/api/global-assessment-stats?weeks=12');
        if (!response.ok) {
          throw new Error('Failed to fetch global statistics');
        }
        const data = await response.json();
        setGlobalStats(data.weeklyAverages);
      } catch (err: any) {
        console.error('Error fetching global stats:', err);
        setGlobalStatsError(err.message);
      } finally {
        setLoadingGlobalStats(false);
      }
    };
    
    fetchGlobalStats();
  }, []);

  if (status === 'loading') {
    return <div className="text-center p-10">Loading profile...</div>;
  }

  if (!session) {
    // Should be redirected by getServerSideProps or client-side useEffect
    return <div className="text-center p-10">Redirecting to login...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto bg-white p-6 sm:p-8 rounded-lg shadow-lg mt-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">My Assessment History</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6" role="alert">
          Error: {error}
        </div>
      )}

      {loading && <div className="text-center py-4 text-gray-500">Loading assessments...</div>}

      {!loading && assessments.length === 0 && (
        <div className="text-center py-10 bg-gray-50 rounded-md">
          <p className="text-gray-600 mb-4">You haven&apos;t completed any assessments yet.</p>
          <Link href="/" className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition-colors">
              Take Assessment Now
          </Link>
        </div>
      )}

      {!loading && assessments.length > 0 && (
        <>
            {/* Risk Score Trend Chart - Using the optimized chart data */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Risk Score Trend</h2>
                <div className="flex items-center">
                  <label className="inline-flex items-center mr-4 cursor-pointer">
                    <span className="text-sm text-gray-700 mr-2">Show Global Comparison</span>
                    <input 
                      type="checkbox" 
                      checked={showGlobalComparison} 
                      onChange={() => setShowGlobalComparison(!showGlobalComparison)}
                      className="form-checkbox h-4 w-4 text-blue-600 transition duration-150 ease-in-out"
                    />
                  </label>
                </div>
              </div>
              
              {loadingChart || loadingGlobalStats ? (
                <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                  <p className="text-gray-500">Loading chart data...</p>
                </div>
              ) : chartAssessments.length > 0 ? (
                <AssessmentLineChart 
                  assessments={chartAssessments} 
                  globalData={globalStats}
                  showGlobal={showGlobalComparison}
                  title="Your Risk Scores vs. Global Weekly Averages"
                />
              ) : (
                <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                  <p className="text-gray-500">No historical data available for chart</p>
                </div>
              )}
              
              {globalStatsError && (
                <p className="text-red-500 text-xs mt-2">
                  Note: Global comparison data could not be loaded: {globalStatsError}
                </p>
              )}
              
              {showGlobalComparison && globalStats.length > 0 && (
                <div className="mt-2 text-xs text-gray-500 italic">
                  <p>
                    Global comparison shows weekly averages of all users&apos; assessment scores.
                    Dotted lines represent global averages.
                  </p>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-200 shadow-sm rounded-lg">
                    <thead className="bg-gray-50">
                    <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Glaucoma Score
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cancer Score
                        </th>
                         <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Highest Risk
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Summary
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        View Details
                        </th>
                    </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                    {assessments.map((assessment) => (
                        <tr key={String(assessment._id)} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            {new Date(assessment.timestamp).toLocaleDateString()} {new Date(assessment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-green-700 text-center">
                            {assessment.glaucomaScore}/10
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-purple-700 text-center">
                            {assessment.cancerScore}/10
                        </td>
                         <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 font-semibold">
                            {assessment.higherRiskDisease === 'both' ? 'Equal Risk' 
                                : assessment.higherRiskDisease === 'none' ? 'Low' 
                                : assessment.higherRiskDisease.charAt(0).toUpperCase() + assessment.higherRiskDisease.slice(1)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={assessment.recommendations.split('\n')[0]}> 
                         {/* Show first line of recommendations as summary */}
                           {assessment.recommendations.split('\n')[0] || 'N/A'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                            <Link href={`/results?assessmentId=${assessment._id}`} className="text-blue-600 hover:text-blue-800 hover:underline">
                                View
                            </Link>
                        </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="mt-6 flex justify-between items-center px-2">
                    <span className="text-sm text-gray-700">
                        Page {currentPage} of {totalPages} (Total: {totalAssessments} assessments)
                    </span>
                    <div className="space-x-2">
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage <= 1 || loading}
                            className="px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage >= totalPages || loading}
                            className="px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}
        </>
      )}
    </div>
  );
};

// Fetch initial assessments server-side
export const getServerSideProps: GetServerSideProps<ProfilePageProps> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session?.user?.id) {
    return {
      redirect: {
        destination: '/login?callbackUrl=/profile', // Redirect to login
        permanent: false,
      },
    };
  }

  // Make session serializable by converting undefined values to null
  const serializableSession = JSON.parse(JSON.stringify(session));

  const page = parseInt(context.query.page as string) || 1;
  const limit = 10; // Keep consistent with client-side fetch

  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/assessments?page=${page}&limit=${limit}`, {
      headers: {
        // Pass the session cookie to the API route for authentication
        'Cookie': context.req.headers.cookie || '',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("SSR fetch error:", errorData);
      // Return error state to the page component
      return { props: { initialAssessments: [], totalAssessments: 0, totalPages: 0, currentPage: 1, error: errorData.message || 'Failed to load assessments.' } };
    }

    const data = await response.json();

    // Basic type check
    if (!data || !Array.isArray(data.assessments)) {
      throw new Error('Invalid data format received from API');
    }

    // Data fetched successfully
    return {
      props: {
        initialAssessments: JSON.parse(JSON.stringify(data.assessments)), // Ensure data is serializable
        totalAssessments: data.totalAssessments,
        totalPages: data.totalPages,
        currentPage: data.currentPage,
      },
    };
  } catch (error: any) {
    console.error('Error fetching assessments server-side:', error);
    return { props: { initialAssessments: [], totalAssessments: 0, totalPages: 0, currentPage: 1, error: error.message || 'Server error fetching assessments.' } };
  }
};

export default ProfilePage; 