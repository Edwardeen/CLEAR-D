import type { NextPage, GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { getSession } from 'next-auth/react';
import dbConnect from '../lib/dbConnect';
import Assessment, { IAssessment } from '../models/Assessment';
import { ParsedUrlQuery } from 'querystring';
import React from 'react';
import mongoose from 'mongoose';

interface ResultsPageProps {
  assessment?: IAssessment | null; // Can be null if not found or error
  error?: string;
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

const ResultsPage: NextPage<ResultsPageProps> = ({ assessment: initialAssessment, error }) => {
  const router = useRouter();
  const assessment = initialAssessment; // Use the prop directly

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
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center shadow-sm">
                <h3 className="text-lg font-semibold text-green-800">Glaucoma Score</h3>
                <p className="text-3xl font-bold text-green-600">{assessment.glaucomaScore} <span className="text-lg font-normal">/ 10</span></p>
                <p className="text-sm text-gray-600">({(assessment.glaucomaScore / 10 * 100).toFixed(0)}% Risk)</p>
            </div>
             <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg text-center shadow-sm">
                <h3 className="text-lg font-semibold text-purple-800">Cancer Score</h3>
                <p className="text-3xl font-bold text-purple-600">{assessment.cancerScore} <span className="text-lg font-normal">/ 10</span></p>
                 <p className="text-sm text-gray-600">({(assessment.cancerScore / 10 * 100).toFixed(0)}% Risk)</p>
            </div>
        </div>

        {/* Primary Risk and Recommendations */}
        <div className="p-5 bg-blue-50 border border-blue-200 rounded-lg shadow-md">
             <h2 className="text-xl font-semibold text-blue-800 mb-3 border-b border-blue-200 pb-2">Risk Summary & Recommendations</h2>
            <div className="mb-4">
                <span className="font-medium text-gray-700">Highest Risk Identified: </span>
                <span className="font-bold text-lg text-blue-700">
                    {assessment.higherRiskDisease === 'both' ? 'Glaucoma & Cancer (Equal Risk)'
                        : assessment.higherRiskDisease === 'none' ? 'None (Low Risk Overall)'
                        : assessment.higherRiskDisease.charAt(0).toUpperCase() + assessment.higherRiskDisease.slice(1)
                    }
                </span>
            </div>

            <h3 className="font-semibold text-gray-700 mb-1">Recommendations:</h3>
             {/* Use pre-wrap to preserve line breaks from the combined recommendations string */}
             <pre className="text-gray-800 bg-white p-3 border border-gray-200 rounded text-sm whitespace-pre-wrap break-words font-sans">
                 {assessment.recommendations}
             </pre>
             <p className="text-xs text-gray-500 mt-4 italic">Remember: This assessment provides risk stratification and is not a diagnosis. Consult with a healthcare professional for any health concerns.</p>
        </div>


          {/* Optional: Display individual recommendations if needed */}
           {/* <div className="mt-6 p-4 border border-gray-200 rounded">
               <h3 className="font-semibold text-gray-700 mb-2">Detailed Recommendations:</h3>
               <div className="mb-2">
                   <h4 className="font-medium text-green-700">Glaucoma:</h4>
                   <p className="text-sm text-gray-600">{assessment.glaucomaRecommendations}</p>
               </div>
               <div>
                   <h4 className="font-medium text-purple-700">Cancer:</h4>
                   <p className="text-sm text-gray-600">{assessment.cancerRecommendations}</p>
               </div>
           </div> */}


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
export const getServerSideProps: GetServerSideProps<ResultsPageProps, Params> = async (context) => {
  const session = await getSession(context);

  if (!session?.user?.id) {
    return {
      redirect: {
        destination: '/login?callbackUrl=/results', // Redirect to login, maybe pass assessmentId later
        permanent: false,
      },
    };
  }

  const { assessmentId } = context.params!;

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
    if (assessment.userId.toString() !== session.user.id && session.user.role !== 'doctor') {
        console.warn(`Unauthorized access attempt: User ${session.user.id} tried to access assessment ${assessmentId} owned by ${assessment.userId.toString()}`);
         return { props: { assessment: null, error: "You do not have permission to view this assessment." } };
    }

     // Convert ObjectId and Date to string for serialization
     const serializableAssessment = safeJsonParse(assessment);

     if (!serializableAssessment) {
         return { props: { assessment: null, error: "Failed to process assessment data." } };
     }

    return {
      props: { assessment: serializableAssessment },
    };

  } catch (error: any) {
    console.error("Error fetching assessment:", error);
    return { props: { assessment: null, error: `Server error: ${error.message || 'Could not load results.'}` } };
  }
};


export default ResultsPage; 