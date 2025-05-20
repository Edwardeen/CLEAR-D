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
  const [filters, setFilters] = useState(initialData.filters);
  const [loading, setLoading] = useState(false);

  // Local state for filters, driven by user input or URL sync
  const [selectedState, setSelectedState] = useState<string>(() => (router.query.state as string) || '');
  const [selectedType, setSelectedType] = useState<string>(() => (router.query.type as string) || '');
  const [selectedSpecialization, setSelectedSpecialization] = useState<string>(() => (router.query.specialization as string) || '');
  const [searchTerm, setSearchTerm] = useState<string>(() => (router.query.search as string) || '');
  const [urlDrivenPage, setUrlDrivenPage] = useState<number>(() => router.query.page ? parseInt(router.query.page as string, 10) : 1);

  // Effect 1: Sync state with URL query parameters
  useEffect(() => {
    if (router.isReady) {
      const newSelectedState = (router.query.state as string) || '';
      const newSelectedType = (router.query.type as string) || '';
      const newSelectedSpecialization = (router.query.specialization as string) || '';
      const newSearchTerm = (router.query.search as string) || '';
      const newPage = parseInt(router.query.page as string, 10) || 1;

      if (newSelectedState !== selectedState) setSelectedState(newSelectedState);
      if (newSelectedType !== selectedType) setSelectedType(newSelectedType);
      if (newSelectedSpecialization !== selectedSpecialization) setSelectedSpecialization(newSelectedSpecialization);
      if (newSearchTerm !== searchTerm) setSearchTerm(newSearchTerm);
      if (newPage !== urlDrivenPage) setUrlDrivenPage(newPage);
    }
  }, [router.isReady, router.query, selectedState, selectedType, selectedSpecialization, searchTerm, urlDrivenPage]);

  const fetchCounselors = useCallback(async (pageToFetch = 1) => {
    setLoading(true);

    const queryParams = new URLSearchParams();
    queryParams.append('page', pageToFetch.toString());

    if (selectedState) queryParams.append('state', selectedState);
    if (selectedType) queryParams.append('type', selectedType);
    if (selectedSpecialization) queryParams.append('specialization', selectedSpecialization);
    if (searchTerm) queryParams.append('search', searchTerm);

    try {
      const response = await fetch(`/api/counselors?${queryParams.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch counselors');

      const data = await response.json();
      setCounselors(data.counselors);
      setPagination(data.pagination);
      if (data.filters) setFilters(data.filters);

      const newRouterQuery: Record<string, string> = {};
      if (selectedState) newRouterQuery.state = selectedState;
      if (selectedType) newRouterQuery.type = selectedType;
      if (selectedSpecialization) newRouterQuery.specialization = selectedSpecialization;
      if (searchTerm) newRouterQuery.search = searchTerm;
      if (pageToFetch > 1) newRouterQuery.page = pageToFetch.toString();
      else if (router.query.page) delete newRouterQuery.page;

      const normalizedCurrentQuery: Record<string, string> = {};
      if (router.query.state) normalizedCurrentQuery.state = router.query.state as string;
      if (router.query.type) normalizedCurrentQuery.type = router.query.type as string;
      if (router.query.specialization) normalizedCurrentQuery.specialization = router.query.specialization as string;
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
      console.error('Error fetching counselors:', error);
    } finally {
      setLoading(false);
    }
  }, [router, selectedState, selectedType, selectedSpecialization, searchTerm]);

  // Effect 2: Fetch data when filters or urlDrivenPage change
  useEffect(() => {
    if (router.isReady) {
      fetchCounselors(urlDrivenPage);
    }
  }, [
    router.isReady, 
    urlDrivenPage,
    fetchCounselors
  ]);

  // Handle filter changes
  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedState(e.target.value);
    setUrlDrivenPage(1);
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedType(e.target.value);
    setUrlDrivenPage(1);
  };

  const handleSpecializationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSpecialization(e.target.value);
    setUrlDrivenPage(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUrlDrivenPage(1);
  };

  const handleReset = () => {
    setSelectedState('');
    setSelectedType('');
    setSelectedSpecialization('');
    setSearchTerm('');
    setUrlDrivenPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setUrlDrivenPage(newPage);
  };

  const viewCounselorDetails = (counselorId: string) => {
    router.push(`/counselors/${counselorId}`);
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
              value={selectedState}
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
          
          <div className="md:col-span-2">
            <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              id="type"
              value={selectedType}
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
          
          <div className="md:col-span-3">
            <label htmlFor="specialization" className="block text-sm font-medium text-gray-700 mb-1">Specialization</label>
            <select
              id="specialization"
              value={selectedSpecialization}
              onChange={handleSpecializationChange}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="">All Specializations</option>
              {filters.specializations.map((spec) => (
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
                value={searchTerm}
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
            Found {pagination.total} counselor{pagination.total !== 1 ? 's' : ''}
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
                onClick={() => viewCounselorDetails(counselor._id?.toString() || '')}
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
  const response = await fetch(`${baseUrl}/api/counselors?${queryParams.toString()}`);
  
  let initialData = {
    counselors: [],
    pagination: { total: 0, page: parseInt(page as string, 10), limit: 10, totalPages: 0 },
    filters: { states: [], types: [], specializations: [] },
  };

  if (response.ok) {
    const data = await response.json();
    initialData = data;
  } else {
    console.error("Failed to fetch initial counselors in getServerSideProps:", response.status, await response.text());
  }

  return {
    props: {
      initialData,
    },
  };
};

export default CounselorsPage; 