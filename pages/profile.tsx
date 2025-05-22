import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSession, SessionProvider } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import type { IAssessment } from '../models/Assessment';
import UserProfileForm from '../components/UserProfileForm';
import CardViewer from '../components/CardViewer';
import { ICard } from '@/models/Card';
import { IUser } from '../models/User';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { downloadComponentAsPdf } from '../utils/downloadAsPdf';
import type { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from './api/auth/[...nextauth]';
import { useServerStatus } from '../contexts/ServerStatusContext';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// This is a wrapper component that disables auto-refresh of session for this page
const ProfilePageWrapper = ({ session }: { session: any }) => {
  return (
    <SessionProvider 
      session={session} 
      refetchInterval={5 * 60} // Refresh session every 5 minutes
      refetchOnWindowFocus={true}
    >
      <ProfilePage />
    </SessionProvider>
  );
};

// Server-side props to authenticate and pass session to wrapper
export const getServerSideProps: GetServerSideProps = async (context) => {
  try {
    const session = await getServerSession(context.req, context.res, authOptions);

    if (!session) {
      console.log("[profile] Server: No session found, redirecting to login");
      return {
        redirect: {
          destination: '/login?callbackUrl=/profile',
          permanent: false,
        }
      };
    }

    // Ensure session is properly serialized
    const serializedSession = JSON.parse(JSON.stringify(session));
    
    return {
      props: { 
        session: serializedSession
      },
    };
  } catch (error) {
    console.error("[profile] Server: Error in getServerSideProps:", error);
    return {
      redirect: {
        destination: '/login?callbackUrl=/profile&error=server_error',
        permanent: false,
      }
    };
  }
};

const ProfilePage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { isServerOnline } = useServerStatus();
  const [assessments, setAssessments] = useState<IAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [userData, setUserData] = useState<Partial<IUser>>({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [loadingUserData, setLoadingUserData] = useState(true);
  const [latestCard, setLatestCard] = useState<ICard | null>(null);
  const [latestScores, setLatestScores] = useState<{
    glaucoma?: number;
    cancer?: number;
  }>({});
  const [scoresChanged, setScoresChanged] = useState(false);
  const [assessmentHistory, setAssessmentHistory] = useState<{
    glaucoma: { date: string; score: number }[];
    cancer: { date: string; score: number }[];
  }>({
    glaucoma: [],
    cancer: []
  });
  
  const cardRef = useRef<HTMLDivElement>(null);
  const [loadingCard, setLoadingCard] = useState(false);

  // Add these refs for tracking fetch status
  const hasTriedFetchingCard = useRef(false);
  const hasTriedFetchingAssessments = useRef(false);
  const isInitialFetch = useRef(false);
  const prevPage = useRef(1);
  const hasInitiatedFirstFetch = useRef(false);

  // Get the base URL for the QR code
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  // Format functions
  const formatDateShort = useCallback((dateString: string) => {
    try {
      const date = new Date(dateString);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'N/A';
      }
      return date.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric',
      });
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return 'N/A';
    }
  }, []);

  const formatDate = useCallback((dateString: string) => {
    try {
      const date = new Date(dateString);
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'N/A';
      }
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return 'N/A';
    }
  }, []);

  // Generate new card
  const generateNewCard = useCallback(async () => {
    if (!isServerOnline) {
      console.warn("Simulated server offline. Card generation aborted.");
      setError('Server connection is offline. Cannot generate new card.');
      return;
    }
    try {
      const res = await fetch('/api/cards', { method: 'POST' });
      if (res.ok) {
        const { card: newCard } = await res.json();
        setLatestCard(newCard);
      }
    } catch (err) {
      console.error('Error generating card:', err);
    }
  }, [isServerOnline, setError, setLatestCard]);

  // Fetch user data
  const fetchUserData = useCallback(async () => {
    if (!isServerOnline) {
      console.warn("Simulated server offline. User data fetch aborted.");
      setError("Server connection is offline. Cannot fetch user data.");
      setLoadingUserData(false);
      return;
    }
    setLoadingUserData(true);
    setError(null); // Clear any previous errors
    try {
      const response = await fetch('/api/users/me');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to fetch user data:', response.status, errorData);
        throw new Error(`Failed to fetch user data: ${response.status}`);
      }
      const data = await response.json();
      if (data.user) {
        setUserData(data.user || {});
      } else {
        throw new Error('No user data received from server');
      }
    } catch (err: any) {
      console.error('Error fetching user data:', err.message);
      setError(`Error loading profile: ${err.message}`);
    } finally {
      setLoadingUserData(false);
    }
  }, [isServerOnline, setError, setUserData, setLoadingUserData]);

  // Fetch latest card
  const fetchLatestCard = useCallback(async (force = false) => {
    if (!isServerOnline) {
      console.warn("Simulated server offline. Card fetch aborted.");
      setLoadingCard(false);
      setError('Server connection is offline. Cannot fetch card data.');
      return;
    }
    if ((hasTriedFetchingCard.current && !force)) return;
    
    try {
      setLoadingCard(true);
      const cardRes = await fetch('/api/cards/me');
      if (cardRes.ok) {
        const cardData = await cardRes.json();
        if (cardData.cards && cardData.cards.length > 0) {
          setLatestCard(cardData.cards[0]);
        } else {
          if (latestScores.glaucoma !== undefined || latestScores.cancer !== undefined) {
            generateNewCard();
          }
        }
      }
      hasTriedFetchingCard.current = true;
    } catch (err) {
      console.error('Error fetching card data:', err);
    } finally {
      setLoadingCard(false);
    }
  }, [isServerOnline, latestScores, generateNewCard, setError, setLatestCard, setLoadingCard, hasTriedFetchingCard]);

  // Update latest scores
  const updateLatestScores = useCallback((assessmentsToUpdate: IAssessment[]) => {
    if (!assessmentsToUpdate || assessmentsToUpdate.length === 0) return;
    
    const glaucomaAssessment = assessmentsToUpdate
      .filter(a => a.type === 'glaucoma')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    
    const cancerAssessment = assessmentsToUpdate
      .filter(a => a.type === 'cancer')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    
    const newScores = {
      glaucoma: glaucomaAssessment?.totalScore,
      cancer: cancerAssessment?.totalScore
    };
    
    setLatestScores(prevScores => {
        if (newScores.glaucoma !== prevScores.glaucoma || newScores.cancer !== prevScores.cancer) {
            setScoresChanged(true);
            return newScores;
        }
        return prevScores;
    });
  }, []);

  // Fetch assessment history
  const fetchAssessmentHistory = useCallback(async (page: number, force = false) => {
    if (!isServerOnline) {
      console.warn("Simulated server offline. Assessment history fetch aborted.");
      setError("Server connection is offline. Cannot fetch assessment history.");
      setLoading(false);
      return;
    }
    if ((!force && hasTriedFetchingAssessments.current && currentPage === page)) {
      console.log('fetchAssessmentHistory: Concurrent or redundant fetch prevented.');
      return;
    }
    
    setLoading(true);
    setError(null);
    hasTriedFetchingAssessments.current = true;
    
    try {
      const fetchUrl = `/api/results/me/assessments?page=${page}&limit=20`;
      console.log(`fetchAssessmentHistory: Attempting to fetch from ${fetchUrl}`);
      const response = await fetch(fetchUrl);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to fetch assessment history:', response.status, errorData);
        throw new Error(`Failed to fetch assessment history: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data && data.assessments) {
        setAssessments(data.assessments || []);
        setTotalPages(data.totalPages || 1);
        setCurrentPage(data.currentPage);
        updateLatestScores(data.assessments || []);
      }
    } catch (err: any) {
      console.error('Error in fetchAssessmentHistory:', err);
      setError(err.message || 'Failed to load assessment history');
    } finally {
      setLoading(false);
    }
  }, [isServerOnline, updateLatestScores, setError, setLoading, hasTriedFetchingAssessments, currentPage]);

  // Generate assessment history data
  const generateAssessmentHistoryData = useCallback(() => {
    const glaucomaHistory = assessments
      .filter(a => a.type === 'glaucoma' && typeof a.totalScore === 'number' && a.createdAt)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map(a => ({ date: formatDateShort(a.createdAt.toString()), score: a.totalScore }));
    
    const cancerHistory = assessments
      .filter(a => a.type === 'cancer' && typeof a.totalScore === 'number' && a.createdAt)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .map(a => ({ date: formatDateShort(a.createdAt.toString()), score: a.totalScore }));
    
    setAssessmentHistory({ glaucoma: glaucomaHistory, cancer: cancerHistory });
  }, [assessments, formatDateShort]);

  // Get card data
  const getCardData = useCallback(() => {
    if (latestCard) return latestCard;
    
    // Only create a mock card if we have assessment data
    if (!latestScores.glaucoma && !latestScores.cancer) return null;
    
    // Create a mock card based on user data
    const hasDiabetes = userData.hasDiabetes || false;
    const riskFor: ("glaucoma" | "cancer")[] = [];
    
    if (latestScores.glaucoma !== undefined) riskFor.push('glaucoma');
    if (latestScores.cancer !== undefined) riskFor.push('cancer');
    
    return {
      _id: 'preview',
      userId: session?.user?.id || '',
      cardNo: 'PREVIEW',
      issueDate: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
      diabetes: hasDiabetes,
      riskFor: riskFor,
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as unknown as ICard;
  }, [latestCard, latestScores, userData, session]);

  // Chart options
  const chartOptions: ChartOptions<'line'> = useMemo(() => ({
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Risk Score'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Assessment Date'
        }
      }
    }
  }), []);

  // Chart data
  const glaucomaChartData = useMemo(() => ({
    labels: assessmentHistory.glaucoma.map(item => item.date),
    datasets: [
      {
        label: 'Glaucoma Risk Score',
        data: assessmentHistory.glaucoma.map(item => item.score),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.5)',
        tension: 0.1
      }
    ]
  }), [assessmentHistory.glaucoma]);

  const cancerChartData = useMemo(() => ({
    labels: assessmentHistory.cancer.map(item => item.date),
    datasets: [
      {
        label: 'Cancer Risk Score',
        data: assessmentHistory.cancer.map(item => item.score),
        borderColor: 'rgb(244, 114, 182)',
        backgroundColor: 'rgba(244, 114, 182, 0.5)',
        tension: 0.1
      }
    ]
  }), [assessmentHistory.cancer]);

  // Effect for fetching user data
  useEffect(() => {
    if (status === 'authenticated') {
      fetchUserData();
    }
  }, [status, fetchUserData]);
  
  // Add retry mechanism for profile loading
  useEffect(() => {
    let retryTimeout: NodeJS.Timeout;
    
    if (status === 'authenticated' && !userData.name && !loadingUserData && !error) {
      console.log('Profile data missing, attempting retry...');
      retryTimeout = setTimeout(() => {
        fetchUserData();
      }, 1500);
    }
    
    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [status, userData, loadingUserData, error, fetchUserData]);
  
  // Effect for fetching card data (initial attempt)
  useEffect(() => {
    if (status === 'authenticated' && !loadingUserData && !loadingCard && !hasTriedFetchingCard.current) {
      fetchLatestCard(); // Not forced
    }
  }, [status, fetchLatestCard, loadingUserData, loadingCard]);

  // ADDED: New useEffect to fetch card if assessments exist but no card is available
  useEffect(() => {
    if (
      status === 'authenticated' &&
      assessments.length > 0 &&
      !latestCard &&
      !hasTriedFetchingCard.current && // Check if we haven't already tried (or are trying)
      !loadingCard                   // And not currently loading a card
    ) {
      console.log('ProfilePage: Assessments loaded, no card yet, attempting to fetch/generate card.');
      fetchLatestCard(true); // Force fetch/generate
    }
  }, [status, assessments, latestCard, loadingCard, fetchLatestCard]);
  
  // Completely rewrite the effect for fetching assessment history to avoid the infinite loop
  useEffect(() => {
    console.log(
      `Profile Assessment History useEffect: status=${status}, currentPage=${currentPage}, hasInitiatedFirstFetch=${hasInitiatedFirstFetch.current}, prevPage=${prevPage.current}, currentLoadingState=${loading}`
    );

    if (status === 'authenticated') {
      if (!hasInitiatedFirstFetch.current) {
        console.log(`Profile Assessment History: Triggering INITIAL fetch for page ${currentPage}.`);
        fetchAssessmentHistory(currentPage, true); 
        hasInitiatedFirstFetch.current = true;
        prevPage.current = currentPage;
      } else if (prevPage.current !== currentPage) {
        console.log(`Profile Assessment History: Triggering PAGINATION fetch for page ${currentPage}.`);
        fetchAssessmentHistory(currentPage, false); 
        prevPage.current = currentPage;
      } else {
        console.log('Profile Assessment History: Conditions not met for fetching (e.g., page unchanged or initial fetch already done for this instance).');
      }
    } else if (status === 'unauthenticated') {
      // Only reset these values when status is explicitly unauthenticated, not when loading
      hasInitiatedFirstFetch.current = false;
      prevPage.current = 1; 
      setAssessments([]);
      setTotalPages(1);
      setCurrentPage(1); 
      setError(null);
      setLatestScores({});
      setAssessmentHistory({ glaucoma: [], cancer: [] });
      setLatestCard(null);
      isInitialFetch.current = false; 
      hasTriedFetchingAssessments.current = false; 
      hasTriedFetchingCard.current = false;
    }
    // Don't do anything if status is 'loading' to prevent infinite loops
  }, [status, currentPage, fetchAssessmentHistory, loading]);
  
  // Effect for updating card when scores change
  useEffect(() => {
    if (scoresChanged && (latestScores.glaucoma !== undefined || latestScores.cancer !== undefined) && !loadingCard) {
      generateNewCard();
      setScoresChanged(false);
    }
  }, [latestScores, scoresChanged, generateNewCard, loadingCard]);

  // Effect for generating assessment history data
  useEffect(() => {
    if (assessments.length > 0) {
      generateAssessmentHistoryData();
    }
  }, [assessments, generateAssessmentHistoryData]);

  // Effect for setting document title and cleanup
  useEffect(() => {
    if (status === 'authenticated') {
      document.title = `CLEAR-D | ${session?.user?.name || 'Profile'}`;
  }

    return () => {
      hasTriedFetchingCard.current = false;
      hasTriedFetchingAssessments.current = false;
    };
  }, [status, session]);

  // Functions that don't need memoization because they don't have dependencies
  const getFullName = () => {
    if (!userData.name) return '';
    return `${userData.name.first || ''} ${userData.name.last || ''}`.trim();
  };

  // Get the card to display - either real or mock
  const cardToDisplay = getCardData();

  const handleDownloadCard = () => {
    const cardElement = document.getElementById('card-container');
    if (cardElement) {
      // Temporarily remove any max-width constraints for the download
      const originalStyle = cardElement.getAttribute('style') || '';
      cardElement.style.maxWidth = 'none';
      cardElement.style.width = '450px'; // Set fixed width for consistency
      
      let nameString = 'user';
      if (userData?.name) {
        if (typeof userData.name === 'string') {
          nameString = userData.name;
        } else if (typeof userData.name === 'object' && userData.name.first) {
          // Construct name, ensuring parts are defined
          const firstName = userData.name.first || '';
          const lastName = userData.name.last || '';
          nameString = `${firstName}${lastName ? `_${lastName}` : ''}`.trim();
          if (!nameString) nameString = 'user'; // Fallback if parts were empty
        }
      }
      
      const cardNo = cardToDisplay?.cardNo || 'card';
      // Sanitize the nameString to remove/replace characters invalid for filenames
      const sanitizedNameString = nameString.replace(/[^a-zA-Z0-9_.-]/g, '_');
  
      downloadComponentAsPdf(cardElement, `${sanitizedNameString}_${cardNo}_CLEAR-D_CARD.pdf`);
  
      // Restore original style after a short delay to allow download to initiate
      setTimeout(() => {
        cardElement.setAttribute('style', originalStyle);
      }, 100);
    }
  };

  const handleProfileUpdateSuccess = () => {
    fetchUserData(); // Re-fetch user data to get the latest updates
    setIsEditMode(false); // Optionally switch back to view mode
  };

  // Function to force refresh card data
  const refreshCardData = () => {
    hasTriedFetchingCard.current = false;
    hasTriedFetchingAssessments.current = false;
    fetchAssessmentHistory(currentPage, true);
    fetchLatestCard(true);
  };

  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg text-gray-700">Loading your profile...</p>
          <p className="text-sm text-gray-500 mt-2">Please wait while we retrieve your information.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-8">Your Profile</h1>
      
      {/* User Information Card - Using CLEAR-D Card */}
      {session?.user && (
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-4 mb-4">
            <button 
              onClick={() => setIsEditMode(!isEditMode)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors shadow-md"
            >
              {isEditMode ? 'View Profile' : 'Edit Profile'}
            </button>
            
            {cardToDisplay && (
              <button 
                onClick={handleDownloadCard}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-md"
              >
                Download Card
              </button>
            )}
            
            <button 
              onClick={refreshCardData}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors shadow-md"
            >
              Refresh Card
            </button>

            {/* Add View Public Profile Button */}
            {session?.user?.id && (
              <Link href={`/profile/${session.user.id}`} legacyBehavior>
                <a className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 transition-colors shadow-md">
                  View Public Profile
                </a>
              </Link>
            )}
          </div>

          {!isEditMode && (
            <div className="mb-8 flex flex-col items-center">
              {cardToDisplay ? (
                <div ref={cardRef} id="card-container" className="flex justify-center w-full max-w-[500px] md:max-w-[500px] overflow-visible">
                  <CardViewer
                    card={cardToDisplay}
                    userName={getFullName()}
                    userIc={userData.icPassportNo}
                    userPhotoUrl={userData.photoUrl}
                    glaucomaScore={latestScores.glaucoma ?? undefined}
                    cancerScore={latestScores.cancer ?? undefined}
                    baseUrl={baseUrl}
                  />
                </div>
              ) : assessments.length === 0 ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 max-w-lg text-center">
                  <h3 className="text-lg font-semibold mb-2 text-blue-800">Complete an assessment to get your CLEAR-D Card</h3>
                  <p className="text-blue-700 mb-4">
                    Your CLEAR-D Card will display your health risk levels and provide a shareable health profile.
                  </p>
                  <div className="flex gap-4 justify-center">
                    <Link href="/assessment/glaucoma" legacyBehavior>
                      <a className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">
                        Take Glaucoma Assessment
                      </a>
                    </Link>
                    <Link href="/assessment/cancer" legacyBehavior>
                      <a className="px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 transition-colors">
                        Take Cancer Assessment
                      </a>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5 max-w-lg text-center">
                  <h3 className="text-lg font-semibold mb-2 text-yellow-800">Generating your CLEAR-D Card...</h3>
                  <p className="text-yellow-700 mb-2">
                    We&apos;re processing your assessment data to create your personalized health card.
                  </p>
                  <p className="text-yellow-700">
                    If the card doesn&apos;t appear, please click the button below:
                  </p>
                  <button 
                    onClick={refreshCardData}
                    className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
                  >
                    Refresh Card
                  </button>
                </div>
              )}
            </div>
          )}

          {isEditMode && (
            <div className="w-full max-w-2xl">
              {error && (
                <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
                  <span className="block sm:inline">{error}</span>
                  <button 
                    onClick={() => fetchUserData()}
                    className="mt-2 px-3 py-1 bg-red-100 text-red-800 rounded-md hover:bg-red-200"
                  >
                    Retry
                  </button>
                </div>
              )}
              <UserProfileForm onUpdateSuccess={handleProfileUpdateSuccess} />
            </div>
          )}
          
          {/* Show error state even in view mode */}
          {!isEditMode && error && (
            <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 max-w-md mx-auto">
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{error}</span>
              <button 
                onClick={() => {
                  setError(null);
                  fetchUserData();
                }}
                className="mt-2 px-3 py-1 bg-red-100 text-red-800 rounded-md hover:bg-red-200"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}

            {/* Diabetes Status Banner */}
            {userData.hasDiabetes !== undefined && (
        <div className={`mb-6 p-4 rounded-lg text-center ${userData.hasDiabetes ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
          <h2 className="text-lg font-semibold mb-1">Diabetes Status</h2>
          <p className={`font-medium ${userData.hasDiabetes ? 'text-red-700' : 'text-green-700'}`}>
            {userData.hasDiabetes ? 'You are Diabetic' : 'No Diabetes Registered'}
          </p>
        </div>
      )}
      
      {/* Assessment Trends Section */}
      {!isEditMode && (assessmentHistory.glaucoma.length > 0 || assessmentHistory.cancer.length > 0) && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-xl font-semibold mb-4">Risk Score Trends</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {assessmentHistory.glaucoma.length > 1 && (
              <div className="bg-gray-50 p-4 rounded-md">
                <h3 className="text-lg font-medium mb-3 text-green-800">Glaucoma Assessment History</h3>
                <div className="h-64">
                  <Line options={chartOptions} data={glaucomaChartData} />
                </div>
              </div>
            )}
            
            {assessmentHistory.cancer.length > 1 && (
              <div className="bg-gray-50 p-4 rounded-md">
                <h3 className="text-lg font-medium mb-3 text-pink-800">Cancer Assessment History</h3>
                <div className="h-64">
                  <Line options={chartOptions} data={cancerChartData} />
                </div>
              </div>
            )}
            
            {assessmentHistory.glaucoma.length <= 1 && assessmentHistory.cancer.length <= 1 && (
              <div className="col-span-2 text-center py-4 text-gray-600">
                <p>Take more assessments to see your risk score trends over time.</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Assessment History Section - Only show if not in edit mode */}
      {!isEditMode && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Assessment History</h2>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading your assessment history...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 p-4 rounded-md text-red-600 mb-4">
              <p>{error}</p>
              <button 
                onClick={() => fetchAssessmentHistory(currentPage)}
                className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : assessments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">You haven&apos;t completed any assessments yet.</p>
              <div className="flex gap-4 justify-center">
                <Link href="/assessment/glaucoma" legacyBehavior>
                  <a className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">
                    Take Glaucoma Assessment
                  </a>
                </Link>
                <Link href="/assessment/cancer" legacyBehavior>
                  <a className="px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 transition-colors">
                    Take Cancer Assessment
                  </a>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk Level</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {assessments.map((assessment) => (
                      <tr key={String(assessment._id)} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span 
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              assessment.type === 'glaucoma' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-pink-100 text-pink-800'
                            }`}
                          >
                            {assessment.type.charAt(0).toUpperCase() + assessment.type.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(assessment.createdAt.toString())}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span 
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              assessment.riskLevel === 'Low' 
                                ? 'bg-green-100 text-green-800' 
                                : assessment.riskLevel === 'Medium' 
                                  ? 'bg-yellow-100 text-yellow-800' 
                                  : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {assessment.riskLevel}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {assessment.totalScore.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <Link href={`/results/${String(assessment._id)}`} legacyBehavior>
                            <a className="text-blue-600 hover:text-blue-900">View Details</a>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center mt-6">
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className={`relative inline-flex items-center px-2 py-2 rounded-l-md border ${
                        currentPage === 1 
                          ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed' 
                          : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <span className="sr-only">Previous</span>
                      &larr;
                    </button>
                    
                    {[...Array(totalPages)].map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i + 1)}
                        className={`relative inline-flex items-center px-4 py-2 border ${
                          currentPage === i + 1
                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className={`relative inline-flex items-center px-2 py-2 rounded-r-md border ${
                        currentPage === totalPages 
                          ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed' 
                          : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <span className="sr-only">Next</span>
                      &rarr;
                    </button>
                  </nav>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ProfilePageWrapper;