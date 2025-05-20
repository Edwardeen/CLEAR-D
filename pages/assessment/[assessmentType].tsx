import { GetServerSideProps, NextPage } from 'next';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import dbConnect from '../../lib/dbConnect'; // Adjusted path
import QuestionBank from '../../models/QuestionBank'; // Import without IQuestion
import Assessment from '../../models/Assessment'; // Adjusted path
import { ParsedUrlQuery } from 'querystring';
import { IQuestionBankItem } from '../../models/QuestionBank'; // Import the actual interface
import { useServerStatus } from '../../contexts/ServerStatusContext'; // Added

// Define question interface used in props (can use specific properties from IQuestionBankItem)
interface IQuestion {
  _id: string;
  questionId: string;
  text: string;
  type: string;
  weight?: number;
}

interface AssessmentPageProps {
  assessmentType: string;
  questions: IQuestion[];
  error?: string;
  existingAssessmentId?: string | null;
}

const AssessmentPage: NextPage<AssessmentPageProps> = ({ assessmentType, questions, error, existingAssessmentId }) => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { isServerOnline } = useServerStatus(); // Added
  const [responses, setResponses] = useState<{ [key: string]: string }>({});
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/login?callbackUrl=${encodeURIComponent(router.asPath)}`);
    }
  }, [status, router]);

  // Explicitly type status to include 'loading'
  if ((status as 'loading' | 'authenticated' | 'unauthenticated') === 'loading') {
    return <div className='container mx-auto px-4 py-8 text-center'>Loading...</div>;
  }

  if (error) {
    return (
      <div className='container mx-auto px-4 py-8'>
        <h1 className='text-2xl font-bold text-red-600 mb-4'>Error</h1>
        <p>{error}</p>
        <Link href='/' legacyBehavior><a className='text-blue-500 hover:underline mt-4 inline-block'>Go back to Home</a></Link>
      </div>
    );
  }

  if (!questions || questions.length === 0) {
    return (
      <div className='container mx-auto px-4 py-8'>
        <h1 className='text-2xl font-bold mb-4'>Assessment Not Found</h1>
        <p>No questions found for the assessment type: {assessmentType}.</p>
        <p>Please ensure this assessment type is configured correctly.</p>
        <Link href='/' legacyBehavior><a className='text-blue-500 hover:underline mt-4 inline-block'>Go back to Home</a></Link>
      </div>
    );
  }
  
  const handleResponseChange = (questionId: string, answer: string) => {
    setResponses(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!isServerOnline) {
      console.warn("Simulated server offline. Assessment submission aborted.");
      setSubmissionError("Server connection is offline. Cannot submit assessment.");
      setIsSubmitting(false); // Ensure isSubmitting is reset
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);

    if (Object.keys(responses).length !== questions.length) {
      setSubmissionError('Please answer all questions.');
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = {
        type: assessmentType,
        responses: Object.entries(responses).map(([questionId, answer]) => ({
          questionId,
          answer,
        })),
        userId: session?.user?.id,
        existingAssessmentId: existingAssessmentId
      };

      const res = await fetch('/api/assessments/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Submission failed');
      }

      const result = await res.json();
      router.push(`/results/${result.assessmentId}`);

    } catch (err: any) {
      setSubmissionError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const assessmentName = assessmentType.charAt(0).toUpperCase() + assessmentType.slice(1);

  return (
    <div className='container mx-auto px-4 py-8 max-w-2xl'>
      <h1 className='text-3xl font-bold mb-2 text-gray-800'>{assessmentName} Assessment</h1>
      <p className='text-gray-600 mb-8'>Please answer the following questions to the best of your ability.</p>
      
      {existingAssessmentId && (
        <div className='mb-6 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700'>
            <p className='font-bold'>Resuming Previous Assessment</p>
            <p>You are continuing a previously started assessment.</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className='space-y-8'>
        {questions.map((q, index) => (
          <div key={q.questionId} className='p-6 bg-white rounded-lg shadow-md border border-gray-200'>
            <label htmlFor={q.questionId} className='block text-lg font-semibold text-gray-700 mb-3'>
              Question {index + 1}: {q.text}
            </label>
            <div className='flex items-center space-x-6'>
              <label className='flex items-center space-x-2 cursor-pointer p-2 rounded-md hover:bg-gray-50'>
                <input 
                  type='radio' 
                  name={q.questionId} 
                  value='Yes' 
                  checked={responses[q.questionId] === 'Yes'}
                  onChange={() => handleResponseChange(q.questionId, 'Yes')} 
                  className='form-radio h-5 w-5 text-blue-600'
                  required
                />
                <span className='text-gray-700'>Yes</span>
              </label>
              <label className='flex items-center space-x-2 cursor-pointer p-2 rounded-md hover:bg-gray-50'>
                <input 
                  type='radio' 
                  name={q.questionId} 
                  value='No' 
                  checked={responses[q.questionId] === 'No'}
                  onChange={() => handleResponseChange(q.questionId, 'No')} 
                  className='form-radio h-5 w-5 text-blue-600'
                  required
                />
                <span className='text-gray-700'>No</span>
              </label>
            </div>
          </div>
        ))}
        {submissionError && <p className='text-red-500'>{submissionError}</p>}
        <button 
          type='submit' 
          className='w-full mt-8 px-6 py-3 bg-blue-600 text-white font-semibold rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50'
          disabled={isSubmitting || status === 'loading'}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Assessment'}
        </button>
      </form>
    </div>
  );
};

interface Params extends ParsedUrlQuery {
  assessmentType: string;
}

export const getServerSideProps: GetServerSideProps<AssessmentPageProps, Params> = async (context) => {
  const { assessmentType } = context.params!;
  
  try {
    await dbConnect();
    const questions = await QuestionBank.find({ type: assessmentType }).lean();

    if (!questions || questions.length === 0) {
      return {
        props: {
          assessmentType,
          questions: [],
          error: `No questions found for assessment type: ${assessmentType}. Check if the type is correct and questions are seeded.`,
        },
      };
    }

    let existingAssessmentId: string | null = null;
    // Conceptual: Check for incomplete assessment
    // ... (logic for existingAssessmentId remains the same but without i18n concerns)

    return {
      props: {
        assessmentType,
        questions: JSON.parse(JSON.stringify(questions)),
        existingAssessmentId,
      },
    };
  } catch (e: any) {
    console.error('[AssessmentPage getServerSideProps] Error:', e);
    return {
      props: {
        assessmentType,
        questions: [],
        error: e.message || 'Server error fetching assessment questions.',
      },
    };
  }
};

export default AssessmentPage; 