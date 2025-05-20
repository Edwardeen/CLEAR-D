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
import UserTrendChart from '../../components/charts/UserTrendChart';

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

  // State for selected user trend data
  const [selectedUserEmail, setSelectedUserEmail] = useState<string>('');
  const [selectedUserName, setSelectedUserName] = useState<string>('');
  const [selectedUserTrends, setSelectedUserTrends] = useState<{
    glaucoma: { date: string; score: number }[];
    cancer: { date: string; score: number }[];
  }>({ glaucoma: [], cancer: [] });
  const [loadingUserTrends, setLoadingUserTrends] = useState<boolean>(false);

  // State for filters
  const [filters, setFilters] = useState(initialFilters);
  const [filterInput, setFilterInput] = useState(initialFilters); // Temporary input state
  const [minScoreFilter, setMinScoreFilter] = useState<string>(initialFilters.minScore || '0');
  const [illnessTypeFilter, setIllnessTypeFilter] = useState<string>(initialFilters.illnessType || '');

  // State for sorting
  const [sortField, setSortField] = useState<SortField | null>(initialSortField);
  const [sortOrder, setSortOrder] = useState<SortOrder | null>(initialSortOrder);

  // State for tab selection
  const [activeTab, setActiveTab] = useState<'assessments' | 'illnesses' | 'overview' | 'allUserAssessments'>('overview'); // Added 'allUserAssessments'
  const [trendGranularity, setTrendGranularity] = useState<'weekly' | 'monthly'>('weekly'); // New state for toggling
  
  // State for All User Assessments
  const [allUserAssessments, setAllUserAssessments] = useState<PopulatedAssessment[]>([]);
  const [loadingAllUserAssessments, setLoadingAllUserAssessments] = useState<boolean>(false);
  const [allUserAssessmentsError, setAllUserAssessmentsError] = useState<string | null>(null);
  const [allUserAssessmentsCurrentPage, setAllUserAssessmentsCurrentPage] = useState<number>(1);
  const [allUserAssessmentsTotalPages, setAllUserAssessmentsTotalPages] = useState<number>(1);
  
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

  // Fetch all user assessments for the 'All User Assessments' tab
  const fetchAllUserAssessments = useCallback(async (page: number) => {
    setLoadingAllUserAssessments(true);
    setAllUserAssessmentsError(null);
    try {
      const response = await fetch(`/api/assessments/all?page=${page}&limit=15`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to fetch all user assessments' }));
        throw new Error(errorData.message || `Error: ${response.status}`);
      }
      const data = await response.json();
      setAllUserAssessments(data.assessments || []);
      setAllUserAssessmentsCurrentPage(data.currentPage);
      setAllUserAssessmentsTotalPages(data.totalPages);
    } catch (err: any) {
      console.error("Error fetching all user assessments:", err);
      setAllUserAssessmentsError(err.message || 'Could not load all user assessments.');
      setAllUserAssessments([]); // Clear data on error
    } finally {
      setLoadingAllUserAssessments(false);
    }
  }, []); // No dependencies needed if it doesn't rely on other state/props that change

  // Effect to fetch data for 'All User Assessments' tab when it becomes active or its page changes
  useEffect(() => {
    if (activeTab === 'allUserAssessments' && session?.user?.role === 'doctor') {
      fetchAllUserAssessments(allUserAssessmentsCurrentPage);
    }
  }, [activeTab, allUserAssessmentsCurrentPage, fetchAllUserAssessments, session]);

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
             
             // If a specific user is being filtered, fetch their trend data
             if (currentFilters.userEmail && currentFilters.userEmail.trim() !== '') {
                 fetchUserTrends(currentFilters.userEmail);
             } else {
                 // Clear user trend data if no specific user is filtered
                 setSelectedUserEmail('');
                 setSelectedUserName('');
                 setSelectedUserTrends({ glaucoma: [], cancer: [] });
             }
        } catch (error: any) {
            console.error('Error fetching assessments:', error);
            setError(error.message || 'An error occurred while fetching assessments.');
        } finally {
            setLoading(false);
        }
    }, [router]);

    // Function to fetch trend data for a specific user
    const fetchUserTrends = async (userEmail: string) => {
      if (!userEmail) return;
      
      setLoadingUserTrends(true);
      try {
        // Build query parameters to include all current filters
        const params = new URLSearchParams();
        params.set('email', encodeURIComponent(userEmail));
        
        // Add date filters if they exist - use the current filters state
        if (filters.startDate) params.set('startDate', filters.startDate);
        if (filters.endDate) params.set('endDate', filters.endDate);
        
        // Add illness type filter if selected - use the current illnessTypeFilter state
        if (illnessTypeFilter) params.set('type', illnessTypeFilter);
        
        // Add min score filter if it's not zero - use the current minScoreFilter state
        if (minScoreFilter && minScoreFilter !== '0') {
          params.set('minScore', minScoreFilter);
        }
        
        console.log('Fetching user trends with params:', params.toString());
        const response = await fetch(`/api/users/trends?${params.toString()}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('User trends fetch failed:', response.status, errorData);
          throw new Error(errorData.detail || errorData.message || `Failed to fetch user trends: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.userName) {
          setSelectedUserName(data.userName);
        }
        
        setSelectedUserEmail(userEmail);
        
        // Process the trend data
        const glaucomaTrends = (data.assessments || [])
          .filter((a: any) => a.type === 'glaucoma' && a.totalScore !== undefined)
          .map((a: any) => ({
            date: new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            score: a.totalScore
          }))
          .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        const cancerTrends = (data.assessments || [])
          .filter((a: any) => a.type === 'cancer' && a.totalScore !== undefined)
          .map((a: any) => ({
            date: new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            score: a.totalScore
          }))
          .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        setSelectedUserTrends({
          glaucoma: glaucomaTrends,
          cancer: cancerTrends
        });
        
      } catch (error: any) {
        console.error('Error fetching user trends:', error);
        setError(error.message || 'Failed to load user trend data');
        
        // Clear trend data on error
        setSelectedUserTrends({ glaucoma: [], cancer: [] });
      } finally {
        setLoadingUserTrends(false);
      }
    };

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
         
         // Also update user trend chart if user email is set
         if (filterInput.userEmail && filterInput.userEmail.trim() !== '') {
           fetchUserTrends(filterInput.userEmail);
         }
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
        
        // Clear user trends when filters are reset
        setSelectedUserEmail('');
        setSelectedUserName('');
        setSelectedUserTrends({ glaucoma: [], cancer: [] });
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
      
      // Update trend chart for the selected user with new score filter
      if (selectedUserEmail) {
        fetchUserTrends(selectedUserEmail);
      }
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
      
      // Update trend chart for the selected user with new illness type filter
      if (selectedUserEmail) {
        fetchUserTrends(selectedUserEmail);
      }
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

  // JSX for rendering tabs
  const renderTabs = () => (
    <div className="mb-6 border-b border-gray-200">
      <nav className="-mb-px flex space-x-8" aria-label="Tabs">
        {(['overview', 'assessments', 'allUserAssessments', 'illnesses'] as const).map((tabKey) => ( // Renamed 'tab' to 'tabKey' to avoid conflict
          <button
            key={tabKey}
            onClick={() => setActiveTab(tabKey)}
            className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === tabKey
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tabKey === 'overview' && 'Overview & Trends'}
            {tabKey === 'assessments' && 'My Patient Assessments'}
            {tabKey === 'allUserAssessments' && 'All User Assessments'}
            {tabKey === 'illnesses' && 'Manage Illnesses'}
          </button>
        ))}
      </nav>
    </div>
  );

  // Main content rendering based on activeTab
  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        // ... existing overview content ...
        return (
          <div>
            {/* Filters Section - Common for overview and assessments for now */}
            {/* ... existing filter JSX ... */}
            
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Global Health Trends</h2>
            {/* Trend Granularity Toggle */}
            {/* ... existing trend granularity toggle ... */}

            {/* Charts Section */}
            {/* ... existing charts ... */}
          </div>
        );
      case 'assessments':
        // ... existing assessments tab content ...
        return (
            <div>
                {/* ... existing assessments tab JSX ... */}
            </div>
        );
      case 'allUserAssessments':
        return (
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">All User Assessments</h2>
            {loadingAllUserAssessments && (
              <div className="flex justify-center items-center py-10">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                <p className="ml-4 text-gray-600">Loading all assessments...</p>
              </div>
            )}
            {allUserAssessmentsError && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                <strong className="font-bold">Error: </strong>
                <span className="block sm:inline">{allUserAssessmentsError}</span>
                <button 
                  onClick={() => fetchAllUserAssessments(allUserAssessmentsCurrentPage)}
                  className="ml-4 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                >
                  Retry
                </button>
              </div>
            )}
            {!loadingAllUserAssessments && !allUserAssessmentsError && allUserAssessments.length === 0 && (
              <p className="text-gray-600 text-center py-10">No assessments found in the system.</p>
            )}
            {!loadingAllUserAssessments && !allUserAssessmentsError && allUserAssessments.length > 0 && (
              <>
                <div className="overflow-x-auto bg-white shadow rounded-lg mb-6">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk Level</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {allUserAssessments.map((assessment) => (
                        <tr key={assessment._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {assessment.userId ? (typeof assessment.userId.name === 'string' ? assessment.userId.name : `${assessment.userId.name?.first || ''} ${assessment.userId.name?.last || ''}`.trim()) : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{assessment.userId?.email || 'N/A'}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              assessment.type === 'glaucoma' ? 'bg-green-100 text-green-800' : 
                              assessment.type === 'cancer' ? 'bg-pink-100 text-pink-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {assessment.type ? assessment.type.charAt(0).toUpperCase() + assessment.type.slice(1) : 'N/A'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDateTime(assessment.createdAt || assessment.timestamp)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{(assessment.totalScore ?? assessment.glaucomaScore ?? assessment.cancerScore ?? 0).toFixed(2)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                assessment.riskLevel === 'Low' ? 'bg-green-100 text-green-800' :
                                assessment.riskLevel === 'Moderate' || assessment.riskLevel === 'Localized' ? 'bg-yellow-100 text-yellow-800' :
                                assessment.riskLevel === 'High' || assessment.riskLevel === 'Very High' ? 'bg-orange-100 text-orange-800' :
                                assessment.riskLevel === 'Critical' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                                {assessment.riskLevel || 'N/A'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <Link href={`/results/${assessment._id}`} legacyBehavior>
                              <a className="text-indigo-600 hover:text-indigo-900">View Details</a>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Pagination for All User Assessments */}
                {allUserAssessmentsTotalPages > 1 && (
                  <div className="flex justify-center items-center mt-6 mb-8">
                    <button
                      onClick={() => fetchAllUserAssessments(Math.max(1, allUserAssessmentsCurrentPage - 1))}
                      disabled={allUserAssessmentsCurrentPage === 1 || loadingAllUserAssessments}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-l-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2 text-sm text-gray-700">
                      Page {allUserAssessmentsCurrentPage} of {allUserAssessmentsTotalPages}
                    </span>
                    <button
                      onClick={() => fetchAllUserAssessments(Math.min(allUserAssessmentsTotalPages, allUserAssessmentsCurrentPage + 1))}
                      disabled={allUserAssessmentsCurrentPage === allUserAssessmentsTotalPages || loadingAllUserAssessments}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-r-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        );
      case 'illnesses':
        // ... existing illnesses tab content ...
        return (
            <div>
                {/* ... existing illnesses tab JSX ... */}
            </div>
        );
      default:
        return null;
    }
  };

  // Main dashboard content for doctors
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Official Dashboard</h1>

      {renderTabs()}

      {renderContent()}
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