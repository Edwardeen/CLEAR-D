import { GetServerSideProps, NextPage } from 'next';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { useState } from 'react';
import Link from 'next/link';
import dbConnect from '../../../lib/dbConnect';
import mongoose from 'mongoose';
import Assessment from '../../../models/Assessment';
import QuestionBank from '../../../models/QuestionBank';

interface AssessmentDetailsProps {
  assessment: {
    _id: string;
    type: string;
    score: number;
    riskLevel: string;
    recommendations: string[];
    createdAt: string;
    updatedAt: string;
    questions: {
      questionId: string;
      text: string;
      answer: string;
      weight: number;
    }[];
  } | null;
  error?: string;
}

const AssessmentDetailsPage: NextPage<AssessmentDetailsProps> = ({ assessment, error }) => {
  const router = useRouter();
  const { data: session, status } = useSession();
  
  if (status === 'loading') {
    return <div className='container mx-auto px-4 py-8 text-center'>Loading...</div>;
  }

  if (!session) {
    return (
      <div className='container mx-auto px-4 py-8 text-center'>
        <h1 className='text-2xl font-bold mb-4'>Authentication Required</h1>
        <p className='mb-4'>Please sign in to view assessment details.</p>
        <Link href={`/login?callbackUrl=${encodeURIComponent(router.asPath)}`} className='text-blue-500 hover:underline'>
          Sign In
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className='container mx-auto px-4 py-8'>
        <h1 className='text-2xl font-bold text-red-600 mb-4'>Error</h1>
        <p>{error}</p>
        <Link href='/' className='text-blue-500 hover:underline mt-4 inline-block'>Go back to Home</Link>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className='container mx-auto px-4 py-8'>
        <h1 className='text-2xl font-bold mb-4'>Assessment Not Found</h1>
        <p>The assessment you&apos;re looking for could not be found.</p>
        <Link href='/' className='text-blue-500 hover:underline mt-4 inline-block'>Go back to Home</Link>
      </div>
    );
  }

  const assessmentName = assessment.type.charAt(0).toUpperCase() + assessment.type.slice(1);

  return (
    <div className='container mx-auto px-4 py-8 max-w-2xl'>
      <h1 className='text-3xl font-bold mb-6 text-gray-800'>{assessmentName} Assessment Details</h1>
      
      <div className='bg-white rounded-lg shadow-md p-6 mb-6'>
        <div className='flex justify-between items-center mb-4'>
          <h2 className='text-xl font-semibold'>Assessment Summary</h2>
          <span className='text-gray-500 text-sm'>
            {new Date(assessment.createdAt).toLocaleDateString()}
          </span>
        </div>
        <div className='grid grid-cols-2 gap-4 mb-4'>
          <div>
            <p className='text-gray-600 text-sm'>Score</p>
            <p className='font-semibold'>{assessment.score}</p>
          </div>
          <div>
            <p className='text-gray-600 text-sm'>Risk Level</p>
            <p className='font-semibold'>{assessment.riskLevel}</p>
          </div>
        </div>
      </div>
      
      <div className='bg-white rounded-lg shadow-md p-6 mb-6'>
        <h2 className='text-xl font-semibold mb-4'>Recommendations</h2>
        <ul className='list-disc pl-5 space-y-2'>
          {assessment.recommendations.map((rec, index) => (
            <li key={index} className='text-gray-700'>{rec}</li>
          ))}
        </ul>
      </div>
      
      <div className='bg-white rounded-lg shadow-md p-6'>
        <h2 className='text-xl font-semibold mb-4'>Responses</h2>
        <div className='space-y-4'>
          {assessment.questions.map((question, index) => (
            <div key={question.questionId} className='p-4 border border-gray-200 rounded-md'>
              <p className='font-medium'>{index + 1}. {question.text}</p>
              <p className='mt-2'>
                <span className='text-gray-600'>Answer:</span>{' '}
                <span className={`font-semibold ${question.answer === 'Yes' ? 'text-red-600' : 'text-green-600'}`}>
                  {question.answer}
                </span>
              </p>
            </div>
          ))}
        </div>
      </div>
      
      <div className='mt-8 text-center'>
        <Link href='/profile' className='text-blue-500 hover:underline'>
          Back to Profile
        </Link>
      </div>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { assessmentInstanceId } = context.params || {};

  if (!assessmentInstanceId || !mongoose.Types.ObjectId.isValid(assessmentInstanceId as string)) {
    return {
      props: {
        assessment: null,
        error: 'Invalid assessment ID',
      },
    };
  }

  try {
    await dbConnect();
    
    const assessment = await Assessment.findById(assessmentInstanceId).lean();
    
    if (!assessment) {
      return {
        props: {
          assessment: null,
          error: 'Assessment not found',
        },
      };
    }
    
    // Get the question bank for this assessment type
    const questionBank = await QuestionBank.find({ type: assessment.type }).lean();
    
    // Map questions with their text
    const assessmentData = {
      _id: assessment._id.toString(),
      type: assessment.type,
      score: assessment.totalScore || 0,
      riskLevel: assessment.riskLevel || 'Unknown',
      recommendations: Array.isArray(assessment.recommendations)
        ? assessment.recommendations
        : (typeof assessment.recommendations === 'string' ? (assessment.recommendations as string).split(new RegExp("\\n|<br\\s*\\/?>",'gi')) : []),
      createdAt: assessment.createdAt ? new Date(assessment.createdAt).toISOString() : '',
      updatedAt: assessment.updatedAt ? new Date(assessment.updatedAt).toISOString() : '',
      questions: questionBank.map(q => ({
        questionId: q._id.toString(),
        text: q.text,
        answer: assessment.responses.find((r: any) => r.questionId.toString() === q._id.toString())?.answer || 'Not answered',
        weight: q.weight || 1,
      })),
    };

    return {
      props: {
        assessment: JSON.parse(JSON.stringify(assessmentData)),
        error: null,
      },
    };
  } catch (e: any) {
    console.error('[AssessmentDetailsPage getServerSideProps] Error:', e);
    return {
      props: {
        assessment: null,
        error: e.message || 'Server error fetching assessment details',
      },
    };
  }
};

export default AssessmentDetailsPage;