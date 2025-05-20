import type { NextPage, GetServerSideProps } from 'next';
import { useSession, getSession } from 'next-auth/react';
import { useState, useEffect, ChangeEvent, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { IAssessment } from '../../models/Assessment';
import React from 'react';
import { IQuestionBankItem } from '../../models/QuestionBank';
import { IIllness } from '../../models/Illness';
import AssessmentTrendsChart from '../../components/charts/AssessmentTrendsChart';
import MonthlyAssessmentTrendsChart from '../../components/charts/MonthlyAssessmentTrendsChart';
import IllnessDistributionChart from '../../components/charts/IllnessDistributionChart';

// Helper debounce function
const debounce = <F extends (...args: any[]) => void>(func: F, waitFor: number) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<F>): void => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), waitFor);
  };
};

// Define the structure for populated user data in assessments
interface PopulatedAssessment extends Omit<IAssessment, 'userId' | 'timestamp' | 'recommendations' | 'createdAt'> {
  _id: string;
  userId: {
    _id: string;
    name: string | { first?: string; last?: string };
    email: string;
  } | null;
  timestamp: string; 
  createdAt: string; // Explicitly string for client-side component compatibility after SSR JSON stringification
  // Fields for old assessment format compatibility
  glaucomaScore?: number;
  cancerScore?: number;
  higherRiskDisease?: string;
  recommendations: string | string[];
}

// Interface for global weekly average data
interface WeeklyAverage {
  week: string;
  avgScore: number; // Generic score, could be filtered by type if source provides it
  type: 'glaucoma' | 'cancer'; // To distinguish global average types
  count: number;
  // For backward compatibility with existing code
  avgGlaucomaScore?: number;
  avgCancerScore?: number;
}

// Define sortable fields
type SortField = 'userId.email' | 'userId.name' | 'timestamp' | 'glaucomaScore' | 'cancerScore' | 'type';
type SortOrder = 'asc' | 'desc';

// Define the question interface for the illness editor
interface Question {
  questionId: string;
  text: string;
  weight: number;
  autoPopulate?: boolean;
  autoPopulateFrom?: string;
  _id?: string;
}

interface DoctorDashboardProps {
  initialAssessments: PopulatedAssessment[];
  totalAssessments: number;
  totalPages: number;
  currentPage: number;
  initialFilters: {
      userEmail: string;
      startDate: string;
      endDate: string;
      illnessType?: string;
      minScore?: string;
  };
  initialRiskFilter: string | null;
  initialSortField: SortField | null;
  initialSortOrder: SortOrder | null;
  initialIllnesses?: IIllness[];
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
    initialIllnesses = [],
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
  const [minScoreFilter, setMinScoreFilter] = useState<string>(initialFilters.minScore || '0');
  const [illnessTypeFilter, setIllnessTypeFilter] = useState<string>(initialFilters.illnessType || '');

  // State for sorting
  const [sortField, setSortField] = useState<SortField | null>(initialSortField);
  const [sortOrder, setSortOrder] = useState<SortOrder | null>(initialSortOrder);

  // State for tab selection
  const [activeTab, setActiveTab] = useState<'assessments' | 'illnesses' | 'overview'>('overview');
  const [trendGranularity, setTrendGranularity] = useState<'weekly' | 'monthly'>('weekly'); // New state for toggling
  
  // State for illnesses management
  const [illnesses, setIllnesses] = useState<IIllness[]>(initialIllnesses || []);
  const [loadingIllnesses, setLoadingIllnesses] = useState<boolean>(false);
  const [selectedIllness, setSelectedIllness] = useState<string | null>(null);
  const [illnessQuestions, setIllnessQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState<boolean>(false);
  const [showNewIllnessForm, setShowNewIllnessForm] = useState<boolean>(false);
  const [showQuestionForm, setShowQuestionForm] = useState<boolean>(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  // State for selecting an illness to edit
  const [editingIllness, setEditingIllness] = useState<IIllness | null>(null); 
  const [showEditIllnessForm, setShowEditIllnessForm] = useState<boolean>(false);
  // State for the edit illness form data
  const [editIllnessFormData, setEditIllnessFormData] = useState<{ name: string; description: string }>({ name: '', description: '' });

  // New illness form state
  const [newIllness, setNewIllness] = useState<{
    name: string;
    type: string;
    description: string;
  }>({
    name: '',
    type: '',
    description: ''
  });

  // New/edit question form state (This was missing)
  const [questionForm, setQuestionForm] = useState<Question>({
    questionId: '',
    text: '',
    weight: 1.0,
    autoPopulate: false,
    autoPopulateFrom: '' // Ensure this is initialized
  });

   // Authentication and Role check client-side (fallback)
  useEffect(() => {
    if (status === 'loading') return; // Wait until session status is resolved
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/doctor/dashboard');
    } else if (session?.user?.role !== 'doctor') {
      // Redirect non-officials to home page or an unauthorized page
       setError("Access Denied: You do not have permission to view this page.");
       // Optionally redirect after a delay
       setTimeout(() => router.push('/'), 3000);
    }
  }, [status, session, router]);

  // Set document title
  useEffect(() => {
    document.title = 'CLEAR-D | Official Dashboard';
  }, []);

  // Fetch illnesses with error handling and debugging
  const fetchIllnesses = useCallback(async () => {
    setLoadingIllnesses(true);
    setError(null);
    try {
      const response = await fetch('/api/illnesses');
        if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to fetch illnesses and parse error response' }));
        console.error('Illness fetch failed:', response.status, errorData);
        throw new Error(errorData.message || `Failed to fetch illnesses: ${response.status}`);
      }
      const result = await response.json();
      console.log('Fetched illnesses data:', result);
      if (result.success && Array.isArray(result.data)) {
        setIllnesses(result.data);
      } else {
        console.error('Fetched data is not in the expected format:', result);
        setIllnesses([]);
        throw new Error('Unexpected data format for illnesses.');
      }
    } catch (error: any) {
      console.error('Error fetching illnesses:', error);
      setError(error.message || 'Failed to load illnesses');
      setIllnesses([]);
      } finally {
      setLoadingIllnesses(false);
      }
  }, []);
    
  // Effect to fetch illnesses on component mount or when filters impacting them change (if any)
  useEffect(() => {
    if (session?.user?.role === 'doctor') {
        fetchIllnesses();
    }
  }, [session, fetchIllnesses]);

  // Updated function to fetch assessments based on current page, filters, AND SORTING
  const fetchAssessments = useCallback(async (
    page: number,
    currentFilters: typeof filters,
    currentMinScoreFilter: string,
    currentIllnessTypeFilter: string,
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
        if (currentMinScoreFilter && currentMinScoreFilter !== '0') params.set('minScore', currentMinScoreFilter);
        if (currentIllnessTypeFilter) params.set('type', currentIllnessTypeFilter);

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

    // Debounced refetch function for reactive filters
    const debouncedRefetchAssessments = useMemo(() =>
      debounce((newFilterSettings: {
        textFilters: typeof filters;
        scoreFilter: string;
        typeFilter: string;
        sField: SortField | null;
        sOrder: SortOrder | null;
      }) => {
        setCurrentPage(1); // Always reset to page 1 for filter changes
        fetchAssessments(
          1, // page
          newFilterSettings.textFilters,
          newFilterSettings.scoreFilter,
          newFilterSettings.typeFilter,
          newFilterSettings.sField,
          newFilterSettings.sOrder
        );
      }, 500),
      [fetchAssessments, setCurrentPage] // setCurrentPage is stable, fetchAssessments is the key dependency
    );

    // Initial fetch on mount
    useEffect(() => {
        fetchAssessments(currentPage, filters, minScoreFilter, illnessTypeFilter, sortField, sortOrder);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run on mount

    // Handle filter input changes
    const handleFilterInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        setFilterInput(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    // Apply filters and fetch data for page 1 with current sort and risk filter
    const applyFilters = () => {
         setFilters(filterInput); 
         setCurrentPage(1); 
         fetchAssessments(1, filterInput, minScoreFilter, illnessTypeFilter, sortField, sortOrder);
    };

     // Reset filters and fetch all data for page 1 with default sort (or current sort)
    const resetFilters = () => {
        const emptyFilters = { userEmail: '', startDate: '', endDate: '', illnessType: '', minScore: '0' };
        setFilterInput(emptyFilters);
        setFilters(emptyFilters);
        setMinScoreFilter('0');
        setIllnessTypeFilter('');
        setSortField(null);
        setSortOrder(null);
        setCurrentPage(1); 
        fetchAssessments(1, emptyFilters, '0', '', null, null);
    };

    // New handler for universal min score slider
    const handleMinScoreFilterChange = (e: ChangeEvent<HTMLInputElement>) => {
      const newMinScore = e.target.value;
      setMinScoreFilter(newMinScore);
      debouncedRefetchAssessments({
        textFilters: filters, // Use current committed text/date filters
        scoreFilter: newMinScore, // Use the new score from slider
        typeFilter: illnessTypeFilter, // Use current illness type filter from state
        sField: sortField,
        sOrder: sortOrder,
      });
    };

    // Handler for illness type filter (ensure it calls fetchAssessments with minScoreFilter)
    const handleIllnessTypeFilterChange = (e: ChangeEvent<HTMLSelectElement>) => {
      const newIllnessType = e.target.value;
      setIllnessTypeFilter(newIllnessType);
      debouncedRefetchAssessments({
        textFilters: filters, // Use current committed text/date filters
        scoreFilter: minScoreFilter, // Use current min score filter from state
        typeFilter: newIllnessType, // Use the new illness type from dropdown
        sField: sortField,
        sOrder: sortOrder,
      });
    };

    // Handle pagination clicks
    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) {
            fetchAssessments(newPage, filters, minScoreFilter, illnessTypeFilter, sortField, sortOrder);
        }
    };
    
    // Handle sort clicks
    const handleSort = (field: SortField) => {
        // If clicking the same field, toggle order, otherwise set to desc by default
        const newOrder = sortField === field && sortOrder === 'desc' ? 'asc' : 'desc';
        setSortField(field);
        setSortOrder(newOrder);
        // Fetch assessments with new sort params (router.push will trigger getServerSideProps or client-side fetch)
        const currentQuery = { ...router.query }; // Preserve existing query params
        currentQuery.sortField = field;
        currentQuery.sortOrder = newOrder;
        currentQuery.page = '1'; // Reset to first page on sort
        router.push({ pathname: router.pathname, query: currentQuery }, undefined, { shallow: false });
    };

  // Fetch questions for a specific illness
  const fetchQuestionsForIllness = async (illnessType: string) => {
    setLoadingQuestions(true);
    try {
      const response = await fetch(`/api/illnesses/${illnessType}/questions`);
      if (!response.ok) {
        throw new Error(`Failed to fetch questions for ${illnessType}`);
      }
      const data = await response.json();
      setIllnessQuestions(data.questions || []);
      setSelectedIllness(illnessType);
    } catch (error) {
      console.error(`Error fetching questions for ${illnessType}:`, error);
      setError(`Failed to load questions for ${illnessType}`);
    } finally {
      setLoadingQuestions(false);
    }
  };

  // Handle adding a new illness with better validation and error handling
  const handleAddIllness = async () => {
    if (!newIllness.name || !newIllness.type) {
      setError('Illness name and type are required.');
      return;
    }
    // Basic slug validation for type
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(newIllness.type)) {
        setError('Type must be a valid slug (e.g., diabetes, common-cold). No spaces or special characters other than hyphens.');
        return;
    }

    setLoadingIllnesses(true);
    try {
      const response = await fetch('/api/illnesses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newIllness.name,
          type: newIllness.type.toLowerCase().trim(),
          description: newIllness.description,
          // isSystemDefined will be false by default in the API if not provided
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error adding illness and could not parse error response.' }));
        throw new Error(errorData.message || `Failed to add illness: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        setIllnesses(prev => [...prev, result.data]);
        setNewIllness({ name: '', type: '', description: '' }); // Reset form
        setShowNewIllnessForm(false);
        setError(null);
      } else {
        throw new Error(result.message || 'Failed to add illness due to server error.');
      }
    } catch (error: any) {
      console.error('Error adding illness:', error);
      setError(error.message || 'Could not add illness.');
    } finally {
      setLoadingIllnesses(false);
    }
  };

  // Handle updating an existing illness (PUT)
  const handleUpdateIllness = async () => {
    if (!editingIllness || !editingIllness.type) { // Use editingIllness for the original type
      setError('No illness selected for update or type is missing.');
      return;
    }
    if (!editIllnessFormData.name.trim()) { // Use editIllnessFormData for current form values
        setError('Illness name cannot be empty.');
        return;
    }

    setLoadingIllnesses(true);
    try {
      const response = await fetch(`/api/illnesses/${editingIllness.type}`, // Use original type from editingIllness
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: editIllnessFormData.name, // Send form data
            description: editIllnessFormData.description,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error updating illness and could not parse error response.'}));
        throw new Error(errorData.message || `Failed to update illness: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        await fetchIllnesses();
        setShowEditIllnessForm(false);
        setEditingIllness(null);
        setEditIllnessFormData({ name: '', description: '' }); // Reset form data state
        setError(null);
      } else {
        throw new Error(result.message || 'Failed to update illness due to server error.');
      }
    } catch (err: any) {
      console.error('Error updating illness:', err);
      setError(err.message || 'Could not update illness.');
    } finally {
      setLoadingIllnesses(false);
    }
  };

  // Handle deleting an illness
  const handleDeleteIllness = async (illnessType: string) => {
    const illnessToDelete = illnesses.find(ill => ill.type === illnessType);
    if (!illnessToDelete) {
      setError('Illness not found for deletion.');
      return;
    }

    if (illnessToDelete.isSystemDefined) {
      setError('System-defined illnesses cannot be deleted.');
      alert('System-defined illnesses (like Glaucoma, Cancer) cannot be deleted.');
      return;
    }

    if (window.confirm(`Are you sure you want to delete the illness "${illnessToDelete.name}"? This will also delete all its associated questions.`)) {
      setLoadingIllnesses(true);
      try {
        const response = await fetch(`/api/illnesses/${illnessType}`,
          { method: 'DELETE' }
        );
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Error deleting illness and could not parse error response.'}));
          throw new Error(errorData.message || `Failed to delete illness: ${response.status}`);
        }
        // Refresh illness list
        await fetchIllnesses(); 
        // If the deleted illness was selected, clear selection
        if (selectedIllness === illnessType) {
          setSelectedIllness(null);
          setIllnessQuestions([]);
        }
        setError(null);
      } catch (err: any) {
        console.error('Error deleting illness:', err);
        setError(err.message || 'Could not delete illness.');
      } finally {
        setLoadingIllnesses(false);
      }
    }
  };

  // Handle adding/editing a question
  const handleSaveQuestion = async () => {
    try {
      if (!selectedIllness) {
        throw new Error('No illness selected');
      }
      
      const method = editingQuestion?._id ? 'PUT' : 'POST';
      const endpoint = editingQuestion?._id 
        ? `/api/illnesses/${selectedIllness}/questions/${editingQuestion._id}` 
        : `/api/illnesses/${selectedIllness}/questions`;
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...questionForm,
          type: selectedIllness
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${editingQuestion ? 'update' : 'create'} question`);
      }
      
      // Reset form and refresh questions
      setQuestionForm({
        questionId: '',
        text: '',
        weight: 1.0,
        autoPopulate: false
      });
      setShowQuestionForm(false);
      setEditingQuestion(null);
      fetchQuestionsForIllness(selectedIllness);
    } catch (error: any) {
      setError(error.message || 'Failed to save question');
    }
  };

  // Handle deleting a question
  const handleDeleteQuestion = async (questionId: string) => {
    if (!selectedIllness) return;
    
    if (!confirm('Are you sure you want to delete this question? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/illnesses/${selectedIllness}/questions/${questionId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete question');
      }
      
      // Refresh questions
      fetchQuestionsForIllness(selectedIllness);
    } catch (error: any) {
      setError(error.message || 'Failed to delete question');
    }
  };

  // Add a helper function at the top of the component to format dates safely
  const formatDateTime = (dateString: string | Date | undefined) => {
    if (!dateString) return 'N/A';
    
    try {
      // Handle ISO string properly by ensuring it's a string
      const stringDate = typeof dateString === 'string' ? dateString : dateString.toString();
      
      // Skip MongoDB ObjectId strings which aren't dates 
      if (stringDate.match(/^[0-9a-fA-F]{24}$/)) {
        console.warn('Attempted to format ObjectId as date:', stringDate);
        return 'N/A';
      }
      
      // Try to parse it as ISO format first
      const date = new Date(stringDate);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date format:', stringDate);
        return 'N/A';
      }
      
      // Use more reliable date formatting (avoid timezone issues)
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return 'N/A';
    }
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
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Official Dashboard</h1>

      {/* Tab Navigation */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {(['overview', 'assessments', 'illnesses'] as const).map((tabName) => (
            <button
              key={tabName}
              onClick={() => setActiveTab(tabName)}
              className={`
                ${activeTab === tabName
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm capitalize
              `}
            >
              {tabName === 'assessments' ? 'Assessment Records' : tabName.replace('-', ' ')}
            </button>
          ))}
        </nav>
      </div>

      {/* Global Filter Section - Stays on top for now */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-sm space-y-4">
        <h2 className="text-xl font-semibold text-gray-700 mb-3">Filters</h2>
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

        {/* Row 2: Select Filters (Glaucoma, Cancer & NEW Illness Type) */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
          {/* Universal Min Score Filter SLIDER */}
                 <div>
            <label htmlFor="minScoreFilter" className="block text-sm font-medium text-gray-700 mb-1">Min Score: {minScoreFilter}</label>
            <input
              type="range"
              id="minScoreFilter"
              name="minScoreFilter"
              min="0"
              max="10"
              step="0.1"
              value={minScoreFilter} 
              onChange={handleMinScoreFilterChange} 
                        disabled={loading}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-600 hover:accent-gray-700 dark:bg-gray-700 dark:accent-gray-500"
            />
                </div>

          {/* NEW Illness Type Filter */}
                <div>
            <label htmlFor="illnessTypeFilter" className="block text-sm font-medium text-gray-700 mb-1">Filter by Illness Type</label>
                    <select
              id="illnessTypeFilter"
              name="illnessTypeFilter"
              value={illnessTypeFilter}
              onChange={handleIllnessTypeFilterChange}
              disabled={loading || loadingIllnesses}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm bg-white"
                    >
              <option value="">All Illness Types</option>
              {illnesses.map(illness => (
                <option key={illness.type} value={illness.type}>
                  {illness.name}
                </option>
              ))}
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

      {/* Conditional Content based on activeTab */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-800">Assessment Trends</h2>
            <button 
                onClick={() => setTrendGranularity(prev => prev === 'weekly' ? 'monthly' : 'weekly')}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
              >
                Switch to {trendGranularity === 'weekly' ? 'Monthly' : 'Weekly'} View
            </button>
        </div>
        
            {/* Conditional Rendering for Weekly or Monthly Trends Chart */}
            <div className="mb-8">
              {trendGranularity === 'weekly' ? (
                <>
                  <h3 className="text-xl font-semibold text-gray-700 mb-3">Weekly Score & Volume Trends</h3>
                  <AssessmentTrendsChart />
                </>
        ) : (
          <>
                  <h3 className="text-xl font-semibold text-gray-700 mb-3">Monthly Score & Volume Trends</h3>
                  <MonthlyAssessmentTrendsChart />
                </>
              )}
            </div>

            {/* NEW Illness Distribution Chart */}
            <div className="mt-12 mb-8">
              <IllnessDistributionChart />
                  </div>

            {/* User Activity / Recent Assessments - Placeholder */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              {/* Placeholder for user activity section */}
          </div>
      </div>
        )}

        {activeTab === 'assessments' && (
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Assessment Records</h2>
      {loading && <div className="text-center py-4 text-gray-500">Loading assessments...</div>}
            {!loading && assessments.length === 0 && !error && (
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
                           {/* ASSESSMENT TYPE */}
                           <button onClick={() => handleSort('type')} className="flex items-center space-x-1 hover:text-gray-900">
                             <span>ASSESSMENT TYPE</span>
                             {sortField === 'type' && (
                               <span className="text-xs">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                             )}
                           </button>
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
                              {assessment.userId?.name ?
                                (typeof assessment.userId.name === 'object' ?
                                  `${assessment.userId.name.first || ''} ${assessment.userId.name.last || ''}`.trim() :
                                  assessment.userId.name)
                                : 'N/A'}
                     </td>
                     <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                             {formatDateTime(assessment.timestamp || assessment.createdAt)}
                     </td>
                     <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-green-700 text-center">
                             {assessment.type === 'glaucoma'
                               ? (assessment.totalScore ?? assessment.glaucomaScore ?? 0).toFixed(1)
                               : (assessment.glaucomaScore ?? 0).toFixed(1)}/10
                     </td>
                     <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-purple-700 text-center">
                             {assessment.type === 'cancer'
                               ? (assessment.totalScore ?? assessment.cancerScore ?? 0).toFixed(1)
                               : (assessment.cancerScore ?? 0).toFixed(1)}/10
                     </td>
                           <td className={`px-4 py-3 whitespace-nowrap text-sm font-semibold
                              ${assessment.type === 'glaucoma' ? 'text-green-700' 
                                : assessment.type === 'cancer' ? 'text-purple-700' 
                                : 'text-gray-700' // Default color for other types
                              }`}>
                                {(assessment.type && typeof assessment.type === 'string') 
                                  ? assessment.type.charAt(0).toUpperCase() + assessment.type.slice(1) 
                                  : 'Unknown'}
                     </td>
                          <td className="px-4 py-3 text-sm text-gray-600 max-w-sm truncate" title={
                              typeof assessment.recommendations === 'string'
                                ? assessment.recommendations.split('\n')[0]
                                : Array.isArray(assessment.recommendations)
                                  ? assessment.recommendations[0]
                                  : '-'
                            }>
                              {
                                typeof assessment.recommendations === 'string'
                                  ? assessment.recommendations.split('\n')[0]
                                  : Array.isArray(assessment.recommendations)
                                    ? assessment.recommendations[0]
                                    : '-'
                              }
                    </td>
                     <td className="px-4 py-3 whitespace-nowrap text-center text-sm font-medium">
                        <Link href={`/results/${assessment._id}`} className="text-blue-600 hover:text-blue-800 hover:underline">
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
        )}

        {activeTab === 'illnesses' && (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-800">Manage Illnesses</h2>
              <button
                onClick={() => {
                  setShowNewIllnessForm(true);
                  setShowEditIllnessForm(false); // Ensure edit form is hidden
                  setEditingIllness(null);
                  setNewIllness({ name: '', type: '', description: '' }); // Reset add form
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Add New Illness
              </button>
            </div>

            {/* Edit Existing Illness Form */}
            {showEditIllnessForm && editingIllness && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-medium text-gray-800 mb-4">Edit Illness: {editingIllness.name} (Type: {editingIllness.type})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="editIllnessName" className="block text-sm font-medium text-gray-700 mb-1">
                      Illness Name
                    </label>
                    <input
                      type="text"
                      id="editIllnessName"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      value={editIllnessFormData.name} // Bind to editIllnessFormData
                      onChange={(e) => setEditIllnessFormData({ ...editIllnessFormData, name: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="editIllnessDescription" className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      id="editIllnessDescription"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      value={editIllnessFormData.description || ''} // Bind to editIllnessFormData
                      onChange={(e) => setEditIllnessFormData({ ...editIllnessFormData, description: e.target.value })}
                      rows={3}
                    ></textarea>
                  </div>
                </div>
                <p className="text-xs text-gray-600 mt-2">Note: The &apos;Type (API Identifier)&apos; and &apos;Is System Defined&apos; cannot be changed after creation.</p>
                <div className="mt-4 flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setShowEditIllnessForm(false);
                      setEditingIllness(null);
                      setEditIllnessFormData({ name: '', description: '' }); // Reset form data
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateIllness}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    disabled={loadingIllnesses}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            )}

            {/* Add New Illness Form */}
            {showNewIllnessForm && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-medium text-gray-800 mb-4">Add New Illness</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="illnessName" className="block text-sm font-medium text-gray-700 mb-1">
                      Illness Name
                    </label>
                    <input
                      type="text"
                      id="illnessName"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      value={newIllness.name}
                      onChange={(e) => setNewIllness({ ...newIllness, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label htmlFor="illnessType" className="block text-sm font-medium text-gray-700 mb-1">
                      Illness Type (API Identifier)
                    </label>
                    <input
                      type="text"
                      id="illnessType"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      value={newIllness.type}
                      onChange={(e) => setNewIllness({ ...newIllness, type: e.target.value.toLowerCase() })}
                      placeholder="e.g., glaucoma, cancer"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="illnessDescription" className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      id="illnessDescription"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      value={newIllness.description}
                      onChange={(e) => setNewIllness({ ...newIllness, description: e.target.value })}
                      rows={3}
                    ></textarea>
                  </div>
                </div>
                <div className="mt-4 flex justify-end space-x-3">
                  <button
                    onClick={() => setShowNewIllnessForm(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddIllness}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Add Illness
                  </button>
                </div>
              </div>
            )}

            {/* Illnesses List and Questions Editor */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Illnesses List */}
              <div className="lg:col-span-1">
                <h3 className="text-lg font-medium text-gray-800 mb-4">Available Illnesses</h3>
                {loadingIllnesses ? (
                  <div className="flex justify-center items-center h-40">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                ) : illnesses.length === 0 ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                    <p className="text-gray-600">No illnesses found. Click &quot;Add New Illness&quot; to create one.</p>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                    <ul className="divide-y divide-gray-200">
                      {illnesses.map((illness) => (
                        <li key={illness.type} className={`p-3 hover:bg-gray-100 ${selectedIllness === illness.type ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}>
                          <div className="flex justify-between items-center">
                            <button
                              onClick={() => {
                                  setSelectedIllness(illness.type);
                                  fetchQuestionsForIllness(illness.type);
                              }}
                              className="text-left flex-grow focus:outline-none mr-2"
                            >
                              <div className="font-medium text-gray-800">{illness.name}</div>
                              <div className="text-sm text-gray-500">
                                Type: {illness.type} • Last Updated: {new Date(illness.updatedAt).toLocaleDateString()}
                              </div>
                              {illness.description && (
                                <p className="text-xs text-gray-600 mt-1 truncate" title={illness.description}>{illness.description}</p>
                              )}
                            </button>
                            <div className="flex-shrink-0 space-x-2">
                              <button 
                                onClick={() => { 
                                  setEditingIllness(illness); // Set the original illness object
                                  setEditIllnessFormData({ name: illness.name, description: illness.description || '' }); // Populate form data
                                  setShowEditIllnessForm(true);
                                  setShowNewIllnessForm(false);
                                }}
                                className="text-xs px-2 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
                                disabled={illness.isSystemDefined} // Disable edit for system illnesses too for now
                                title={illness.isSystemDefined ? "System illnesses cannot be edited here" : "Edit Illness"}
                              >
                                Edit
                              </button>
                              <button 
                                onClick={() => handleDeleteIllness(illness.type)}
                                className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                                disabled={illness.isSystemDefined}
                                title={illness.isSystemDefined ? "System illnesses cannot be deleted" : "Delete Illness"}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Questions Editor */}
              <div className="lg:col-span-2">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-800">
                    {selectedIllness
                      ? `Questions for ${illnesses.find(i => i.type === selectedIllness)?.name || selectedIllness}`
                      : 'Select an illness to manage questions'}
                  </h3>
                  {selectedIllness && (
                    <button
                      onClick={() => {
                        setShowQuestionForm(true);
                        setEditingQuestion(null);
                        setQuestionForm({
                          questionId: '',
                          text: '',
                          weight: 1.0,
                          autoPopulate: false,
                          autoPopulateFrom: ''
                        });
                      }}
                      className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                    >
                      Add Question
                    </button>
                  )}
                </div>

                {/* Add/Edit Question Form */}
                {showQuestionForm && selectedIllness && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                    <h4 className="text-md font-medium text-gray-800 mb-3">
                      {editingQuestion ? 'Edit Question' : 'Add Question'}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="questionId" className="block text-sm font-medium text-gray-700 mb-1">
                          Question ID
                        </label>
                        <input
                          type="text"
                          id="questionId"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          value={questionForm.questionId}
                          onChange={(e) => setQuestionForm({ ...questionForm, questionId: e.target.value })}
                          placeholder={`e.g., ${selectedIllness.charAt(0).toUpperCase()}1`}
                        />
                      </div>
                      <div>
                        <label htmlFor="weight" className="block text-sm font-medium text-gray-700 mb-1">
                          Weight
                        </label>
                        <input
                          type="number"
                          id="weight"
                          step="0.1"
                          min="0.1"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          value={questionForm.weight}
                          onChange={(e) => setQuestionForm({ ...questionForm, weight: parseFloat(e.target.value) })}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="questionText" className="block text-sm font-medium text-gray-700 mb-1">
                          Question Text
                        </label>
                        <textarea
                          id="questionText"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                          value={questionForm.text}
                          onChange={(e) => setQuestionForm({ ...questionForm, text: e.target.value })}
                          rows={2}
                        ></textarea>
                      </div>
                      <div className="md:col-span-2">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            id="autoPopulate"
                            className="h-4 w-4 text-blue-600 rounded"
                            checked={questionForm.autoPopulate || false}
                            onChange={(e) => setQuestionForm({ ...questionForm, autoPopulate: e.target.checked })}
                          />
                          <label htmlFor="autoPopulate" className="ml-2 block text-sm text-gray-700">
                            Auto-populate from user data
                          </label>
                        </div>
                        {questionForm.autoPopulate && (
                          <div className="mt-2">
                            <label htmlFor="autoPopulateFrom" className="block text-sm font-medium text-gray-700 mb-1">
                              Data Source
                            </label>
                            <select
                              id="autoPopulateFrom"
                              className="w-full px-3 py-2 border border-gray-300 rounded-md"
                              value={questionForm.autoPopulateFrom || ''}
                              onChange={(e) => setQuestionForm({ ...questionForm, autoPopulateFrom: e.target.value })}
                            >
                              <option value="">Select a data source</option>
                              <option value="userData.hasDiabetes">User&apos;s Diabetes Status</option>
                              <option value="userData.age">User&apos;s Age</option>
                              <option value="userData.gender">User&apos;s Gender</option>
                              <option value="userData.ethnicity">User&apos;s Ethnicity</option>
                              {/* TODO: Add more relevant user data fields for auto-population */}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end space-x-3">
                      <button
                        onClick={() => {
                          setShowQuestionForm(false);
                          setEditingQuestion(null);
                        }}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveQuestion}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      >
                        {editingQuestion ? 'Update Question' : 'Add Question'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Questions Table */}
                {selectedIllness ? (
                  loadingQuestions ? (
                    <div className="flex justify-center items-center h-40">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                  ) : illnessQuestions.length === 0 ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                      <p className="text-gray-600">No questions found for this illness. Click &quot;Add Question&quot; to create one.</p>
                    </div>
                  ) : (
                    <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              ID
                            </th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Question
                            </th>
                            <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Weight
                            </th>
                            <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Auto
                            </th>
                            <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {illnessQuestions.map((question) => (
                            <tr key={question._id || question.questionId} className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                                {question.questionId}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-500">
                                {question.text}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                                {question.weight.toFixed(1)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">
                                {question.autoPopulate ? (
                                  <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                    Yes
                                  </span>
                                ) : (
                                  <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                    No
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-right">
                                <button
                                  onClick={() => {
                                    setEditingQuestion(question);
                                    setQuestionForm({
                                      _id: question._id,
                                      questionId: question.questionId,
                                      text: question.text,
                                      weight: question.weight,
                                      autoPopulate: question.autoPopulate,
                                      autoPopulateFrom: question.autoPopulateFrom
                                    });
                                    setShowQuestionForm(true);
                                  }}
                                  className="text-blue-600 hover:text-blue-900 mr-3"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteQuestion(question._id || question.questionId)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                    <p className="text-gray-600">Select an illness from the list to manage its questions.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
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

  // 2. Check if user has the 'official' role
   if (session.user.role !== 'doctor') {
    // You can redirect non-officials or return an error prop
        return {
      // Redirect to home page or an access denied page
      redirect: { destination: '/?error=access_denied', permanent: false },
        };
   }

  // 3. Fetch data for the doctor
    const page = parseInt(context.query.page as string) || 1;
    const limit = 15; // Match client-side limit
    const userEmail = context.query.userEmail as string || '';
    const startDate = context.query.startDate as string || '';
    const endDate = context.query.endDate as string || '';
    const initialMinScore = context.query.minScore as string || '0';
    const initialIllnessType = context.query.type as string || '';

     const initialFilters = { userEmail, startDate, endDate, illnessType: initialIllnessType, minScore: initialMinScore };

     const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
        });
        if (userEmail) params.set('userEmail', userEmail);
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        if (initialMinScore !== '0') params.set('minScore', initialMinScore);
        if (initialIllnessType) params.set('type', initialIllnessType);

    // 4. Also fetch illnesses for the illness management tab
    let initialIllnesses: IIllness[] = [];
    try {
      const apiUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/illnesses`;
      const response = await fetch(apiUrl, {
        headers: {
          'Cookie': context.req.headers.cookie || '',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        initialIllnesses = data.illnesses || [];
      }
    } catch (error) {
      console.error('Error fetching illnesses server-side:', error);
    }

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
            return { 
              props: { 
                initialAssessments: [], 
                totalAssessments: 0, 
                totalPages: 0, 
                currentPage: 1, 
                initialFilters, 
                initialRiskFilter: null, 
                initialSortField: null, 
                initialSortOrder: null,
                initialIllnesses,
                error: errorData.message || 'Failed to load assessments.' 
              } 
            };
        }

        const data = await response.json();
         if (!data || !Array.isArray(data.assessments)) {
             throw new Error('Invalid data format received from API');
         }

        return {
            props: {
                initialAssessments: JSON.parse(JSON.stringify(data.assessments)),
                totalAssessments: data.totalAssessments,
                totalPages: data.totalPages,
                currentPage: data.currentPage,
                initialFilters,
                initialRiskFilter: null,
                initialSortField: null,
                initialSortOrder: null,
                initialIllnesses,
            },
        };
    } catch (error: any) {
         console.error('Error fetching assessments server-side (Doctor Dashboard):', error);
         return { 
           props: { 
             initialAssessments: [], 
             totalAssessments: 0, 
             totalPages: 0, 
             currentPage: 1, 
             initialFilters, 
             initialRiskFilter: null, 
             initialSortField: null, 
             initialSortOrder: null,
             initialIllnesses,
             error: error.message || 'Server error fetching assessments.' 
           } 
         };
    }
};

export default DoctorDashboard; 