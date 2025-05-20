import { useState, useEffect, useCallback } from 'react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import CounselorCard from '@/components/CounselorCard';
import { ICounselor } from '@/models/Counselor';

interface CounselorsPageProps {
  initialData: {
    counselors: ICounselor[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
    filters: {
      states: string[];
      types: string[];
      specializations: string[];
    };
  };
}

const CounselorsPage = ({ initialData }: CounselorsPageProps) => {
  const router = useRouter();
  const [counselors, setCounselors] = useState<ICounselor[]>(initialData.counselors);
  const [pagination, setPagination] = useState(initialData.pagination);
  const [availableFilters, setAvailableFilters] = useState(initialData.filters);
  const [loading, setLoading] = useState(false);

  // Local state for filter inputs - these will drive URL changes
  const [currentSearchTerm, setCurrentSearchTerm] = useState<string>('');
  const [currentStateFilter, setCurrentStateFilter] = useState<string>('');
  const [currentTypeFilter, setCurrentTypeFilter] = useState<string>('');
  const [currentSpecializationFilter, setCurrentSpecializationFilter] = useState<string>('');

  // Effect to initialize filter inputs from URL on first load or when URL directly changes
  useEffect(() => {
    if (router.isReady) {
      setCurrentSearchTerm((router.query.search as string) || '');
      setCurrentStateFilter((router.query.state as string) || '');
      setCurrentTypeFilter((router.query.type as string) || '');
      setCurrentSpecializationFilter((router.query.specialization as string) || '');
    }
  }, [
    router.isReady, 
    router.query.search, 
    router.query.state, 
    router.query.type, 
    router.query.specialization
  ]);
  
  const fetchCounselors = useCallback(async () => {
    if (!router.isReady) return;

    setLoading(true);
    
    const pageToFetch = parseInt(router.query.page as string, 10) || 1;
    const stateFromQuery = (router.query.state as string) || '';
    const typeFromQuery = (router.query.type as string) || '';
    const specializationFromQuery = (router.query.specialization as string) || '';
    const searchFromQuery = (router.query.search as string) || '';

    const queryParams = new URLSearchParams();
    queryParams.append('page', pageToFetch.toString());

    if (stateFromQuery) queryParams.append('state', stateFromQuery);
    if (typeFromQuery) queryParams.append('type', typeFromQuery);
    if (specializationFromQuery) queryParams.append('specialization', specializationFromQuery);
    if (searchFromQuery) queryParams.append('search', searchFromQuery);

    try {
      const response = await fetch(`/api/counselors?${queryParams.toString()}`);
      if (!response.ok) {
        // Try to get error message from response if possible
        let errorMsg = 'Failed to fetch counselors';
        try {
            const errorData = await response.json();
            if (errorData && errorData.message) errorMsg = errorData.message;
        } catch (e) { /* ignore parsing error */ }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      setCounselors(data.counselors || []);
      setPagination(data.pagination || { total: 0, page: 1, limit: 10, totalPages: 0});
      if (data.filters) setAvailableFilters(data.filters);

    } catch (error: any) {
      console.error('Error fetching counselors:', error);
      // Optionally set an error state to show in UI
      // setError(error.message || 'Could not fetch counselors.'); 
    } finally {
      setLoading(false);
    }
  }, [router.isReady, router.query]);

  // Effect to fetch data when router.query changes
  useEffect(() => {
    fetchCounselors();
  }, [fetchCounselors]);

  const handleFilterChange = (updates: Record<string, string | undefined>) => {
    const newQuery: Record<string, string> = { ...router.query as Record<string, string>, page: '1' };

    for (const key in updates) {
      if (updates[key]) {
        newQuery[key] = updates[key] as string;
      } else {
        delete newQuery[key];
      }
    }
    
    router.push({ pathname: router.pathname, query: newQuery }, undefined, { shallow: true });
  };
  
  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newState = e.target.value;
    setCurrentStateFilter(newState);
    handleFilterChange({ state: newState });
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value;
    setCurrentTypeFilter(newType);
    handleFilterChange({ type: newType });
  };

  const handleSpecializationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSpecialization = e.target.value;
    setCurrentSpecializationFilter(newSpecialization);
    handleFilterChange({ specialization: newSpecialization });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentSearchTerm(e.target.value);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleFilterChange({ search: currentSearchTerm });
  };

  const handleReset = () => {
    setCurrentStateFilter('');
    setCurrentTypeFilter('');
    setCurrentSpecializationFilter('');
    setCurrentSearchTerm('');
    router.push({ pathname: router.pathname, query: { page: '1'} }, undefined, { shallow: true });
  };

  const handlePageChange = (newPage: number) => {
    router.push({ pathname: router.pathname, query: { ...router.query, page: newPage.toString() } }, undefined, { shallow: true });
  };

  // View counselor details - made unclickable by removing router.push
  const viewCounselorDetails = (counselorId: string) => {
    // router.push(`/counselors/${counselorId}`); // Commented out to make cards unclickable
    console.log('Card click disabled for counselor ID:', counselorId);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-center">Find Mental Health Counselors</h1>
      
      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <form onSubmit={handleSearchSubmit} className="space-y-4 md:space-y-0 md:grid md:grid-cols-12 md:gap-4">
          <div className="md:col-span-3">
            <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">State</label>
            <select
              id="state"
              value={currentStateFilter}
              onChange={handleStateChange}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="">All States</option>
              {availableFilters.states.map((stateItem) => (
                <option key={stateItem} value={stateItem}>
                  {stateItem}
                </option>
              ))}
            </select>
          </div>
          
          <div className="md:col-span-2">
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              id="type"
              value={currentTypeFilter}
              onChange={handleTypeChange}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="">All Types</option>
              {availableFilters.types.map((typeItem) => (
                <option key={typeItem} value={typeItem}>
                  {typeItem}
                </option>
              ))}
            </select>
          </div>
          
          <div className="md:col-span-3">
            <label htmlFor="specialization" className="block text-sm font-medium text-gray-700 mb-1">Specialization</label>
            <select
              id="specialization"
              value={currentSpecializationFilter}
              onChange={handleSpecializationChange}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="">All Specializations</option>
              {(availableFilters.specializations || []).map((spec) => (
                <option key={spec} value={spec}>
                  {spec}
                </option>
              ))}
            </select>
          </div>
          
          <div className="md:col-span-4">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="flex space-x-2">
              <input
                type="text"
                id="search"
                value={currentSearchTerm}
                onChange={handleSearchChange}
                placeholder="Counselor name, language..."
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
              
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors whitespace-nowrap"
              >
                Search
              </button>
              
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-colors whitespace-nowrap"
              >
                Reset
              </button>
            </div>
          </div>
        </form>
      </div>
      
      {/* Results */}
      <div>
        {/* Results count */}
        <div className="flex justify-between items-center mb-4">
          <p className="text-gray-600">
            Found {pagination.total || 0} counselor{pagination.total !== 1 ? 's' : ''}
          </p>
        </div>
        
        {/* Loading state */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : counselors.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 text-gray-700 px-4 py-8 rounded-lg text-center">
            <p className="text-lg font-medium mb-2">No counselors found</p>
            <p className="text-gray-500">Try adjusting your filters or search terms.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {counselors.map((counselor) => (
              <CounselorCard
                key={counselor._id?.toString()}
                counselor={counselor}
                // onClick={() => viewCounselorDetails(counselor._id?.toString() || '')} // Card is now unclickable as per request
                // To make it explicitly unclickable or appear different, you might add CSS or remove hover effects in CounselorCard component
              />
            ))}
          </div>
        )}
        
        {/* Pagination (ensure pagination object is safely accessed) */}
        {(pagination?.totalPages || 0) > 1 && (
          <div className="flex justify-center mt-8">
            <nav className="flex items-center space-x-1">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1 || loading}
                className={`px-3 py-1 rounded-md ${
                  pagination.page === 1 || loading
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Previous
              </button>
              
              {[...Array(pagination.totalPages)].map((_, index) => {
                const pageNumber = index + 1;
                if (
                  pageNumber === 1 ||
                  pageNumber === pagination.totalPages ||
                  (pageNumber >= pagination.page - 1 && pageNumber <= pagination.page + 1)
                ) {
                  return (
                    <button
                      key={pageNumber}
                      onClick={() => handlePageChange(pageNumber)}
                      disabled={loading}
                      className={`px-3 py-1 rounded-md ${
                        pagination.page === pageNumber
                          ? 'bg-indigo-600 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      } ${
                        loading ? 'cursor-not-allowed text-gray-400' : ''
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                } else if (
                  pageNumber === pagination.page - 2 ||
                  pageNumber === pagination.page + 2
                ) {
                  return <span key={pageNumber}>...</span>;
                }
                return null;
              })}
              
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages || loading}
                className={`px-3 py-1 rounded-md ${
                  pagination.page === pagination.totalPages || loading
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Next
              </button>
            </nav>
          </div>
        )}
      </div>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  const {
    page = '1',
    state = '',
    type = '',
    specialization = '',
    search = '',
  } = query;

  const queryParams = new URLSearchParams();
  queryParams.append('page', page as string);
  if (state) queryParams.append('state', state as string);
  if (type) queryParams.append('type', type as string);
  if (specialization) queryParams.append('specialization', specialization as string);
  if (search) queryParams.append('search', search as string);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  let apiResponse;
  try {
    apiResponse = await fetch(`${baseUrl}/api/counselors?${queryParams.toString()}`);
  } catch (error: any) {
    console.error("Fetch error in getServerSideProps for counselors:", error.message);
    // Return initial data structure on fetch failure to prevent 500 error on page
    return {
        props: {
            initialData: {
                counselors: [],
                pagination: { total: 0, page: parseInt(page as string, 10), limit: 10, totalPages: 0 },
                filters: { states: [], types: [], specializations: [] },
            },
        },
    };
  }
  
  let initialData = {
    counselors: [],
    pagination: { total: 0, page: parseInt(page as string, 10), limit: 10, totalPages: 0 },
    filters: { states: [], types: [], specializations: [] },
  };

  if (apiResponse.ok) {
    try {
      const data = await apiResponse.json();
      initialData = data; 
    } catch (error: any) {
        console.error("JSON parsing error in getServerSideProps for counselors:", error.message);
        // initialData remains as default, preventing 500 error on page
    }
  } else {
    console.error("Failed to fetch initial counselors in getServerSideProps:", apiResponse.status, await apiResponse.text());
    // initialData remains as default
  }

  return {
    props: {
      initialData,
    },
  };
};

export default CounselorsPage; 