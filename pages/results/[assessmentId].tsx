import type { NextPage, GetServerSideProps, GetServerSidePropsContext, PreviewData } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { getServerSession, User as NextAuthUser } from 'next-auth'; // Import User as NextAuthUser
import { authOptions } from '../api/auth/[...nextauth]';
import dbConnect from '../../lib/dbConnect';
import Assessment, { IAssessment } from '../../models/Assessment';
import User from '../../models/User';
import { ParsedUrlQuery } from 'querystring';
import React, { useState, useEffect } from 'react';
import mongoose from 'mongoose';
import { getCancerScoreColor, getGlaucomaScoreColor } from '../../utils/scoreColors';
import { getRiskLevelName } from '../../utils/riskUtils'; // Added import

// Icon placeholder (e.g., using a Unicode character or an SVG component later)
const GearIcon = () => <span className="text-3xl">⚙️</span>; // Simple example

// Helper function to get background classes based on score and type
const getBackgroundClasses = (score: number, type: string): string => {
  const scoreColorClass = type === 'glaucoma' 
    ? getGlaucomaScoreColor(score) 
    : getCancerScoreColor(score);
  
  const bgClassMatch = scoreColorClass.match(/bg-([a-zA-Z]+)-(\d+)/);
  if (bgClassMatch && bgClassMatch[1]) {
    const baseColor = bgClassMatch[1]; // e.g., 'red', 'green'
    return `bg-${baseColor}-300`; 
  }
  return 'bg-gray-100'; 
}

// Get recommendation based on score and type
const getRecommendationText = (score: number, type: string): string => {
  const lowerType = type.toLowerCase();
  if (lowerType === 'glaucoma') {
    if (score >= 8) return 'Immediate intervention, laser or IOP-lowering meds';
    if (score >= 5) return 'Surgery or combination treatments';
    if (score >= 2.1) return 'Eye drops, laser therapy';
    return 'Routine monitoring, lifestyle advice';
  } else if (lowerType === 'cancer') {
    if (score >= 9) return 'Surgery + Chemo/Radiation';
    if (score >= 7) return 'Chemotherapy';
    if (score >= 5) return 'Radiation Therapy';
    if (score >= 3) return 'Immunotherapy';
    return 'Targeted Therapy';
  } else {
    if (score >= 8) return 'Urgent medical consultation is advised.';
    if (score >= 5) return 'Consult a specialist for further evaluation and management.';
    if (score >= 2) return 'Monitor symptoms and consider a follow-up with a healthcare provider.';
    return 'Maintain a healthy lifestyle and regular check-ups.';
  }
};

interface ResultsPageProps {
  assessment?: IAssessment | null;
  userDiabetesStatus?: boolean | null;
  error?: string;
}

// Helper to safely stringify and parse (to handle non-serializable types like ObjectId/Date)
const safeJsonParse = (data: any): any => {
  try {
    return JSON.parse(JSON.stringify(data));
  } catch (e) {
    console.error("Failed to parse data:", e);
    return null;
  }
};

const ResultsPage: NextPage<ResultsPageProps> = ({ assessment: initialAssessment, userDiabetesStatus, error }) => {
  const router = useRouter();
  const [historicalAssessments, setHistoricalAssessments] = useState<IAssessment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const pageBgClass = initialAssessment 
    ? getBackgroundClasses(initialAssessment.totalScore, initialAssessment.type) 
    : 'bg-gray-100';

  useEffect(() => {
    if (initialAssessment && initialAssessment._id) {
      const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
          const response = await fetch(`/api/results/me/trends?type=${initialAssessment.type}&limit=20`);
          if (!response.ok) throw new Error('Failed to fetch historical assessments for trend chart');
          const data = await response.json();
          setHistoricalAssessments(data.assessments || []);
        } catch (err: any) {
          setHistoryError(err.message);
        } finally {
          setLoadingHistory(false);
        }
      };
      fetchHistory();
    }
  }, [initialAssessment]);

  if (error) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${pageBgClass}`}>
        <div className="max-w-md w-full bg-white p-6 rounded-xl shadow-2xl text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error Loading Results</h1>
          <p className="text-gray-700 mb-6">{error}</p>
          <Link href="/" legacyBehavior><a className="inline-block bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors shadow-md">Go back to Home</a></Link>
        </div>
      </div>
    );
  }

  if (!initialAssessment) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${pageBgClass}`}>
        <div className="max-w-md w-full bg-white p-6 rounded-xl shadow-2xl text-center">
          <h1 className="text-2xl font-bold text-yellow-600 mb-4">Assessment Not Found</h1>
          <p className="text-gray-700 mb-6">The requested assessment could not be found or you may not have permission to view it.</p>
          <Link href="/" legacyBehavior><a className="inline-block bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors shadow-md">Go back to Home</a></Link>
        </div>
      </div>
    );
  }

  const assessmentTypeDisplay = initialAssessment.type.charAt(0).toUpperCase() + initialAssessment.type.slice(1);
  const themeColor = initialAssessment.type === 'glaucoma' ? "#28a745" : (initialAssessment.type === 'cancer' ? "#e83e8c" : "#007bff");
  const scoreColorClass = initialAssessment 
    ? initialAssessment.type === 'glaucoma' 
      ? getGlaucomaScoreColor(initialAssessment.totalScore)
      : getCancerScoreColor(initialAssessment.totalScore)
    : '';
  
  const riskLevelName = getRiskLevelName(initialAssessment.totalScore, initialAssessment.type);
  const recommendationText = getRecommendationText(initialAssessment.totalScore, initialAssessment.type);

  return (
    <div className={`min-h-screen antialiased text-gray-800 transition-colors duration-500 ${pageBgClass}`}>
      <div className="container mx-auto max-w-4xl px-4 py-8 sm:py-12 space-y-12">

        {/* Page Header */}
        <header className="text-center space-y-3">
          <div className="inline-block p-3 bg-white bg-opacity-70 rounded-full shadow-md">
            <GearIcon />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 filter drop-shadow-sm">
            {assessmentTypeDisplay} Assessment Results
          </h1>
        </header>

        {/* Primary Info Block */}
        <section className="bg-white p-6 sm:p-8 rounded-xl shadow-xl border-t-4" style={{ borderColor: themeColor }}>
          <div className="text-center mb-6">
            <p className="text-xl text-gray-600 mb-1">Your Total Score</p>
            <h2 className="text-7xl font-bold" style={{ color: themeColor }}>
              {initialAssessment.totalScore.toFixed(2)}
              <span className="text-3xl text-gray-500">/10</span>
            </h2>
          </div>
          
          <div className="text-center mb-6">
            <p className="text-xl text-gray-600 mb-2">This places you in the</p>
            <span className={`px-6 py-3 rounded-lg text-xl font-semibold shadow-lg ${scoreColorClass}`}>
              {riskLevelName}
            </span>
            <p className="text-xl text-gray-600 mt-2">category.</p>
          </div>

          {userDiabetesStatus === true && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-center">
              <h3 className="text-xl font-semibold text-red-700 mb-1">Important: Diabetes Status</h3>
              <p className="text-red-600">
                Your record indicates you have diabetes. This can significantly increase risks for certain conditions. Please discuss these results with your doctor.
              </p>
            </div>
          )}
        </section>

        {/* Recommendations Card - Redesigned to be more prominent */}
        <section className="bg-white p-2 rounded-xl shadow-2xl border-t-4 transform transition-all duration-300 hover:scale-[1.01] my-10" style={{ borderColor: themeColor }}>
          <div className="relative overflow-hidden p-8">
            {/* Background accent elements */}
            <div className="absolute top-0 right-0 w-64 h-64 -mt-20 -mr-20 rounded-full bg-gradient-to-b from-blue-50 to-transparent opacity-70"></div>
            <div className="absolute bottom-0 left-0 w-40 h-40 -mb-10 -ml-10 rounded-full bg-gradient-to-t from-blue-50 to-transparent opacity-70"></div>
            
            {/* Content */}
            <div className="relative z-10">
              <div className="flex items-center mb-6">
                <div className="flex-shrink-0 bg-gradient-to-r from-blue-500 to-indigo-600 p-3 rounded-lg shadow-md mr-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-800 tracking-tight">Recommendations</h2>
              </div>
              
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100 shadow-inner mb-6">
                <div className="flex flex-col md:flex-row md:items-center">
                  <div className="flex-shrink-0 bg-white p-4 rounded-lg shadow-md mb-4 md:mb-0 md:mr-6">
                    <p className="text-lg font-bold" style={{ color: themeColor }}>
                      {riskLevelName}
                    </p>
                    <p className="text-sm text-gray-500">Risk Level</p>
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-bold mb-2 text-gray-800">Our Recommendation</h3>
                    <p className="text-lg text-gray-700 leading-relaxed">
                      {recommendationText}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <h4 className="font-semibold text-gray-800 mb-2">Next Steps</h4>
                  <ul className="space-y-2 text-gray-600">
                    <li className="flex items-start">
                      <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      <span>Consult with a healthcare professional</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      <span>Share your assessment results</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="h-5 w-5 text-green-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      <span>Schedule follow-up tests if needed</span>
                    </li>
                  </ul>
                </div>
                
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <h4 className="font-semibold text-gray-800 mb-2">Preventive Measures</h4>
                  <ul className="space-y-2 text-gray-600">
                    <li className="flex items-start">
                      <svg className="h-5 w-5 text-blue-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      <span>Maintain a healthy diet and regular exercise</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="h-5 w-5 text-blue-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      <span>Monitor blood sugar levels closely</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="h-5 w-5 text-blue-500 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      <span>Attend regular health screenings</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Actions Card */}
        <section className="bg-white p-6 sm:p-8 rounded-xl shadow-xl">
          <h2 className="text-3xl font-semibold text-gray-800 mb-6 text-center">Next Steps & Resources</h2>
          <div className="mt-6 flex justify-center">
            <Link href="/hospitals" legacyBehavior>
              <a className="flex flex-col items-center justify-center px-10 py-4 text-lg font-medium text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-300 ease-in-out transform hover:-translate-y-1"
                 style={{ backgroundColor: themeColor }}>
                <span className="text-2xl mb-2">🏥</span> Find a Hospital/Specialist
              </a>
            </Link>
          </div>
        </section>

        {/* Glossary Card */}
        <section className="bg-white p-6 sm:p-8 rounded-xl shadow-xl">
          <h2 className="text-3xl font-semibold text-gray-800 mb-5 border-b-2 pb-3">Glossary</h2>
          <dl className="space-y-4 text-gray-700">
            <div>
              <dt className="font-semibold text-lg">IOP (Intraocular Pressure):</dt>
              <dd className="ml-1 text-base text-gray-600">The fluid pressure inside the eye. Elevated IOP is a key risk factor for glaucoma.</dd>
            </div>
            <div>
              <dt className="font-semibold text-lg">Halos:</dt>
              <dd className="ml-1 text-base text-gray-600">Seeing rainbow-like circles or rings around lights, which can be a symptom of certain eye conditions, including glaucoma.</dd>
            </div>
            {/* Add more terms as needed */}
          </dl>
        </section>

      </div>
    </div>
  );
};

interface Params extends ParsedUrlQuery {
  assessmentId: string;
}

// We won't use CustomNextAuthUser for now to avoid conflict with base NextAuthUser type.
// The role check will be done by directly comparing string values.

export const getServerSideProps: GetServerSideProps<ResultsPageProps, Params> = async (context: GetServerSidePropsContext<Params, PreviewData>) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session || !session.user?.id) {
    return { redirect: { destination: `/login?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`, permanent: false } };
  }
  
  // Access role directly, assuming it might include 'admin' as a string
  const userRole = session.user.role as string; // Cast to string for comparison

  const { assessmentId } = context.params!;
  let assessment: IAssessment | null = null;
  let userDiabetesStatus: boolean | null = null;
  let error: string | undefined;

  if (!assessmentId || !mongoose.Types.ObjectId.isValid(assessmentId)) {
    return { props: { error: 'Invalid or missing Assessment ID.' } };
  }

  try {
    await dbConnect();
    assessment = await Assessment.findById(assessmentId).populate(
        { path: 'userId', model: User, select: 'name email hasDiabetes photoUrl _id' }
    ).lean();

    if (!assessment) {
      return { props: { error: 'Assessment not found.' } };
    }

    const assessmentUserIdString = (assessment.userId as any)?._id?.toString();

    const isAdmin = userRole === 'admin';

    if (assessmentUserIdString !== session.user.id && !isAdmin) {
      return { props: { error: 'You are not authorized to view this assessment.' } };
    }

    if (typeof (assessment.userId as any)?.hasDiabetes === 'boolean') {
      userDiabetesStatus = (assessment.userId as any).hasDiabetes;
    }
    
    const safeAssessment = safeJsonParse(assessment);

    return {
      props: { 
        assessment: safeAssessment,
        userDiabetesStatus
      },
    };
  } catch (e: any) {
    console.error('[ResultPage getServerSideProps] Error:', e);
    return { props: { error: e.message || 'Server error fetching assessment details.' } };
  }
};

export default ResultsPage; 