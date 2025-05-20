import { useState, useEffect, useCallback } from 'react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import HospitalCard from '@/components/HospitalCard';
import { IHospital } from '@/models/Hospital';

interface HospitalsPageProps {
  initialData: {
    hospitals: IHospital[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
    filters: {
      states: string[];
      types: string[];
    };
  };
}

const HospitalsPage = ({ initialData }: HospitalsPageProps) => {
  const router = useRouter();
  const [hospitals, setHospitals] = useState<IHospital[]>(initialData.hospitals);
  const [pagination, setPagination] = useState(initialData.pagination);
  const [availableFilters, setAvailableFilters] = useState(initialData.filters);
  const [loading, setLoading] = useState(false);

  // Local state for filter inputs - these will drive URL changes
  const [currentSearchTerm, setCurrentSearchTerm] = useState<string>('');
  const [currentStateFilter, setCurrentStateFilter] = useState<string>('');
  const [currentTypeFilter, setCurrentTypeFilter] = useState<string>('');

  // Effect to initialize filter inputs from URL on first load or when URL directly changes (e.g. back/forward)
  useEffect(() => {
    if (router.isReady) {
      setCurrentSearchTerm((router.query.search as string) || '');
      setCurrentStateFilter((router.query.state as string) || '');
      setCurrentTypeFilter((router.query.type as string) || '');
    }
  }, [router.isReady, router.query.search, router.query.state, router.query.type]);
  
  const fetchHospitals = useCallback(async () => {
    if (!router.isReady) return; // Don't fetch if router isn't ready

    setLoading(true);
    
    const pageToFetch = parseInt(router.query.page as string, 10) || 1;
    const stateFromQuery = (router.query.state as string) || '';
    const typeFromQuery = (router.query.type as string) || '';
    const searchFromQuery = (router.query.search as string) || '';

    const queryParams = new URLSearchParams();
    queryParams.append('page', pageToFetch.toString());

    if (stateFromQuery) queryParams.append('state', stateFromQuery);
    if (typeFromQuery) queryParams.append('type', typeFromQuery);
    if (searchFromQuery) queryParams.append('search', searchFromQuery);

    try {
      const response = await fetch(`/api/hospitals?${queryParams.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch hospitals');

      const data = await response.json();
      setHospitals(data.hospitals);
      setPagination(data.pagination);
      if (data.filters) setAvailableFilters(data.filters); // Update available filters if API provides them

    } catch (error) {
      console.error('Error fetching hospitals:', error);
      // Consider setting an error state here to display to the user
    } finally {
      setLoading(false);
    }
  }, [router.isReady, router.query]); // Depends only on router.isReady and router.query

  // Effect to fetch data when router.query changes (and router is ready)
  useEffect(() => {
    fetchHospitals();
  }, [fetchHospitals]); // fetchHospitals itself now depends on router.query

  // Handlers update URL, which then triggers the main useEffect via router.query change
  const handleFilterChange = (updates: Record<string, string | undefined>) => {
    const newQuery: Record<string, string> = { ...router.query as Record<string, string>, page: '1' }; // Reset to page 1

    for (const key in updates) {
      if (updates[key]) {
        newQuery[key] = updates[key] as string;
      } else {
        delete newQuery[key]; // Remove filter if value is empty/undefined
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

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentSearchTerm(e.target.value);
    // For live search, you might debounce handleFilterChange({ search: e.target.value })
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleFilterChange({ search: currentSearchTerm });
  };

  const handleReset = () => {
    setCurrentStateFilter('');
    setCurrentTypeFilter('');
    setCurrentSearchTerm('');
    router.push({ pathname: router.pathname, query: { page: '1'} }, undefined, { shallow: true });
  };

  const handlePageChange = (newPage: number) => {
    router.push({ pathname: router.pathname, query: { ...router.query, page: newPage.toString() } }, undefined, { shallow: true });
  };

  // View hospital details (example, if you have detail pages)
  const viewHospitalDetails = (hospitalId: string) => {
    router.push(`/hospitals/${hospitalId}`);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-center">Find Hospitals & Specialists</h1>
      
      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <form onSubmit={handleSearchSubmit} className="space-y-4 md:space-y-0 md:flex md:items-end md:gap-4">
          <div className="flex-1">
            <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">State</label>
            <select
              id="state"
              value={currentStateFilter} // Controlled by new local state
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
          
          <div className="flex-1">
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              id="type"
              value={currentTypeFilter} // Controlled by new local state
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
          
          <div className="flex-1">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              id="search"
              value={currentSearchTerm} // Controlled by new local state
              onChange={handleSearchChange}
              placeholder="Hospital name, specialist..."
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          
          <div className="flex space-x-2">
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
            >
              Search
            </button>
            
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-colors"
            >
              Reset
            </button>
          </div>
        </form>
      </div>
      
      {/* Results */}
      <div>
        {/* Results count */}
        <div className="flex justify-between items-center mb-4">
          <p className="text-gray-600">
            Found {pagination.total} hospital{pagination.total !== 1 ? 's' : ''}
          </p>
        </div>
        
        {/* Loading state */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : hospitals.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 text-gray-700 px-4 py-8 rounded-lg text-center">
            <p className="text-lg font-medium mb-2">No hospitals found</p>
            <p className="text-gray-500">Try adjusting your filters or search terms.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {hospitals.map((hospital) => (
              <HospitalCard
                key={hospital._id?.toString()}
                hospital={hospital}
                onClick={() => viewHospitalDetails(hospital._id?.toString() || '')}
              />
            ))}
          </div>
        )}
        
        {/* Pagination */}
        {pagination.totalPages > 1 && (
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
    search = '',
  } = query;

  const queryParams = new URLSearchParams();
  queryParams.append('page', page as string);
  if (state) queryParams.append('state', state as string);
  if (type) queryParams.append('type', type as string);
  if (search) queryParams.append('search', search as string);

  // Determine the base URL for API requests
  // In a server-side context (getServerSideProps), you need to use an absolute URL.
  // If running locally, this might be http://localhost:3000.
  // In production, this would be your production domain.
  // Using a relative URL like '/api/hospitals' won't work directly in fetch within getServerSideProps.
  // For simplicity, this example assumes the API is on the same origin,
  // but in a real app, you might need to construct this more robustly.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/api/hospitals?${queryParams.toString()}`);
  
  let initialData = {
    hospitals: [],
    pagination: { total: 0, page: parseInt(page as string, 10), limit: 10, totalPages: 0 },
    filters: { states: [], types: [] },
  };

  if (response.ok) {
    const data = await response.json();
    initialData = data; // Assuming API returns data in the expected structure
  } else {
    console.error("Failed to fetch initial hospitals in getServerSideProps:", response.status, await response.text());
    // You might want to return an error prop to the page or handle this differently
  }

  return {
    props: {
      initialData,
    },
  };
};

export default HospitalsPage; 