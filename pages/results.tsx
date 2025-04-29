import type { NextPage, GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from './api/auth/[...nextauth]';
import dbConnect from '../lib/dbConnect';
import Assessment, { IAssessment } from '../models/Assessment';
import { ParsedUrlQuery } from 'querystring';
import React, { useState, useEffect } from 'react';
import mongoose from 'mongoose';
import AssessmentLineChart from '../components/AssessmentLineChart';
import { getCancerScoreColor, getGlaucomaScoreColor } from '../utils/scoreColors';

// Define interface for global weekly average data
interface WeeklyAverage {
  week: string;
  avgGlaucomaScore: number;
  avgCancerScore: number;
  count: number;
}

interface ResultsPageProps {
  assessment?: IAssessment | null; // Can be null if not found or error
  error?: string;
  session?: any; // Added session prop
}

// Helper to safely stringify and parse (to handle non-serializable types like ObjectId/Date)
const safeJsonParse = (data: any): IAssessment | null => {
  try {
    return JSON.parse(JSON.stringify(data));
  } catch (e) {
    console.error("Failed to parse assessment data:", e);
    return null;
  }
};

// Helper function to get recommendation box styles based on the HIGHEST score's color
const getRecommendationBoxStyle = (
    higherRiskDisease: 'glaucoma' | 'cancer' | 'both' | 'none',
    glaucomaScore: number,
    cancerScore: number
): string => {
  switch (higherRiskDisease) {
    case 'glaucoma':
      return getGlaucomaScoreColor(glaucomaScore); // Use glaucoma color scale
    case 'cancer':
      return getCancerScoreColor(cancerScore); // Use cancer color scale
    case 'both':
      // Scores are equal, use the color for that score level (e.g., using glaucoma scale)
      return getGlaucomaScoreColor(glaucomaScore); 
    case 'none':
    default:
      return 'bg-gray-100 border-gray-300 text-gray-800'; // Neutral theme for low risk
  }
};

const ResultsPage: NextPage<ResultsPageProps> = ({ assessment: initialAssessment, error, session }) => {
  const router = useRouter();
  const assessment = initialAssessment;
  const [historicalAssessments, setHistoricalAssessments] = useState<IAssessment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  
  // Global statistics
  const [globalStats, setGlobalStats] = useState<WeeklyAverage[]>([]);
  const [loadingGlobalStats, setLoadingGlobalStats] = useState<boolean>(false);
  const [globalStatsError, setGlobalStatsError] = useState<string | null>(null);
  
  // Toggle for showing global comparison
  const [showGlobalComparison, setShowGlobalComparison] = useState<boolean>(true);
  
  // Determine recommendation box style
  const recommendationBoxStyle = assessment 
    ? getRecommendationBoxStyle(assessment.higherRiskDisease, assessment.glaucomaScore, assessment.cancerScore) 
    : 'bg-gray-100 border-gray-300 text-gray-800'; // Default if no assessment

  useEffect(() => {
    // If we have a valid assessment, fetch historical data for comparison
    if (assessment && assessment._id) {
      const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
          // Use the dedicated assessment-history endpoint with a higher limit
          const response = await fetch(`/api/assessment-history?limit=20`);
          if (!response.ok) {
            throw new Error('Failed to fetch historical assessments');
          }
          const data = await response.json();
          
          // Make sure the current assessment is included
          const currentIncluded = data.assessments.some((a: IAssessment) => a._id === assessment._id);
          
          if (!currentIncluded) {
            setHistoricalAssessments([...data.assessments, assessment]);
          } else {
            setHistoricalAssessments(data.assessments);
          }
        } catch (err: any) {
          setHistoryError(err.message);
        } finally {
          setLoadingHistory(false);
        }
      };
      
      fetchHistory();
    }
  }, [assessment]);
  
  // Fetch global stats for comparison
  useEffect(() => {
    if (assessment) { // Only fetch if we have an assessment
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
    }
  }, [assessment]);

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-10 p-6 bg-red-100 border border-red-400 text-red-700 rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-4">Error Loading Results</h1>
        <p>{error}</p>
        <Link href="/" className="mt-4 inline-block bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition-colors">
           Go back to Home
        </Link>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="max-w-2xl mx-auto mt-10 p-6 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-4">Assessment Not Found</h1>
        <p>The requested assessment could not be found or you do not have permission to view it.</p>
        <Link href="/" className="mt-4 inline-block bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition-colors">
           Go back to Home
        </Link>
      </div>
    );
  }

  // Display the results
  return (
    <div className="max-w-3xl mx-auto mt-6 sm:mt-10 p-6 bg-white rounded-lg shadow-xl">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6 text-center">Assessment Results</h1>

      <div className="space-y-6">
          {/* Scores Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className={`p-4 border rounded-lg text-center shadow-sm ${getGlaucomaScoreColor(assessment.glaucomaScore)}`}>
                <h3 className="text-lg font-semibold">Glaucoma Score</h3>
                <p className="text-3xl font-bold">{assessment.glaucomaScore} <span className="text-lg font-normal">/ 10</span></p>
                <p className="text-sm">({(assessment.glaucomaScore / 10 * 100).toFixed(0)}% Risk)</p>
            </div>
            <div className={`p-4 border rounded-lg text-center shadow-sm ${getCancerScoreColor(assessment.cancerScore)}`}>
                <h3 className="text-lg font-semibold">Cancer Score</h3>
                <p className="text-3xl font-bold">{assessment.cancerScore} <span className="text-lg font-normal">/ 10</span></p>
                <p className="text-sm">({(assessment.cancerScore / 10 * 100).toFixed(0)}% Risk)</p>
            </div>
        </div>

        {/* Diabetes Information Section */}
        {assessment.formData && (
             <div className={`p-4 mt-6 rounded-lg shadow-sm border ${assessment.formData.diabetes ? 'bg-yellow-100 border-yellow-300' : 'bg-blue-50 border-blue-200'}`}>
                 <h3 className={`text-lg font-semibold mb-2 ${assessment.formData.diabetes ? 'text-yellow-900 font-bold' : 'text-blue-800'}`}>Diabetes Information</h3>
                 <p className="text-m text-gray-700">
                     <span className="font-bold">Reported Diabetes Status:</span> 
                     <span className={`font-bold ${assessment.formData.diabetes ? 'text-red-700 text-base' : 'text-green-600'}`}> {assessment.formData.diabetes ? 'Yes' : 'No'}</span>
                 </p>
                 {assessment.formData.diabetes && (
                    <p className="text-xs text-gray-600 mt-2 font-medium">
                        {assessment.higherRiskDisease === 'glaucoma' && "Note: Diabetes is a known risk factor for Glaucoma."}
                        {assessment.higherRiskDisease === 'cancer' && "Note: Diabetes can increase the risk for certain types of Cancer."}
                        {assessment.higherRiskDisease === 'both' && "Note: Diabetes is a known risk factor for both Glaucoma and certain types of Cancer."}
                        {assessment.higherRiskDisease === 'none' && "Note: While your overall risk score is low, managing diabetes is important as it is a known risk factor for both Glaucoma and Cancer."}
                    </p>
                 )}
             </div>
         )}

        {/* Historical Chart Section */}
        {historicalAssessments.length > 0 && (
          <div className="p-5 bg-gray-50 border border-gray-200 rounded-lg shadow-md mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Risk Score Trend</h2>
              <div className="flex items-center">
                <label className="inline-flex items-center cursor-pointer">
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
            
            {loadingHistory || loadingGlobalStats ? (
              <div className="text-center py-4">Loading chart data...</div>
            ) : historyError ? (
              <div className="text-red-500 text-center py-4">{historyError}</div>
            ) : (
              <AssessmentLineChart 
                assessments={historicalAssessments}
                globalData={globalStats}
                showGlobal={showGlobalComparison}
                title="Your Risk Scores vs. Global Averages"
              />
            )}
            
            {globalStatsError && (
              <p className="text-red-500 text-xs mt-2">
                Note: Global comparison data could not be loaded: {globalStatsError}
              </p>
            )}
            
            {showGlobalComparison && globalStats.length > 0 && (
              <div className="mt-2 text-xs text-gray-500 italic">
                <p>
                  Global comparison shows weekly averages across all users.
                  Dotted lines represent global averages.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Primary Risk and Recommendations */}
        <div className={`p-5 ${recommendationBoxStyle} rounded-lg shadow-md`}>
             <h2 className="text-xl font-semibold text-gray-900 mb-3 border-b border-current pb-2">Risk Summary & Recommendations</h2>
            <div className="mb-4">
                <span className="font-medium text-gray-700">Highest Risk Identified: </span>
                <span className="font-bold text-lg text-gray-900">
                    {assessment.higherRiskDisease === 'both' ? 'Glaucoma & Cancer (Equal Risk)'
                        : assessment.higherRiskDisease === 'none' ? 'None (Low Risk Overall)'
                        : assessment.higherRiskDisease.charAt(0).toUpperCase() + assessment.higherRiskDisease.slice(1)
                    }
                </span>
            </div>

            <h3 className="font-semibold text-gray-700 mb-2">Recommendations:</h3>
            
            {/* Glaucoma Section - Always Rendered */}
            <div className="mb-2">
                <h4 className={`font-medium text-green-700 ${assessment.higherRiskDisease === 'glaucoma' || assessment.higherRiskDisease === 'both' ? 'font-bold' : ''}`}>Glaucoma:</h4>
                <p className={`text-sm text-gray-600 ${assessment.higherRiskDisease === 'glaucoma' || assessment.higherRiskDisease === 'both' ? 'font-semibold' : ''}`}>
                    {assessment.glaucomaRecommendations}
                 </p>
            </div>
            
            {/* Cancer Section - Always Rendered */}
             <div className="mb-2">
                <h4 className={`font-medium text-purple-700 ${assessment.higherRiskDisease === 'cancer' || assessment.higherRiskDisease === 'both' ? 'font-bold' : ''}`}>Cancer:</h4>
                <p className={`text-sm text-gray-600 ${assessment.higherRiskDisease === 'cancer' || assessment.higherRiskDisease === 'both' ? 'font-semibold' : ''}`}>
                    {assessment.cancerRecommendations}
                 </p>
            </div>

             <p className="text-xs text-gray-500 mt-4 italic">Remember: This assessment provides early detection of cancer and glaucoma. Consult with a healthcare professional for the full diagnosis and treatment.</p>
        </div>

        {/* Back Button */}
        <div className="text-center mt-8">
          <Link href="/" className="inline-block bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700 transition-colors text-base font-medium">
              Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

interface Params extends ParsedUrlQuery {
    assessmentId: string;
}

// Fetch assessment data server-side
export const getServerSideProps: GetServerSideProps<ResultsPageProps> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session?.user?.id) {
    return {
      redirect: {
        destination: '/login?callbackUrl=/results', // Redirect to login, maybe pass assessmentId later
        permanent: false,
      },
    };
  }

  // Make session serializable by converting undefined values to null
  const serializableSession = JSON.parse(JSON.stringify(session));

  // Get assessmentId from query parameters
  const assessmentId = context.query.assessmentId as string;

  if (!assessmentId || !mongoose.Types.ObjectId.isValid(assessmentId)) {
      return { props: { assessment: null, error: "Invalid or missing assessment ID." } };
  }

  try {
    await dbConnect();

    const assessment = await Assessment.findById(assessmentId).lean(); // Use lean() for plain JS object

    if (!assessment) {
      return { props: { assessment: null, error: "Assessment not found." } };
    }

    // Security Check: Ensure the logged-in user owns the assessment or is a doctor
    if (assessment.userId.toString() !== serializableSession.user.id && serializableSession.user.role !== 'doctor') {
        console.warn(`Unauthorized access attempt: User ${serializableSession.user.id} tried to access assessment ${assessmentId} owned by ${assessment.userId.toString()}`);
         return { props: { assessment: null, error: "You do not have permission to view this assessment." } };
    }

     // Convert ObjectId and Date to string for serialization
     const serializableAssessment = safeJsonParse(assessment);

     if (!serializableAssessment) {
         return { props: { assessment: null, error: "Failed to process assessment data." } };
     }

    return {
      props: { 
        assessment: serializableAssessment,
        session: serializableSession,
      },
    };

  } catch (error: any) {
    console.error("Error fetching assessment:", error);
    return { props: { assessment: null, error: `Server error: ${error.message || 'Could not load results.'}` } };
  }
};


export default ResultsPage; 