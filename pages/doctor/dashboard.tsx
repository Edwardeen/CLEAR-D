import type { NextPage, GetServerSideProps } from 'next';
import { useSession, getSession } from 'next-auth/react';
import { useState, useEffect, ChangeEvent, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { IAssessment } from '../../models/Assessment';
import React from 'react';
import AssessmentLineChart from '../../components/AssessmentLineChart';

// Define the structure for populated user data in assessments
interface PopulatedAssessment extends Omit<IAssessment, 'userId' | 'timestamp'> {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
  } | null;
  timestamp: string; // Already stringified by API/SSR
}

// Interface for global weekly average data
interface WeeklyAverage {
  week: string;
  avgGlaucomaScore: number;
  avgCancerScore: number;
  count: number;
}

// Define sortable fields
type SortField = 'userId.email' | 'userId.name' | 'timestamp' | 'glaucomaScore' | 'cancerScore';
type SortOrder = 'asc' | 'desc';

interface DoctorDashboardProps {
  initialAssessments: PopulatedAssessment[];
  totalAssessments: number;
  totalPages: number;
  currentPage: number;
  initialFilters: {
      userEmail: string;
      startDate: string;
      endDate: string;
  };
  initialRiskFilter: string | null;
  initialSortField: SortField | null;
  initialSortOrder: SortOrder | null;
  error?: string;
}

const DoctorDashboard: NextPage<DoctorDashboardProps> = ({ 
    initialAssessments,
    totalAssessments: initialTotalAssessments,
    totalPages: initialTotalPages,
    currentPage: initialCurrentPage,
    initialFilters,
    initialRiskFilter,
    initialSortField,
    initialSortOrder,
    error: initialError
}) => {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // State for assessments and pagination
  const [assessments, setAssessments] = useState<PopulatedAssessment[]>(initialAssessments);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(initialError || null);
  const [currentPage, setCurrentPage] = useState<number>(initialCurrentPage);
  const [totalPages, setTotalPages] = useState<number>(initialTotalPages);
  const [totalAssessments, setTotalAssessments] = useState<number>(initialTotalAssessments);

  // State for filters
  const [filters, setFilters] = useState(initialFilters);
  const [filterInput, setFilterInput] = useState(initialFilters); // Temporary input state
  const [glaucomaFilter, setGlaucomaFilter] = useState<string>('');
  const [cancerFilter, setCancerFilter] = useState<string>('');

  // State for sorting
  const [sortField, setSortField] = useState<SortField | null>(initialSortField);
  const [sortOrder, setSortOrder] = useState<SortOrder | null>(initialSortOrder);

  // State for chart data
  const [chartAssessments, setChartAssessments] = useState<any[]>([]);
  const [loadingChart, setLoadingChart] = useState<boolean>(false);
  const [chartError, setChartError] = useState<string | null>(null);
  
  // Global statistics
  const [globalStats, setGlobalStats] = useState<WeeklyAverage[]>([]);
  const [loadingGlobalStats, setLoadingGlobalStats] = useState<boolean>(false);
  const [globalStatsError, setGlobalStatsError] = useState<string | null>(null);
  
  // Toggle for different chart modes
  const [chartMode, setChartMode] = useState<'filtered' | 'global' | 'both'>('both');

   // Authentication and Role check client-side (fallback)
  useEffect(() => {
    if (status === 'loading') return; // Wait until session status is resolved
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/doctor/dashboard');
    } else if (session?.user?.role !== 'doctor') {
      // Redirect non-doctors to home page or an unauthorized page
       setError("Access Denied: You do not have permission to view this page.");
       // Optionally redirect after a delay
       setTimeout(() => router.push('/'), 3000);
    }
  }, [status, session, router]);

  // Fetch chart data with current filters
  useEffect(() => {
    const fetchChartData = async () => {
      setLoadingChart(true);
      setChartError(null);
      
      try {
        const params = new URLSearchParams();
        params.set('limit', '50'); // Get more data points for the chart
        
        // Apply any active filters to the chart data
        if (filters.userEmail) params.set('userEmail', filters.userEmail);
        if (filters.startDate) params.set('startDate', filters.startDate);
        if (filters.endDate) params.set('endDate', filters.endDate);
        
        const response = await fetch(`/api/assessment-history?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to fetch assessment history for chart');
        }
        
        const data = await response.json();
        setChartAssessments(data.assessments);
      } catch (err: any) {
        console.error('Error fetching chart data:', err);
        setChartError(err.message);
      } finally {
        setLoadingChart(false);
      }
    };
    
    fetchChartData();
  }, [filters]); // Refetch when filters change
  
  // Fetch global stats
  useEffect(() => {
    const fetchGlobalStats = async () => {
      setLoadingGlobalStats(true);
      setGlobalStatsError(null);
      try {
        const response = await fetch('/api/global-assessment-stats?weeks=16');
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

  // Updated function to fetch assessments based on current page, filters, AND SORTING
  const fetchAssessments = useCallback(async (
    page: number,
    currentFilters: typeof filters,
    currentGlaucomaFilter: string,
    currentCancerFilter: string,
    currentSortField: SortField | null,
    currentSortOrder: SortOrder | null
  ) => {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({
            page: page.toString(),
            limit: '15',
        });
        if (currentFilters.userEmail) params.set('userEmail', currentFilters.userEmail);
        if (currentFilters.startDate) params.set('startDate', currentFilters.startDate);
        if (currentFilters.endDate) params.set('endDate', currentFilters.endDate);
        if (currentGlaucomaFilter) params.set('glaucomaFilter', currentGlaucomaFilter);
        if (currentCancerFilter) params.set('cancerFilter', currentCancerFilter);

        // Add sort parameters
        if (currentSortField && currentSortOrder) {
            params.set('sortField', currentSortField);
            params.set('sortOrder', currentSortOrder);
        }

        try {
            const response = await fetch(`/api/assessments?${params.toString()}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch assessments');
            }
            const data = await response.json();
            setAssessments(data.assessments);
            setTotalAssessments(data.totalAssessments);
            setTotalPages(data.totalPages);
            setCurrentPage(data.currentPage);
             // Update URL query params without page reload
             router.push(`/doctor/dashboard?${params.toString()}`, undefined, { shallow: true });
        } catch (err: any) {
            setError(err.message);
             // Reset to empty if fetch fails
             setAssessments([]);
             setTotalAssessments(0);
             setTotalPages(0);
             setCurrentPage(1);
        } finally {
            setLoading(false);
        }
    }, [router]); // Add dependencies if needed, router used for push

    // Initial fetch on mount
    useEffect(() => {
        fetchAssessments(currentPage, filters, glaucomaFilter, cancerFilter, sortField, sortOrder);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run on mount

    // Handle filter input changes
    const handleFilterInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        setFilterInput(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    // Apply filters and fetch data for page 1 with current sort and risk filter
    const applyFilters = () => {
         setFilters(filterInput); // Update the active filters
         setCurrentPage(1); // Reset to page 1 when filters change
         fetchAssessments(1, filterInput, glaucomaFilter, cancerFilter, sortField, sortOrder); // Fetch based on new filters, current risk, and current sort
    };

     // Reset filters and fetch all data for page 1 with default sort (or current sort)
    const resetFilters = () => {
        const emptyFilters = { userEmail: '', startDate: '', endDate: '' };
        setFilterInput(emptyFilters);
        setFilters(emptyFilters);
        setGlaucomaFilter('');
        setCancerFilter('');
        setCurrentPage(1); // Reset to page 1
        fetchAssessments(1, emptyFilters, '', '', sortField, sortOrder); // Fetch with empty filters and null risk
    };

    // Handle Risk Filter Button Clicks
    const handleGlaucomaFilterChange = (e: ChangeEvent<HTMLSelectElement>) => {
      const newFilter = e.target.value;
      setGlaucomaFilter(newFilter);
      setCurrentPage(1);
      fetchAssessments(1, filters, newFilter, cancerFilter, sortField, sortOrder);
    };

    const handleCancerFilterChange = (e: ChangeEvent<HTMLSelectElement>) => {
      const newFilter = e.target.value;
      setCancerFilter(newFilter);
      setCurrentPage(1);
      fetchAssessments(1, filters, glaucomaFilter, newFilter, sortField, sortOrder);
    };

    // Handle pagination clicks
    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) {
            fetchAssessments(newPage, filters, glaucomaFilter, cancerFilter, sortField, sortOrder); // Include risk filter
        }
    };
    
    // Handle sort clicks
    const handleSort = (field: SortField) => {
        const newSortOrder = sortField === field && sortOrder === 'asc' ? 'desc' : 'asc';
        setSortField(field);
        setSortOrder(newSortOrder);
        setCurrentPage(1); // Reset to page 1 when sorting changes
        fetchAssessments(1, filters, glaucomaFilter, cancerFilter, field, newSortOrder); // Include risk filter
    };

  // Render loading state or access denied message early
  if (status === 'loading') {
    return <div className="text-center p-10">Loading dashboard...</div>;
  }
   if (status === 'authenticated' && session?.user?.role !== 'doctor') {
     return (
         <div className="max-w-2xl mx-auto mt-10 p-6 bg-red-100 border border-red-400 text-red-700 rounded-lg shadow">
            <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
            <p>You do not have permission to view this page.</p>
            <Link href="/" className="mt-4 inline-block bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition-colors">
            Go back to Home
            </Link>
        </div>
     );
   }
    if (status === 'unauthenticated') {
        // Should be redirecting
        return <div className="text-center p-10">Redirecting to login...</div>;
    }

  // Main dashboard content for doctors
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">Hospital Dashboard - All Assessments</h1>

        {/* Filter Section */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-sm space-y-4">
            {/* Row 1: Text/Date Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                 {/* User Email Filter */}
                <div>
                    <label htmlFor="userEmail" className="block text-sm font-medium text-gray-700 mb-1">Filter by User Email</label>
                    <input
                        type="email"
                        id="userEmail"
                        name="userEmail"
                        value={filterInput.userEmail}
                        onChange={handleFilterInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="user@example.com"
                    />
                </div>
                 {/* Start Date Filter */}
                <div>
                    <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                        type="date"
                        id="startDate"
                        name="startDate"
                        value={filterInput.startDate}
                        onChange={handleFilterInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                </div>
                {/* End Date Filter */}
                <div>
                    <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input
                        type="date"
                        id="endDate"
                        name="endDate"
                        value={filterInput.endDate}
                        onChange={handleFilterInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                </div>
            </div>

            {/* Row 2: NEW Select Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                {/* Glaucoma Filter */}
                 <div>
                    <label htmlFor="glaucomaFilter" className="block text-sm font-medium text-gray-700 mb-1">Filter by Glaucoma Risk</label>
                    <select
                        id="glaucomaFilter"
                        name="glaucomaFilter"
                        value={glaucomaFilter}
                        onChange={handleGlaucomaFilterChange}
                        disabled={loading}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white"
                    >
                        <option value="">All Glaucoma Risks</option>
                        <option value="low">Low (0-2)</option>
                        <option value="moderate">Moderate (2.1-4.9)</option>
                        <option value="high">High (5.0-7.9)</option>
                        <option value="severe">Severe (8-10)</option>
                    </select>
                </div>

                {/* Cancer Filter */}
                <div>
                    <label htmlFor="cancerFilter" className="block text-sm font-medium text-gray-700 mb-1">Filter by Cancer Treatment</label>
                    <select
                        id="cancerFilter"
                        name="cancerFilter"
                        value={cancerFilter}
                        onChange={handleCancerFilterChange}
                        disabled={loading}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white"
                    >
                        <option value="">All Cancer Treatments</option>
                        <option value="targeted">Targeted Therapy (0-2)</option>
                        <option value="immuno">Immunotherapy (3-4)</option>
                        <option value="radiation">Radiation Therapy (5-6)</option>
                        <option value="chemo">Chemotherapy (7-8)</option>
                        <option value="surgery_combo">Surgery + Chemo/Radiation (9-10)</option>
                    </select>
                </div>

                 {/* Filter/Reset Buttons */}
                 <div className="flex space-x-2">
                     <button
                        onClick={applyFilters}
                        disabled={loading}
                        className="w-full justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                        Apply Filters
                    </button>
                    <button
                        onClick={resetFilters}
                        disabled={loading}
                        className="w-full justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                        Reset Filters
                    </button>
                </div>
             </div>

        </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6" role="alert">
          Error: {error}
        </div>
      )}

      {/* Risk Score Trend Chart */}
      <div className="mb-8 p-5 bg-white border border-gray-200 rounded-lg shadow-md">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800 mb-2 md:mb-0">Patient Risk Score Trends</h2>
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => setChartMode('filtered')}
              className={`px-3 py-1 rounded text-sm font-medium ${chartMode === 'filtered' ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-gray-100 text-gray-700 border border-gray-200'}`}
            >
              Filtered Patients
            </button>
            <button 
              onClick={() => setChartMode('global')}
              className={`px-3 py-1 rounded text-sm font-medium ${chartMode === 'global' ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-gray-100 text-gray-700 border border-gray-200'}`}
            >
              Global Weekly Avg
            </button>
            <button 
              onClick={() => setChartMode('both')}
              className={`px-3 py-1 rounded text-sm font-medium ${chartMode === 'both' ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-gray-100 text-gray-700 border border-gray-200'}`}
            >
              Compare Both
            </button>
          </div>
        </div>
        
        <p className="text-sm text-gray-600 mb-4">
          {chartMode === 'filtered' ? 'Showing risk scores for patients matching your current filters' : 
           chartMode === 'global' ? 'Showing global weekly average risk scores across all patients' :
           'Comparing filtered patient data with global weekly averages'}
        </p>
        
        {loadingChart || loadingGlobalStats ? (
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
            <p className="text-gray-500">Loading chart data...</p>
          </div>
        ) : chartError || globalStatsError ? (
          <div className="h-64 flex items-center justify-center bg-red-50 rounded-lg">
            <p className="text-red-500">{chartError || globalStatsError}</p>
          </div>
        ) : (
          <>
            {chartMode === 'filtered' && chartAssessments.length > 0 && (
              <AssessmentLineChart 
                assessments={chartAssessments} 
                showGlobal={false}
                title="Filtered Patients Risk Scores"
              />
            )}
            
            {chartMode === 'global' && globalStats.length > 0 && (
              <AssessmentLineChart 
                assessments={[]} 
                globalData={globalStats}
                showGlobal={true}
                title="Global Weekly Average Risk Scores"
              />
            )}
            
            {chartMode === 'both' && (
              <>
                {chartAssessments.length > 0 || globalStats.length > 0 ? (
                  <AssessmentLineChart 
                    assessments={chartAssessments} 
                    globalData={globalStats}
                    showGlobal={true}
                    title="Filtered Patients vs. Global Weekly Averages"
                  />
                ) : (
                  <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
                    <p className="text-gray-500">No assessment data available for this filter selection</p>
                  </div>
                )}
              </>
            )}
          </>
        )}
        
        {(chartMode === 'global' || chartMode === 'both') && globalStats.length > 0 && (
          <div className="mt-2 text-xs text-gray-500 italic">
            <p>
              Global weekly average data reflects all assessments in the system, grouped by week.
              {chartMode === 'both' && " Dotted lines represent global averages."}
            </p>
          </div>
        )}
      </div>

      {loading && <div className="text-center py-4 text-gray-500">Loading assessments...</div>}

      {!loading && assessments.length === 0 && (
        <div className="text-center py-10 bg-gray-50 rounded-md">
          <p className="text-gray-600">No assessments found matching the current filters.</p>
        </div>
      )}

      {!loading && assessments.length > 0 && (
        <>
          <div className="overflow-x-auto shadow border-b border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                   <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                     <button onClick={() => handleSort('userId.email')} className="flex items-center space-x-1 hover:text-gray-900">
                       <span>User Email</span>
                       {sortField === 'userId.email' && (
                         <span className="text-xs">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                       )}
                     </button>
                   </th>
                   <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      <button onClick={() => handleSort('userId.name')} className="flex items-center space-x-1 hover:text-gray-900">
                       <span>User Name</span>
                       {sortField === 'userId.name' && (
                         <span className="text-xs">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                       )}
                     </button>
                   </th>
                   <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                     <button onClick={() => handleSort('timestamp')} className="flex items-center space-x-1 hover:text-gray-900">
                       <span>Date</span>
                       {sortField === 'timestamp' && (
                         <span className="text-xs">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                       )}
                       {!sortField && <span className="text-xs">▼</span>} {/* Default sort indicator */} 
                     </button>
                   </th>
                   <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                     <button onClick={() => handleSort('glaucomaScore')} className="inline-flex items-center space-x-1 hover:text-gray-900">
                       <span>Glaucoma Score</span>
                        {sortField === 'glaucomaScore' && (
                         <span className="text-xs">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                       )}
                     </button>
                   </th>
                   <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                     <button onClick={() => handleSort('cancerScore')} className="inline-flex items-center space-x-1 hover:text-gray-900">
                       <span>Cancer Score</span>
                       {sortField === 'cancerScore' && (
                         <span className="text-xs">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                       )}
                     </button>
                   </th>
                   {/* Non-sortable columns */}
                   <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                     Highest Risk
                   </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                     Recommendation Summary
                   </th>
                   <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-600 uppercase tracking-wider">
                     Actions
                   </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {assessments.map((assessment) => (
                  <tr key={assessment._id} className="hover:bg-gray-50 transition-colors">
                     <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800 font-medium">
                        {assessment.userId?.email || 'N/A'}
                     </td>
                     <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {assessment.userId?.name || 'N/A'}
                     </td>
                     <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                       {new Date(assessment.timestamp).toLocaleDateString()} {new Date(assessment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                     </td>
                     <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-green-700 text-center">
                       {assessment.glaucomaScore}/10
                     </td>
                     <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-purple-700 text-center">
                       {assessment.cancerScore}/10
                     </td>
                     <td className="px-4 py-3 whitespace-nowrap text-sm font-bold 
                        ${assessment.higherRiskDisease === 'glaucoma' ? 'text-green-700' : assessment.higherRiskDisease === 'cancer' ? 'text-purple-700' : assessment.higherRiskDisease === 'both' ? 'text-orange-600' : 'text-gray-600'}">
                         {assessment.higherRiskDisease === 'both' ? 'Equal Risk' 
                             : assessment.higherRiskDisease === 'none' ? 'Low' 
                             : assessment.higherRiskDisease.charAt(0).toUpperCase() + assessment.higherRiskDisease.slice(1)}
                     </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-sm truncate" title={assessment.recommendations.split('\n')[0]}>
                        {assessment.recommendations.split('\n')[0] || '-'} 
                    </td>
                     <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                        <Link href={`/results?assessmentId=${assessment._id}`} className="text-blue-600 hover:text-blue-800 hover:underline">
                            View Details
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

// Fetch initial assessments server-side, ensuring user is a doctor
export const getServerSideProps: GetServerSideProps<DoctorDashboardProps> = async (context) => {
  const session = await getSession(context);

  // 1. Check if user is logged in
  if (!session?.user?.id) {
    return {
      redirect: {
        destination: '/login?callbackUrl=/doctor/dashboard', // Redirect to login
        permanent: false,
      },
    };
  }

  // 2. Check if user has the 'doctor' role
   if (session.user.role !== 'doctor') {
       // You can redirect non-doctors or return an error prop
        return {
            // Redirect to home page
            redirect: { destination: '/', permanent: false },
             // Or return an error prop to be handled client-side
             // props: { initialAssessments: [], totalAssessments: 0, totalPages: 0, currentPage: 1, initialFilters: { userEmail: '', startDate: '', endDate: '' }, error: 'Access Denied' }
        };
   }

  // 3. Fetch data for the doctor
    const page = parseInt(context.query.page as string) || 1;
    const limit = 15; // Match client-side limit
    const userEmail = context.query.userEmail as string || '';
    const startDate = context.query.startDate as string || '';
    const endDate = context.query.endDate as string || '';
    const initialGlaucomaFilter = context.query.glaucomaFilter as string || '';
    const initialCancerFilter = context.query.cancerFilter as string || '';

     const initialFilters = { userEmail, startDate, endDate };

     const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
        });
        if (userEmail) params.set('userEmail', userEmail);
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        if (initialGlaucomaFilter) params.set('glaucomaFilter', initialGlaucomaFilter);
        if (initialCancerFilter) params.set('cancerFilter', initialCancerFilter);

    try {
         // Construct the full URL for the API endpoint
         const apiUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/assessments?${params.toString()}`;

         const response = await fetch(apiUrl, {
            headers: {
                // Pass the session cookie to the API route for authentication
                'Cookie': context.req.headers.cookie || '',
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
             console.error("SSR fetch error (Doctor Dashboard):", errorData);
            return { props: { initialAssessments: [], totalAssessments: 0, totalPages: 0, currentPage: 1, initialFilters, initialRiskFilter: null, initialSortField: null, initialSortOrder: null, error: errorData.message || 'Failed to load assessments.' } };
        }

        const data = await response.json();
         if (!data || !Array.isArray(data.assessments)) {
             throw new Error('Invalid data format received from API');
         }

        return {
            props: {
                initialAssessments: JSON.parse(JSON.stringify(data.assessments)), // Ensure serializable
                totalAssessments: data.totalAssessments,
                totalPages: data.totalPages,
                currentPage: data.currentPage,
                initialFilters,
                initialRiskFilter: null,
                initialSortField: null,
                initialSortOrder: null,
            },
        };
    } catch (error: any) {
         console.error('Error fetching assessments server-side (Doctor Dashboard):', error);
         return { props: { initialAssessments: [], totalAssessments: 0, totalPages: 0, currentPage: 1, initialFilters, initialRiskFilter: null, initialSortField: null, initialSortOrder: null, error: error.message || 'Server error fetching assessments.' } };
    }
};

export default DoctorDashboard; 