import type { NextPage, GetServerSideProps } from 'next';
import { useSession, getSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { IAssessment } from '../models/Assessment';
import React from 'react';

interface ProfilePageProps {
  initialAssessments: IAssessment[];
  totalAssessments: number;
  totalPages: number;
  currentPage: number;
  error?: string;
}

const ProfilePage: NextPage<ProfilePageProps> = ({ 
    initialAssessments,
    totalAssessments: initialTotalAssessments,
    totalPages: initialTotalPages,
    currentPage: initialCurrentPage,
    error: initialError
}) => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [assessments, setAssessments] = useState<IAssessment[]>(initialAssessments);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(initialError || null);
  const [currentPage, setCurrentPage] = useState<number>(initialCurrentPage);
  const [totalPages, setTotalPages] = useState<number>(initialTotalPages);
  const [totalAssessments, setTotalAssessments] = useState<number>(initialTotalAssessments);

   // Authentication check client-side (fallback)
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/profile');
    }
  }, [status, router]);

  const fetchAssessments = async (page: number) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/assessments?page=${page}&limit=10`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch assessments');
            }
            const data = await response.json();
            setAssessments(data.assessments);
            setTotalAssessments(data.totalAssessments);
            setTotalPages(data.totalPages);
            setCurrentPage(data.currentPage);
            // Update URL query param without page reload for better UX
            router.push(`/profile?page=${page}`, undefined, { shallow: true });
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

     const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) {
            fetchAssessments(newPage);
        }
    };

  if (status === 'loading') {
    return <div className="text-center p-10">Loading profile...</div>;
  }

  if (!session) {
    // Should be redirected by getServerSideProps or client-side useEffect
    return <div className="text-center p-10">Redirecting to login...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto bg-white p-6 sm:p-8 rounded-lg shadow-lg mt-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">My Assessment History</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6" role="alert">
          Error: {error}
        </div>
      )}

      {loading && <div className="text-center py-4 text-gray-500">Loading assessments...</div>}

      {!loading && assessments.length === 0 && (
        <div className="text-center py-10 bg-gray-50 rounded-md">
          <p className="text-gray-600 mb-4">You haven&apos;t completed any assessments yet.</p>
          <Link href="/" className="bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition-colors">
              Take Assessment Now
          </Link>
        </div>
      )}

      {!loading && assessments.length > 0 && (
        <>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 border border-gray-200 shadow-sm rounded-lg">
                    <thead className="bg-gray-50">
                    <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Glaucoma Score
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cancer Score
                        </th>
                         <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Highest Risk
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Summary
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        View Details
                        </th>
                    </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                    {assessments.map((assessment) => (
                        <tr key={String(assessment._id)} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            {new Date(assessment.timestamp).toLocaleDateString()} {new Date(assessment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-green-700 text-center">
                            {assessment.glaucomaScore}/10
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-purple-700 text-center">
                            {assessment.cancerScore}/10
                        </td>
                         <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 font-semibold">
                            {assessment.higherRiskDisease === 'both' ? 'Equal Risk' 
                                : assessment.higherRiskDisease === 'none' ? 'Low' 
                                : assessment.higherRiskDisease.charAt(0).toUpperCase() + assessment.higherRiskDisease.slice(1)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate" title={assessment.recommendations.split('\n')[0]}> 
                         {/* Show first line of recommendations as summary */}
                           {assessment.recommendations.split('\n')[0] || 'N/A'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                            <Link href={`/results?assessmentId=${assessment._id}`} className="text-blue-600 hover:text-blue-800 hover:underline">
                                View
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
  );
};

// Fetch initial assessments server-side
export const getServerSideProps: GetServerSideProps<ProfilePageProps> = async (context) => {
  const session = await getSession(context);

  if (!session?.user?.id) {
    return {
      redirect: {
        destination: '/login?callbackUrl=/profile', // Redirect to login
        permanent: false,
      },
    };
  }

    const page = parseInt(context.query.page as string) || 1;
    const limit = 10; // Keep consistent with client-side fetch

    try {
         const response = await fetch(`${process.env.NEXTAUTH_URL}/api/assessments?page=${page}&limit=${limit}`, {
            headers: {
                // Pass the session cookie to the API route for authentication
                'Cookie': context.req.headers.cookie || '',
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
             console.error("SSR fetch error:", errorData);
             // Return error state to the page component
            return { props: { initialAssessments: [], totalAssessments: 0, totalPages: 0, currentPage: 1, error: errorData.message || 'Failed to load assessments.' } };
        }

        const data = await response.json();

         // Basic type check
         if (!data || !Array.isArray(data.assessments)) {
             throw new Error('Invalid data format received from API');
         }

        // Data fetched successfully
        return {
            props: {
                initialAssessments: JSON.parse(JSON.stringify(data.assessments)), // Ensure data is serializable
                totalAssessments: data.totalAssessments,
                totalPages: data.totalPages,
                currentPage: data.currentPage,
            },
        };
    } catch (error: any) {
         console.error('Error fetching assessments server-side:', error);
         return { props: { initialAssessments: [], totalAssessments: 0, totalPages: 0, currentPage: 1, error: error.message || 'Server error fetching assessments.' } };
    }
};

export default ProfilePage; 