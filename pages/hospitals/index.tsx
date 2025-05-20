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
  const [filters, setFilters] = useState(initialData.filters);
  const [loading, setLoading] = useState(false);

  // Local state for filters, driven by user input or URL sync
  const [selectedState, setSelectedState] = useState<string>(() => (router.query.state as string) || '');
  const [selectedType, setSelectedType] = useState<string>(() => (router.query.type as string) || '');
  const [searchTerm, setSearchTerm] = useState<string>(() => (router.query.search as string) || '');
  const [urlDrivenPage, setUrlDrivenPage] = useState<number>(() => router.query.page ? parseInt(router.query.page as string, 10) : 1);

  // Effect 1: Sync router.query to local state (selectedState, selectedType, searchTerm, urlDrivenPage)
  // This effect runs when the URL changes (e.g., browser back/forward, or after router.push in fetchHospitals)
  // It ensures local state reflects the URL.
  useEffect(() => {
    if (router.isReady) {
      const {
        state: queryState,
        type: queryType,
        search: querySearch,
        page: queryPage
      } = router.query;

      const newPage = queryPage ? parseInt(queryPage as string, 10) : 1;
      const newSelectedState = (queryState as string) || '';
      const newSelectedType = (queryType as string) || '';
      const newSearchTerm = (querySearch as string) || '';

      // Only update local state if it's different from the URL's query parameters
      // This prevents re-triggering Effect 2 unnecessarily if router.push in fetchHospitals
      // sets the URL to what it effectively already is based on current local state.
      if (newSelectedState !== selectedState) {
        setSelectedState(newSelectedState);
      }
      if (newSelectedType !== selectedType) {
        setSelectedType(newSelectedType);
      }
      if (newSearchTerm !== searchTerm) {
        setSearchTerm(newSearchTerm);
      }
      if (newPage !== urlDrivenPage) {
        setUrlDrivenPage(newPage);
      }
    }
  }, [router.isReady, router.query, selectedState, selectedType, searchTerm, urlDrivenPage]); // Added local states to dependencies to ensure accurate comparison

  const fetchHospitals = useCallback(async (pageToFetch = 1) => {
    setLoading(true);

    const queryParams = new URLSearchParams();
    queryParams.append('page', pageToFetch.toString());

    // Use local state for query params
    if (selectedState) queryParams.append('state', selectedState);
    if (selectedType) queryParams.append('type', selectedType);
    if (searchTerm) queryParams.append('search', searchTerm);

    try {
      const response = await fetch(`/api/hospitals?${queryParams.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch hospitals');

      const data = await response.json();
      setHospitals(data.hospitals);
      setPagination(data.pagination);
      if (data.filters) setFilters(data.filters);

      // Construct the query for router.push based on current filter states and pageToFetch
      const newRouterQuery: Record<string, string> = {};
      if (selectedState) newRouterQuery.state = selectedState;
      if (selectedType) newRouterQuery.type = selectedType;
      if (searchTerm) newRouterQuery.search = searchTerm;
      if (pageToFetch > 1) newRouterQuery.page = pageToFetch.toString();
      else if (router.query.page) delete newRouterQuery.page; // Remove page if it's 1 to keep URL clean

      // Only push if the new query is different from the current router.query
      const currentQueryObject = { ...router.query };
      delete currentQueryObject.page; // Normalize by removing page if it would be 1
      if (pageToFetch > 1) currentQueryObject.page = pageToFetch.toString();


      // Normalize router.query before comparison (remove undefined/empty string keys that might not be in newRouterQuery)
      const normalizedCurrentQuery: Record<string, string> = {};
      if (router.query.state) normalizedCurrentQuery.state = router.query.state as string;
      if (router.query.type) normalizedCurrentQuery.type = router.query.type as string;
      if (router.query.search) normalizedCurrentQuery.search = router.query.search as string;
      if (router.query.page && parseInt(router.query.page as string, 10) > 1) {
        normalizedCurrentQuery.page = router.query.page as string;
      }


      const currentQueryString = new URLSearchParams(normalizedCurrentQuery).toString();
      const newQueryString = new URLSearchParams(newRouterQuery).toString();


      if (currentQueryString !== newQueryString) {
        router.push({
          pathname: router.pathname,
          query: newRouterQuery,
        }, undefined, { shallow: true });
      }

    } catch (error) {
      console.error('Error fetching hospitals:', error);
    } finally {
      setLoading(false);
    }
  }, [router, selectedState, selectedType, searchTerm]); // Added dependencies to useCallback

  // Effect 2: Fetch data when local filters or urlDrivenPage change
  // This effect is triggered by user actions (changing filters, pagination) or by Effect 1 if URL changes cause local state to update.
  useEffect(() => {
    // Fetch data only if router is ready and one of the dependencies has meaningfully changed.
    // The initial state of local filters is set from router.query, so this effect will run on initial load.
    if (router.isReady) {
      fetchHospitals(urlDrivenPage);
    }
  }, [
    router.isReady, // Ensures router is ready before fetching
    urlDrivenPage,
    fetchHospitals // Added fetchHospitals as a dependency
  ]);

  // Handle filter changes - these update local state, triggering Effect 2
  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedState(e.target.value);
    setUrlDrivenPage(1); // Reset to page 1 when a filter changes
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedType(e.target.value);
    setUrlDrivenPage(1); // Reset to page 1
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    // Debounce or wait for submit for search to avoid too many API calls
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUrlDrivenPage(1); // Triggers fetch via Effect 2
  };

  const handleReset = () => {
    setSelectedState('');
    setSelectedType('');
    setSearchTerm('');
    setUrlDrivenPage(1);
    // Effect 2 will pick this up and call fetchHospitals, which will update the URL.
  };

  const handlePageChange = (newPage: number) => {
    setUrlDrivenPage(newPage);
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
              value={selectedState} // Controlled by local state
              onChange={handleStateChange}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="">All States</option>
              {filters.states.map((stateItem) => (
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
              value={selectedType} // Controlled by local state
              onChange={handleTypeChange}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="">All Types</option>
              {filters.types.map((typeItem) => (
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
              value={searchTerm} // Controlled by local state
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