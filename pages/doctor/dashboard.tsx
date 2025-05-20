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
import { useServerStatus } from '../../contexts/ServerStatusContext';

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
type SortField = 'userId.email' | 'userId.name' | 'timestamp' | 'totalScore' | 'glaucomaScore' | 'cancerScore' | 'type' | 'createdAt';
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
      illnessType: string;
      minScore: string;
      riskLevel: string; // Changed from optional to required for consistency
  };
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
    initialSortField,
    initialSortOrder,
    initialIllnesses = [],
    error: initialError
}) => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { isServerOnline } = useServerStatus();
  
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
  const [minScoreFilter, setMinScoreFilter] = useState<string>(initialFilters?.minScore || '0');
  const [illnessTypeFilter, setIllnessTypeFilter] = useState<string>(initialFilters?.illnessType || '');
  const [riskLevelFilter, setRiskLevelFilter] = useState<string>(initialFilters?.riskLevel || ''); // New state

  // State for sorting
  const [sortField, setSortField] = useState<SortField | null>(initialSortField);
  const [sortOrder, setSortOrder] = useState<SortOrder | null>(initialSortOrder);

  // State for tab selection
  const [activeTab, setActiveTab] = useState<'assessments' | 'illnesses' | 'overview'>('overview'); // Removed 'allUserAssessments'
  const [trendGranularity, setTrendGranularity] = useState<'weekly' | 'monthly'>('weekly'); // New state for toggling
  
  // Additional state for combined assessments section
  const [showAllPatients, setShowAllPatients] = useState<boolean>(true);
  
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

  // Load assessments when component mounts
  // useEffect(() => { // THIS BLOCK IS COMMENTED OUT
  //   if (isServerOnline) { // THIS BLOCK IS COMMENTED OUT
  //     fetchAssessments(currentPage, filters, minScoreFilter, illnessTypeFilter, sortField, sortOrder); // THIS BLOCK IS COMMENTED OUT
  //   } // THIS BLOCK IS COMMENTED OUT
  // }, [isServerOnline]); // THIS BLOCK IS COMMENTED OUT

  // Updated function to fetch assessments based on current page, filters, AND SORTING
  const fetchAssessments = useCallback(async (
    pageArg: number, // Renamed to avoid conflict
    currentFilters: typeof filters,
    currentMinScoreFilter: string,
    currentIllnessTypeFilter: string,
    currentRiskLevelFilter: string, // Added riskLevelFilter
    currentSortField: SortField | null,
    currentSortOrder: SortOrder | null
  ) => {
    // Safeguard the page argument
    const page = (typeof pageArg === 'number' && !isNaN(pageArg) && pageArg > 0) ? pageArg : 1;

    if (!isServerOnline) {
      console.warn("Simulated server offline. Fetch filtered assessments aborted.");
      setError("Server connection is offline. Cannot load assessments with filters.");
      setLoading(false);
      return;
    }
        setLoading(true);
        setError(null);
    
    // Construct the query string
    const params = new URLSearchParams();
    params.append('page', page.toString()); // Now uses the safeguarded page
    params.append('limit', '256'); // Changed from 100 to 256
    
    // Add filter parameters
    if (currentFilters.userEmail) {
      params.append('userEmail', currentFilters.userEmail);
    }
    if (currentFilters.startDate) {
      params.append('startDate', currentFilters.startDate);
    }
    if (currentFilters.endDate) {
      params.append('endDate', currentFilters.endDate);
    }
    
    // Add min score filter
    if (currentMinScoreFilter && currentMinScoreFilter !== '0') {
      params.append('minScore', currentMinScoreFilter);
    }
    
    // Add illness type filter
    if (currentIllnessTypeFilter) {
      params.append('type', currentIllnessTypeFilter);
    }
    
    // Add risk level filter to API call
    if (currentRiskLevelFilter) {
      params.append('riskLevel', currentRiskLevelFilter);
    }
    
    // Add sorting parameters with improved handling
        if (currentSortField && currentSortOrder) {
      // For date fields, always use createdAt for consistency
      const fieldToSort = currentSortField === 'timestamp' ? 'createdAt' : currentSortField;
      params.append('sortField', fieldToSort);
      params.append('sortOrder', currentSortOrder);
      console.log(`Adding sort params: ${fieldToSort} ${currentSortOrder}`);
    }

    const queryString = `/api/assessments?${params.toString()}`;
    console.log("Fetching assessments with query:", queryString);

    try {
      const response = await fetch(queryString);
            if (!response.ok) {
        const errorData = await response.json().catch(() => ({})); // Catch if JSON parsing fails
        console.error("Failed to fetch assessments:", response.status, errorData);
        throw new Error(errorData.message || `Failed to fetch assessments: ${response.status}`);
            }
            const data = await response.json();
      if (data.assessments) {
            setAssessments(data.assessments);
            setTotalAssessments(data.totalAssessments);
            setTotalPages(data.totalPages);
        setCurrentPage(page);

        // Update user trends based on the fetched assessments
        if (data.assessments.length > 0 && selectedUserEmail) {
          const userInResults = data.assessments.find((assessment: PopulatedAssessment) => assessment.userId?.email === selectedUserEmail);
          if (userInResults) {
            // User is in results, no need to update trends
             } else {
                 setSelectedUserTrends({ glaucoma: [], cancer: [] });
          }
        }
      } else {
        setAssessments([]);
        setTotalAssessments(0);
        setTotalPages(1); // Reset to 1 page if no assessments
        setCurrentPage(1);
             }
        } catch (error: any) {
      console.error("Error fetching assessments:", error);
      setError(error.message || "An unknown error occurred");
        } finally {
            setLoading(false);
        }
  }, [isServerOnline, setError, setLoading, setAssessments, setTotalAssessments, setTotalPages, setCurrentPage, selectedUserEmail, setSelectedUserTrends]);

    // Fetch trends for a specific user
    const fetchUserTrends = async (userEmail: string) => {
      if (!userEmail) return;
      
      setLoadingUserTrends(true);
      setError(null); // Clear any previous errors
      
      try {
        const response = await fetch(`/api/results/me/trends?userEmail=${encodeURIComponent(userEmail)}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch user trends');
        }
        
        const data = await response.json();
        
        // Format the assessments into trend data
        const glaucomaTrends: { date: string; score: number }[] = [];
        const cancerTrends: { date: string; score: number }[] = [];
        
        // Process and sort assessments by date
        const assessments = data.assessments || [];
        
        // Sort assessments by date
        const sortedAssessments = [...assessments].sort((a, b) => {
          const dateA = new Date(a.createdAt || a.timestamp);
          const dateB = new Date(b.createdAt || b.timestamp);
          return dateA.getTime() - dateB.getTime();
        });
        
        // Extract user name from the first assessment if available
        if (sortedAssessments.length > 0 && sortedAssessments[0].userId) {
          const user = sortedAssessments[0].userId;
          if (typeof user.name === 'string') {
            setSelectedUserName(user.name);
          } else if (user.name) {
            setSelectedUserName(`${user.name.first || ''} ${user.name.last || ''}`.trim());
          } else {
            setSelectedUserName(userEmail);
          }
        } else {
          setSelectedUserName(userEmail);
        }
        
        // Group by assessment type
        sortedAssessments.forEach(assessment => {
          // Format date for display
          const date = formatDateTime(assessment.createdAt || assessment.timestamp).split(' ')[0]; // Just the date part
          
          if (assessment.type === 'glaucoma') {
            glaucomaTrends.push({
              date,
              score: assessment.totalScore ?? assessment.glaucomaScore ?? 0
            });
          } else if (assessment.type === 'cancer') {
            cancerTrends.push({
              date,
              score: assessment.totalScore ?? assessment.cancerScore ?? 0
            });
          }
        });
        
        setSelectedUserTrends({
          glaucoma: glaucomaTrends,
          cancer: cancerTrends
        });
      } catch (error: any) {
        console.error('Error fetching user trends:', error);
        setError(error.message || 'An error occurred while fetching user trends');
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
        riskFilter: string; // Added riskFilter
        sField: SortField | null;
        sOrder: SortOrder | null;
      }) => {
        setCurrentPage(1); // Always reset to page 1 for filter changes
        fetchAssessments(
          1, // page
          newFilterSettings.textFilters,
          newFilterSettings.scoreFilter,
          newFilterSettings.typeFilter,
          newFilterSettings.riskFilter, // Pass riskFilter
          newFilterSettings.sField,
          newFilterSettings.sOrder
        );
      }, 500),
      [fetchAssessments, setCurrentPage]
    );

    // Initial fetch on mount
    useEffect(() => {
        fetchAssessments(currentPage, filters, minScoreFilter, illnessTypeFilter, riskLevelFilter, sortField, sortOrder);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Include riskLevelFilter in dependencies if it can change independently of other filters here, but initial load should be fine.

    // Handle filter input changes
    const handleFilterInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        setFilterInput(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    // Apply filters and fetch data for page 1 with current sort and risk filter
    const applyFilters = () => {
      console.log("Applying filters:", filterInput, minScoreFilter, illnessTypeFilter, riskLevelFilter);
      
      // Update the filters state with current input values
         setFilters(filterInput); 
         setCurrentPage(1); 
      
      // Fetch assessments with the new filters
         fetchAssessments(1, filterInput, minScoreFilter, illnessTypeFilter, riskLevelFilter, sortField, sortOrder);
         
         // Also update user trend chart if user email is set
         if (filterInput.userEmail && filterInput.userEmail.trim() !== '') {
           fetchUserTrends(filterInput.userEmail);
         }
      
      // Update URL params for persistence
      const queryParams = new URLSearchParams();
      Object.entries(filterInput).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });
      if (minScoreFilter && minScoreFilter !== '0') queryParams.append('minScore', minScoreFilter);
      if (illnessTypeFilter) queryParams.append('type', illnessTypeFilter);
      if (riskLevelFilter) queryParams.append('riskLevel', riskLevelFilter); // Add to URL params
      if (sortField) queryParams.append('sortField', sortField);
      if (sortOrder) queryParams.append('sortOrder', sortOrder);
      
      router.push(
        { pathname: router.pathname, query: Object.fromEntries(queryParams) },
        undefined,
        { shallow: true }
      );
    };

     // Reset filters and fetch all data for page 1 with default sort (or current sort)
    const resetFilters = () => {
        const emptyFilters = { userEmail: '', startDate: '', endDate: '', illnessType: '', minScore: '0', riskLevel: '' }; // Added riskLevel
      
      // Reset all filter states
        setFilterInput(emptyFilters);
        setFilters(emptyFilters);
        setMinScoreFilter('0');
        setIllnessTypeFilter('');
        setRiskLevelFilter(''); // Reset risk level filter
        setSortField(null);
        setSortOrder(null);
        setCurrentPage(1); 
      
      // Fetch data with reset filters
        fetchAssessments(1, emptyFilters, '0', '', '', null, null); // Pass empty riskLevelFilter
        
        // Clear user trends when filters are reset
        setSelectedUserEmail('');
        setSelectedUserName('');
        setSelectedUserTrends({ glaucoma: [], cancer: [] });
      
      // Update URL to remove filter params
      router.push(router.pathname, undefined, { shallow: true });
    };

    // New handler for universal min score slider
    const handleMinScoreFilterChange = (e: ChangeEvent<HTMLInputElement>) => {
      const newMinScore = e.target.value;
      setMinScoreFilter(newMinScore);
      
      // Use debounced fetch to prevent too many requests while sliding
      debouncedRefetchAssessments({
        textFilters: filters, // Use current committed text/date filters
        scoreFilter: newMinScore, // Use the new score from slider
        typeFilter: illnessTypeFilter, // Use current illness type filter from state
        riskFilter: riskLevelFilter, // Pass current riskLevelFilter
        sField: sortField,
        sOrder: sortOrder,
      });
    };

    // Handler for illness type filter
    const handleIllnessTypeFilterChange = (e: ChangeEvent<HTMLSelectElement>) => {
      const newIllnessType = e.target.value;
      setIllnessTypeFilter(newIllnessType);
      
      // Fetch assessments with the new illness type filter
      fetchAssessments(
        currentPage, // Or 1 if filters should reset page
        filters,
        minScoreFilter,
        newIllnessType,
        riskLevelFilter, // Pass current riskLevelFilter
        sortField,
        sortOrder
      );
    };

    // Handler for Risk Level Filter Change (New)
    const handleRiskLevelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newRiskLevel = e.target.value;
      setRiskLevelFilter(newRiskLevel);
      setCurrentPage(1); // Reset to page 1 when risk level filter changes
      fetchAssessments(
        1,
        filters, 
        minScoreFilter, 
        illnessTypeFilter, 
        newRiskLevel, // Use new value
        sortField, 
        sortOrder
      );
      // Also update URL params (similar to applyFilters)
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && key !== 'riskLevel') queryParams.append(key, value as string);
      });
      if (minScoreFilter && minScoreFilter !== '0') queryParams.append('minScore', minScoreFilter);
      if (illnessTypeFilter) queryParams.append('type', illnessTypeFilter);
      if (newRiskLevel) queryParams.append('riskLevel', newRiskLevel);
      if (sortField) queryParams.append('sortField', sortField);
      if (sortOrder) queryParams.append('sortOrder', sortOrder);
      queryParams.append('page', '1');
      router.push({ pathname: router.pathname, query: Object.fromEntries(queryParams) }, undefined, { shallow: true });
    };

    // Handle pagination clicks
    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) {
            fetchAssessments(newPage, filters, minScoreFilter, illnessTypeFilter, riskLevelFilter, sortField, sortOrder);
        }
    };
    
    // Handle sort clicks
    const handleSort = (field: SortField) => {
        // If clicking the same field, toggle order, otherwise set to desc by default
        const newOrder = sortField === field && sortOrder === 'desc' ? 'asc' : 'desc';
        setSortField(field);
        setSortOrder(newOrder);
        
        // For scores, default to desc (highest first) when first clicked
        const sortOrderToUse = field !== sortField && 
          (field === 'totalScore' || field === 'glaucomaScore' || field === 'cancerScore')
          ? 'desc' 
          : newOrder;
        
        if (field !== sortField && 
          (field === 'totalScore' || field === 'glaucomaScore' || field === 'cancerScore')) {
          setSortOrder(sortOrderToUse);
        }
        
        // Fetch assessments with new sort params (directly call fetchAssessments)
        setCurrentPage(1); // Reset to first page on sort
        fetchAssessments(1, filters, minScoreFilter, illnessTypeFilter, riskLevelFilter, field, sortOrderToUse);
        
        // Update URL
        const queryParams = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value) queryParams.append(key, value);
        });
        if (minScoreFilter && minScoreFilter !== '0') queryParams.append('minScore', minScoreFilter);
        if (illnessTypeFilter) queryParams.append('type', illnessTypeFilter);
        if (riskLevelFilter) queryParams.append('riskLevel', riskLevelFilter); // Add to URL params
        queryParams.append('sortField', field);
        queryParams.append('sortOrder', sortOrderToUse);
        queryParams.append('page', '1');
        
        router.push(
          { pathname: router.pathname, query: Object.fromEntries(queryParams) },
          undefined,
          { shallow: true }
        );
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
      
      // Validate form data
      if (!questionForm.questionId || !questionForm.text) {
        throw new Error('Question ID and text are required');
      }
      
      if (questionForm.weight <= 0) {
        throw new Error('Weight must be greater than 0');
      }
      
      const method = editingQuestion?._id ? 'PUT' : 'POST';
      const url = editingQuestion?._id 
        ? `/api/illnesses/${selectedIllness}/questions/${editingQuestion._id}` 
        : `/api/illnesses/${selectedIllness}/questions`;
      
      // Show loader
      setLoadingQuestions(true);
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...questionForm,
          type: selectedIllness // Include the illness type for proper API handling
        }),
      });
      
      // Clear any previous error
      setError(null);
      
      // Process the response
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Error saving question' }));
        console.error('Failed to save question:', response.status, errorData);
        throw new Error(errorData.message || `Failed to save question: ${response.status}`);
      }
      
      // Success handling
      await fetchQuestionsForIllness(selectedIllness);
      setShowQuestionForm(false);
      setEditingQuestion(null);
      setQuestionForm({
        questionId: '',
        text: '',
        weight: 1.0,
        autoPopulate: false,
        autoPopulateFrom: ''
      });
      
    } catch (error: any) {
      console.error('Error saving question:', error);
      setError(error.message || 'Failed to save question');
    } finally {
      setLoadingQuestions(false);
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
        {(['overview', 'assessments', 'illnesses'] as const).map((tabKey) => ( // Removed 'allUserAssessments'
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
            {tabKey === 'assessments' && 'Patient Assessments'} {/* Renamed to just "Patient Assessments" */}
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
        return (
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Global Health Trends</h2>
            
            {/* Trend Granularity Toggle - Assuming you might have one */}
            <div className="mb-4 flex justify-end">
                     <button
                onClick={() => setTrendGranularity('weekly')} 
                className={`px-3 py-1 mr-2 text-sm rounded-md ${trendGranularity === 'weekly' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
                Weekly Trends
                    </button>
                    <button
                onClick={() => setTrendGranularity('monthly')} 
                className={`px-3 py-1 text-sm rounded-md ${trendGranularity === 'monthly' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
                Monthly Trends
                    </button>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {trendGranularity === 'weekly' ? (
                  <AssessmentTrendsChart />
              ) : (
                  <MonthlyAssessmentTrendsChart />
              )}
              <IllnessDistributionChart />
            </div>

            {/* User-specific trends section */}
            <div className="mt-10 mb-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Patient-Specific Trends</h3>
              
              <div className="mb-4">
                <label htmlFor="userEmailTrends" className="block text-sm font-medium text-gray-700 mb-1">
                  Search user by email:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="userEmailTrends"
                    value={selectedUserEmail}
                    onChange={(e) => setSelectedUserEmail(e.target.value)}
                    className="flex-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    placeholder="Enter user email"
                  />
                  <button
                    onClick={() => selectedUserEmail && fetchUserTrends(selectedUserEmail)}
                    disabled={loadingUserTrends || !selectedUserEmail}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {loadingUserTrends ? 'Loading...' : 'View Trends'}
                  </button>
                </div>
              </div>
              
              {loadingUserTrends && (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
                  <p className="ml-2 text-gray-600">Loading user trends...</p>
                </div>
              )}
              
              {!loadingUserTrends && selectedUserName && (
                <div className="mb-4">
                  <h4 className="text-lg font-medium text-gray-800">
                    Trends for {selectedUserName}
                  </h4>
                </div>
              )}
              
              {!loadingUserTrends && selectedUserTrends.glaucoma.length === 0 && selectedUserTrends.cancer.length === 0 && selectedUserEmail && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm text-yellow-700">
                        No assessment data found for this user.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {!loadingUserTrends && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {selectedUserTrends.glaucoma.length > 0 && (
                    <UserTrendChart 
                      data={selectedUserTrends.glaucoma} 
                      title="Glaucoma Risk Trend" 
                      color="#28a745" 
                    />
                  )}
                  
                  {selectedUserTrends.cancer.length > 0 && (
                    <UserTrendChart 
                      data={selectedUserTrends.cancer} 
                      title="Cancer Risk Trend" 
                      color="#e83e8c" 
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        );
      case 'assessments':
        return (
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Patient Assessments</h2>
            
            {/* Search and Filters */}
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                    <label htmlFor="userEmail" className="block text-sm font-medium text-gray-700 mb-1">
                    User Email
                    </label>
                    <input
                    type="text"
                        id="userEmail"
                        name="userEmail"
                        value={filterInput.userEmail}
                        onChange={handleFilterInputChange}
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    placeholder="Filter by email"
                    />
                </div>
                
                <div>
                    <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                    </label>
                    <input
                        type="date"
                        id="startDate"
                        name="startDate"
                        value={filterInput.startDate}
                        onChange={handleFilterInputChange}
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    />
                </div>
                
                <div>
                    <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                    </label>
                    <input
                        type="date"
                        id="endDate"
                        name="endDate"
                        value={filterInput.endDate}
                        onChange={handleFilterInputChange}
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    />
                </div>
            </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                 <div>
                  <label htmlFor="illnessType" className="block text-sm font-medium text-gray-700 mb-1">
                    Illness Type
                  </label>
                  <select
                    id="illnessType"
                    value={illnessTypeFilter}
                    onChange={handleIllnessTypeFilterChange}
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  >
                    <option value="">All Types</option>
                    <option value="glaucoma">Glaucoma</option>
                    <option value="cancer">Cancer</option>
                  </select>
                </div>

                {/* New Risk Level Filter Dropdown */}
                <div>
                  <label htmlFor="riskLevelFilter" className="block text-sm font-medium text-gray-700 mb-1">
                    Risk Level
                  </label>
                  <select
                    id="riskLevelFilter"
                    value={riskLevelFilter}
                    onChange={handleRiskLevelChange} // Use the new handler
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  >
                    <option value="">All Levels</option>
                    <optgroup label="General Risk Levels">
                      <option value="Low risk">Low risk</option>
                      <option value="Moderate risk">Moderate risk</option>
                      <option value="High risk">High risk</option>
                      <option value="Very high risk">Very high risk</option>
                    </optgroup>
                    <optgroup label="Glaucoma-Specific">
                      <option value="Critical / Acute risk">Critical / Acute risk</option>
                    </optgroup>
                    <optgroup label="Cancer-Specific">
                      <option value="Localized disease likely">Localized disease likely</option>
                    </optgroup>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="minScore" className="block text-sm font-medium text-gray-700 mb-1">
                    Minimum Score: {minScoreFilter}
                  </label>
            <input
              type="range"
                    id="minScore"
              min="0"
              max="10"
                    step="0.5"
              value={minScoreFilter} 
              onChange={handleMinScoreFilterChange} 
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
                </div>
                </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={resetFilters}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Reset Filters
                </button>
                
                     <button
                        onClick={applyFilters}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                        Apply Filters
                    </button>
              </div>
            </div>
            
            {/* <<<< START OF DUPLICATED TOGGLE >>>> */}
            {/* View Selector - New toggle to select between filtered and all assessments */}
            <div className="flex justify-end mb-4">
              <div className="inline-flex rounded-md shadow-sm">
                    <button
                  onClick={() => fetchAssessments(1, filters, minScoreFilter, illnessTypeFilter, riskLevelFilter, sortField, sortOrder)} // Should ideally fetch with cleared userEmail or a specific flag
                  className={`relative inline-flex items-center px-4 py-2 rounded-l-md border border-gray-300 text-sm font-medium ${
                    !filterInput.userEmail ? 'bg-indigo-50 text-indigo-700' : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  All Patients
                </button>
                <button
                  onClick={() => applyFilters()} // This applies current filters including userEmail
                  className={`relative inline-flex items-center px-4 py-2 rounded-r-md border border-gray-300 text-sm font-medium ${
                    filterInput.userEmail ? 'bg-indigo-50 text-indigo-700' : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Filtered View
                    </button>
                </div>
             </div>
            {/* <<<< END OF DUPLICATED TOGGLE >>>> */}

            {/* <<<< START OF DUPLICATED PAGINATION CONTROLS >>>> */}
            {!loading && !error && assessments.length > 0 && totalPages > 1 && (
              <div className="flex justify-center items-center mt-0 mb-4"> {/* Adjusted margins */}
                <button
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1 || loading}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-l-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                  </span>
            <button 
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages || loading}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-r-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                  Next
            </button>
        </div>
            )}
            {/* <<<< END OF DUPLICATED PAGINATION CONTROLS >>>> */}

            {/* Loading state */}
            {loading && (
              <div className="flex justify-center items-center py-10">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
                <p className="ml-4 text-gray-600">Loading assessments...</p>
      </div>
        )}

            {/* Error state */}
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                <strong className="font-bold">Error: </strong>
                <span className="block sm:inline">{error}</span>
        </div>
      )}
            
            {/* No results state */}
            {!loading && !error && assessments.length === 0 && (
              <div className="bg-white p-10 text-center rounded-lg shadow">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No assessments found</h3>
                <p className="mt-1 text-sm text-gray-500">Try changing your search criteria or clearing filters.</p>
                <div className="mt-6">
                  <button
                    onClick={resetFilters}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Clear All Filters
                  </button>
              </div>
                      </div>
                    )}
                    
            {/* Results table */}
            {!loading && !error && assessments.length > 0 && (
              <>
                <div className="overflow-x-auto bg-white shadow rounded-lg mb-6">
            <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => handleSort('userId.name')}
                        >
                          <div className="flex items-center">
                            User Name 
                       {sortField === 'userId.name' && (
                              <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                       )}
                          </div>
                   </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => handleSort('userId.email')}
                        >
                          <div className="flex items-center">
                            User Email
                            {sortField === 'userId.email' && (
                              <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                   </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => handleSort('type')}
                        >
                          <div className="flex items-center">
                            Type
                            {sortField === 'type' && (
                              <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                   </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => handleSort('timestamp')}
                        >
                          <div className="flex items-center">
                            Date
                            {sortField === 'timestamp' && (
                              <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                   </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                          onClick={() => handleSort('totalScore')}
                        >
                          <div className="flex items-center">
                            Score
                            {sortField === 'totalScore' && (
                              <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                   </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Risk Level
                   </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Actions
                   </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {assessments.map((assessment) => (
                        <tr key={assessment._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {assessment.userId ? (typeof assessment.userId.name === 'string' ? assessment.userId.name : `${assessment.userId.name?.first || ''} ${assessment.userId.name?.last || ''}`.trim()) : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex items-center">
                        {assessment.userId?.email || 'N/A'}
                              {assessment.userId?.email && (
                                <button 
                                  onClick={() => {
                                    if (assessment.userId && assessment.userId.email) {
                                      setSelectedUserEmail(assessment.userId.email);
                                      fetchUserTrends(assessment.userId.email);
                                      setActiveTab('overview');
                                    }
                                  }}
                                  className="ml-2 text-indigo-600 hover:text-indigo-800"
                                  title="View patient trends"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                  </svg>
                                </button>
                              )}
                            </div>
                     </td>
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

                {/* Pagination */}
             {totalPages > 1 && (
                  <div className="flex justify-center items-center mt-6 mb-8">
                        <button
                      onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1 || loading}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-l-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                        >
                            Previous
                        </button>
                    <span className="px-4 py-2 text-sm text-gray-700">
                      Page {currentPage} of {totalPages}
                    </span>
                        <button
                      onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages || loading}
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
        return (
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 mb-6">Manage Illnesses & Questions</h2>
            
            {/* Error message */}
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                <strong className="font-bold">Error: </strong>
                <span className="block sm:inline">{error}</span>
          </div>
        )}

            {/* Illness Selector */}
            <div className="bg-white p-6 rounded-lg shadow-md mb-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                <div className="mb-4 md:mb-0 md:w-1/2">
                  <label htmlFor="illnessSelector" className="block text-sm font-medium text-gray-700 mb-1">
                    Select Illness to Manage
                  </label>
                  <select
                    id="illnessSelector"
                    value={selectedIllness || ''}
                    onChange={(e) => {
                      const type = e.target.value;
                      setSelectedIllness(type || null);
                      if (type) {
                        fetchQuestionsForIllness(type);
                      } else {
                        setIllnessQuestions([]);
                      }
                    }}
                    className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  >
                    <option value="">Select an illness</option>
                    {illnesses.map((illness) => (
                      <option key={illness.type} value={illness.type}>
                        {illness.name} ({illness.type})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="md:flex md:space-x-3">
                  <button
                    onClick={() => setShowNewIllnessForm(true)}
                    className="w-full md:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add New Illness
                  </button>
                  
                  {selectedIllness && (
                    <>
              <button
                onClick={() => {
                          const illness = illnesses.find(i => i.type === selectedIllness);
                          if (illness) {
                            setEditingIllness(illness);
                            setEditIllnessFormData({
                              name: illness.name,
                              description: illness.description || ''
                            });
                            setShowEditIllnessForm(true);
                          }
                        }}
                        className="mt-3 md:mt-0 w-full md:w-auto inline-flex items-center justify-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit Illness
              </button>
                      
                      <button
                        onClick={() => handleDeleteIllness(selectedIllness)}
                        className="mt-3 md:mt-0 w-full md:w-auto inline-flex items-center justify-center px-4 py-2 border border-red-300 shadow-sm text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete Illness
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Questions Section - Add this section */}
            {selectedIllness && (
              <div className="bg-white p-6 rounded-lg shadow-md mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Questions for {illnesses.find(i => i.type === selectedIllness)?.name || selectedIllness}
                  </h3>
                  <button
                    onClick={() => {
                      setQuestionForm({
                        questionId: '',
                        text: '',
                        weight: 1.0,
                        autoPopulate: false,
                        autoPopulateFrom: ''
                      });
                      setEditingQuestion(null);
                      setShowQuestionForm(true);
                    }}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Question
                  </button>
                  </div>
                
                {loadingQuestions ? (
                  <div className="flex justify-center items-center py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
                    <p className="ml-2 text-gray-600">Loading questions...</p>
                  </div>
                ) : illnessQuestions.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded">
                    <p className="text-gray-500">No questions added yet for this illness.</p>
                    <button
                      onClick={() => {
                        setQuestionForm({
                          questionId: '',
                          text: '',
                          weight: 1.0,
                          autoPopulate: false,
                          autoPopulateFrom: ''
                        });
                        setEditingQuestion(null);
                        setShowQuestionForm(true);
                      }}
                      className="mt-2 inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none"
                    >
                      Add Your First Question
                    </button>
                </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Question ID
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Question Text
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Weight
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Auto Populate
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {illnessQuestions.map((question) => (
                          <tr key={question._id || question.questionId} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {question.questionId}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {question.text.length > 50 ? `${question.text.substring(0, 50)}...` : question.text}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {question.weight.toFixed(1)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {question.autoPopulate ? 
                                <span className="text-green-600">Yes - {question.autoPopulateFrom}</span> : 
                                <span className="text-gray-400">No</span>
                              }
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <button
                    onClick={() => {
                                  setEditingQuestion(question);
                                  setQuestionForm({
                                    questionId: question.questionId,
                                    text: question.text,
                                    weight: question.weight,
                                    autoPopulate: question.autoPopulate || false,
                                    autoPopulateFrom: question.autoPopulateFrom || '',
                                    _id: question._id
                                  });
                                  setShowQuestionForm(true);
                                }}
                                className="text-indigo-600 hover:text-indigo-900 mr-4"
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
                )}
              </div>
            )}

            {/* Add Illness Form */}
            {showNewIllnessForm && (
              <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                <div className="bg-white rounded-lg p-6 max-w-lg w-full">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Illness</h3>
                  <div className="space-y-4">
                  <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                        Illness Name*
                    </label>
                    <input
                      type="text"
                        id="name"
                      value={newIllness.name}
                      onChange={(e) => setNewIllness({ ...newIllness, name: e.target.value })}
                        className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        placeholder="e.g., Diabetes Mellitus"
                    />
                  </div>
                  <div>
                      <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                        Type* (used in URLs, no spaces, lowercase)
                    </label>
                    <input
                      type="text"
                        id="type"
                      value={newIllness.type}
                        onChange={(e) => setNewIllness({ ...newIllness, type: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                        className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        placeholder="e.g., diabetes"
                    />
                      <p className="mt-1 text-xs text-gray-500">Use only lowercase letters, numbers, and hyphens. This will be used in URLs.</p>
                  </div>
                    <div>
                      <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <textarea
                        id="description"
                      value={newIllness.description}
                      onChange={(e) => setNewIllness({ ...newIllness, description: e.target.value })}
                      rows={3}
                        className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        placeholder="Brief description of the illness..."
                      />
                  </div>
                </div>
                  <div className="mt-5 sm:mt-6 space-x-2 flex justify-end">
                  <button
                      type="button"
                      onClick={() => {
                        setShowNewIllnessForm(false);
                        setNewIllness({ name: '', type: '', description: '' });
                      }}
                      className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none"
                  >
                    Cancel
                  </button>
                  <button
                      type="button"
                    onClick={handleAddIllness}
                      disabled={loadingIllnesses || !newIllness.name || !newIllness.type}
                      className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none disabled:opacity-50"
                  >
                      {loadingIllnesses ? 'Adding...' : 'Add Illness'}
                  </button>
                  </div>
                </div>
              </div>
            )}

            {/* Edit Illness Form */}
            {showEditIllnessForm && editingIllness && (
              <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                <div className="bg-white rounded-lg p-6 max-w-lg w-full">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Illness: {editingIllness.name}</h3>
                  <p className="text-sm text-gray-500 mb-4">Type: {editingIllness.type} (cannot be changed)</p>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700">
                        Illness Name*
                      </label>
                      <input
                        type="text"
                        id="edit-name"
                        value={editIllnessFormData.name}
                        onChange={(e) => setEditIllnessFormData({...editIllnessFormData, name: e.target.value})}
                        className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      />
                  </div>
                    <div>
                      <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700">
                        Description
                      </label>
                      <textarea
                        id="edit-description"
                        value={editIllnessFormData.description}
                        onChange={(e) => setEditIllnessFormData({...editIllnessFormData, description: e.target.value})}
                        rows={3}
                        className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      />
                  </div>
                              </div>
                  <div className="mt-5 sm:mt-6 space-x-2 flex justify-end">
                              <button 
                      type="button"
                                onClick={() => { 
                        setShowEditIllnessForm(false);
                        setEditingIllness(null);
                        setEditIllnessFormData({ name: '', description: '' });
                      }}
                      className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none"
                    >
                      Cancel
                              </button>
                              <button 
                      type="button"
                      onClick={handleUpdateIllness}
                      disabled={loadingIllnesses || !editIllnessFormData.name}
                      className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none disabled:opacity-50"
                    >
                      {loadingIllnesses ? 'Saving...' : 'Save Changes'}
                              </button>
                            </div>
                          </div>
                  </div>
                )}

                {/* Add/Edit Question Form */}
                {showQuestionForm && selectedIllness && (
              <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                <div className="bg-white rounded-lg p-6 max-w-lg w-full">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {editingQuestion ? 'Edit Question' : 'Add New Question'}
                  </h3>
                  <div className="space-y-4">
                      <div>
                      <label htmlFor="questionId" className="block text-sm font-medium text-gray-700">
                        Question ID*
                        </label>
                        <input
                          type="text"
                          id="questionId"
                          value={questionForm.questionId}
                        onChange={(e) => setQuestionForm({...questionForm, questionId: e.target.value})}
                        className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                        disabled={!!editingQuestion} // Can't change ID if editing
                        />
                      {editingQuestion && (
                        <p className="mt-1 text-xs text-gray-500">Question ID cannot be changed once created.</p>
                      )}
                      </div>
                      <div>
                      <label htmlFor="questionText" className="block text-sm font-medium text-gray-700">
                        Question Text*
                      </label>
                      <textarea
                        id="questionText"
                        value={questionForm.text}
                        onChange={(e) => setQuestionForm({...questionForm, text: e.target.value})}
                        rows={3}
                        className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label htmlFor="weight" className="block text-sm font-medium text-gray-700">
                        Weight*
                        </label>
                        <input
                          type="number"
                          id="weight"
                        value={questionForm.weight}
                        onChange={(e) => setQuestionForm({...questionForm, weight: parseFloat(e.target.value)})}
                        className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          step="0.1"
                          min="0.1"
                        />
                      <p className="mt-1 text-xs text-gray-500">Higher weight means the question has more impact on the final score.</p>
                      </div>
                    <div className="flex items-start">
                      <div className="flex items-center h-5">
                          <input
                            id="autoPopulate"
                          type="checkbox"
                          checked={questionForm.autoPopulate}
                          onChange={(e) => setQuestionForm({...questionForm, autoPopulate: e.target.checked})}
                          className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <label htmlFor="autoPopulate" className="font-medium text-gray-700">
                          Auto-populate from previous assessments
                          </label>
                        <p className="text-gray-500">Enable if this question can use data from previous assessments.</p>
                      </div>
                        </div>
                        {questionForm.autoPopulate && (
                      <div>
                        <label htmlFor="autoPopulateFrom" className="block text-sm font-medium text-gray-700">
                          Source Question ID
                            </label>
                        <input
                          type="text"
                              id="autoPopulateFrom"
                          value={questionForm.autoPopulateFrom}
                          onChange={(e) => setQuestionForm({...questionForm, autoPopulateFrom: e.target.value})}
                          className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          placeholder="Question ID to pull data from"
                        />
                          </div>
                        )}
                      </div>
                  <div className="mt-5 sm:mt-6 space-x-2 flex justify-end">
                      <button
                      type="button"
                        onClick={() => {
                          setShowQuestionForm(false);
                          setEditingQuestion(null);
                        setQuestionForm({
                          questionId: '',
                          text: '',
                          weight: 1.0,
                          autoPopulate: false,
                          autoPopulateFrom: ''
                        });
                      }}
                      className="inline-flex justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none"
                      >
                        Cancel
                      </button>
                      <button
                      type="button"
                        onClick={handleSaveQuestion}
                      disabled={loadingQuestions || !questionForm.questionId || !questionForm.text}
                      className="inline-flex justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none disabled:opacity-50"
                      >
                      {loadingQuestions ? 'Saving...' : (editingQuestion ? 'Update Question' : 'Add Question')}
                      </button>
                    </div>
                  </div>
                    </div>
            )}
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
    const limit = 256; // Changed from 100 to 256
    const userEmail = context.query.userEmail as string || '';
    const startDate = context.query.startDate as string || '';
    const endDate = context.query.endDate as string || '';
    const initialMinScore = context.query.minScore as string || '0';
    const initialIllnessType = context.query.type as string || '';
    const initialRiskLevel = context.query.riskLevel as string || ''; // Added

    // Added support for sort query params
    const initialSortField = context.query.sortField as SortField || null;
    const initialSortOrder = context.query.sortOrder as SortOrder || null;

    const initialFilters = { 
      userEmail, 
      startDate, 
      endDate, 
      illnessType: initialIllnessType || '', 
      minScore: initialMinScore || '0', 
      riskLevel: initialRiskLevel || '' // Added
    };

     const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
        });
        if (userEmail) params.set('userEmail', userEmail);
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        if (initialMinScore !== '0') params.set('minScore', initialMinScore);
        if (initialIllnessType) params.set('type', initialIllnessType);
        if (initialRiskLevel) params.set('riskLevel', initialRiskLevel); // Added
        
        // Add sort params to API request if available
        if (initialSortField) {
            const fieldToSort = initialSortField === 'timestamp' ? 'createdAt' : initialSortField;
            params.set('sortField', fieldToSort);
        }
        if (initialSortOrder) {
            params.set('sortOrder', initialSortOrder);
        }

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
                initialFilters: {
                  ...initialFilters,
                  minScore: initialMinScore || '0',
                  illnessType: initialIllnessType || '',
                  riskLevel: initialRiskLevel || '' // Added
                }, 
                initialSortField,
                initialSortOrder,
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
                currentPage: Number(data.currentPage) || 1,
                initialFilters,
                initialSortField,
                initialSortOrder,
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
             initialFilters: {
               ...initialFilters,
               minScore: initialMinScore || '0',
               illnessType: initialIllnessType || '',
               riskLevel: initialRiskLevel || '' // Added
             }, 
             initialSortField,
             initialSortOrder,
             initialIllnesses,
             error: error.message || 'Server error fetching assessments.' 
           } 
         };
    }
};

export default DoctorDashboard; 