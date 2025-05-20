import type { NextPage, GetServerSideProps } from 'next';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/pages/api/auth/[...nextauth]';
import Link from 'next/link';
import QuestionCard from '@/components/QuestionCard';

interface Question {
  questionId: string;
  text: string;
  weight: number;
}

interface AnswerPayload {
  questionId: string;
  answer: string;
}

const CancerAssessmentPage: NextPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerPayload[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      const fetchQuestions = async () => {
        try {
          setIsLoading(true);
          const res = await fetch('/api/questions?type=cancer');
          if (!res.ok) {
            throw new Error('Failed to fetch cancer questions');
          }
          const data = await res.json();
          setQuestions(data);
          setError(null);
        } catch (err: any) {
          setError(err.message || 'An unknown error occurred while fetching questions');
          setQuestions([]);
        } finally {
          setIsLoading(false);
        }
      };
      fetchQuestions();
    }
  }, [status, router]);

  const handleAnswer = (questionId: string, answerValue: string) => {
    const newAnswers = [...answers.filter(a => a.questionId !== questionId), { questionId, answer: answerValue }];
    setAnswers(newAnswers);
    
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    } else {
      submitAssessment(newAnswers);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const submitAssessment = async (finalAnswers: AnswerPayload[]) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/assessments/cancer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ responses: finalAnswers }), 
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to submit cancer assessment');
      }
      const resultData = await res.json();
      console.log("Cancer assessment submitted successfully:", resultData);
      if (resultData && resultData.assessmentId) {
        router.push(`/results/${resultData.assessmentId}`);
      } else {
        console.error('Assessment ID not found in the response, redirecting to general results page.');
        router.push('/results');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during submission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === 'loading' || (status === 'authenticated' && isLoading && questions.length === 0 && !error)) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <p className="text-gray-500 text-lg">Loading assessment...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-6 text-center">
        <p className="text-red-500 text-lg">Error: {error}</p>
        <Link href="/" legacyBehavior><a className="text-blue-500 hover:underline">Go back to Home</a></Link>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <p className="text-gray-500 text-lg">Redirecting to login...</p>
      </div>
    );
  }

  if (questions.length === 0 && !isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 text-center">
        <p className="text-gray-600 text-lg">No cancer assessment questions available.</p>
        <Link href="/" legacyBehavior><a className="text-blue-500 hover:underline">Go back to Home</a></Link>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="container mx-auto px-4 py-10 flex flex-col items-center">
      <h1 className="text-3xl font-bold text-gray-800 mb-4">Cancer Assessment</h1>
      <p className="text-gray-600 mb-8">Please answer the following questions to the best of your knowledge.</p>
      
      {currentQuestion && (
        <QuestionCard 
          key={currentQuestion.questionId}
          questionNumber={currentQuestionIndex + 1}
          totalQuestions={questions.length}
          questionText={currentQuestion.text}
          questionId={currentQuestion.questionId}
          onAnswer={handleAnswer}
          themeColor="pink"
        />
      )}

      <div className="mt-8 flex w-full max-w-xl justify-between items-center">
        {currentQuestionIndex > 0 ? (
          <button 
            onClick={handlePrevious} 
            disabled={isSubmitting}
            className="px-6 py-2 text-sm text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-50 transition-colors"
          >
            Previous Question
          </button>
        ) : (<div />) /* Placeholder to maintain layout */}
        
        {currentQuestionIndex === questions.length - 1 && !isSubmitting && currentQuestion && (
          <button 
            onClick={() => submitAssessment(answers)} 
            disabled={isSubmitting}
            className="px-6 py-2 text-sm text-white bg-pink-600 rounded-md hover:bg-pink-700 disabled:opacity-50 transition-colors font-semibold"
          >
            Submit Assessment
          </button>
        )}
      </div>

      {isSubmitting && (
        <p className="text-blue-500 mt-4">Submitting your assessment...</p>
      )}
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    };
  }
  return { props: { session: JSON.parse(JSON.stringify(session)) } };
};

export default CancerAssessmentPage; 