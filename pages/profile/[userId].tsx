import type { NextPage, GetServerSideProps } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { IAssessment } from '../../models/Assessment'; // Assuming path is correct
import { getCancerScoreColor, getGlaucomaScoreColor } from '../../utils/scoreColors';
import { getRiskLevelName } from '../../utils/riskUtils'; // Updated import path
import React, { useMemo } from 'react'; // Added React and useMemo
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

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

interface UserProfile {
  fullName?: string;
  dateOfBirth?: string;
  gender?: string;
  country?: string;
  state?: string;
  profession?: string;
  race?: string;
  hasDiabetes?: boolean;
  photoUrl?: string;
}

interface LatestAssessmentsByType {
  [type: string]: IAssessment | null;
}

interface PublicProfileData {
  user: UserProfile;
  assessments: IAssessment[]; // All assessments for history
  latestAssessmentsByType: LatestAssessmentsByType;
}

interface ProfilePageProps {
  profileData?: PublicProfileData;
  error?: string;
  userId?: string;
}

const formatDate = (dateString?: string | Date): string => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric' 
  });
};

const PublicProfilePage: NextPage<ProfilePageProps> = ({ profileData, error, userId }) => {
  // Moved useMemo hooks to the top and adjusted for potentially undefined profileData
  const chartOptions: ChartOptions<'line'> = useMemo(() => ({
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false, // No main title for individual charts here
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 10, // Assuming scores are out of 10
        title: {
          display: true,
          text: 'Risk Score'
        }
      },
      x: {
        title: {
          display: false, // Dates are self-explanatory
          text: 'Assessment Date'
        }
      }
    }
  }), []);

  const assessmentHistoryForCharts = useMemo(() => {
    const history: { [type: string]: { date: string; score: number }[] } = {};
    const assessmentsFromProps = profileData?.assessments || [];

    if (assessmentsFromProps.length === 0) {
      return history;
    }

    const types = new Set(assessmentsFromProps.map(a => a.type));

    types.forEach(type => {
      history[type] = assessmentsFromProps
        .filter(a => a.type === type && typeof a.totalScore === 'number' && a.createdAt)
        .sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime())
        .map(a => ({
          date: new Date(a.createdAt!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          score: a.totalScore
        }));
    });
    return history;
  }, [profileData?.assessments]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-700 mb-6">{error}</p>
          <Link href="/" legacyBehavior>
            <a className="text-blue-500 hover:underline">Go back to Home</a>
          </Link>
        </div>
      </div>
    );
  }

  if (!profileData) {
    // This case should ideally be handled by getServerSideProps returning notFound or an error prop
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center p-4">
          <p>Loading profile data or profile not found.</p>
      </div>
    );
  }

  const { user, assessments, latestAssessmentsByType } = profileData;

  const getAssessmentCardBg = (assessment: IAssessment) => {
    const scoreColorClass = assessment.type === 'glaucoma' 
      ? getGlaucomaScoreColor(assessment.totalScore) 
      : getCancerScoreColor(assessment.totalScore);
    const bgMatch = scoreColorClass.match(/bg-([a-zA-Z]+)-(\d+)/);
    return bgMatch ? `bg-${bgMatch[1]}-100` : 'bg-gray-50'; // Lighter background for cards
  };

  // Ensure latestAssessmentsByType is an object before calling Object.keys
  const orderedTypes = Object.keys(latestAssessmentsByType || {}).sort(); 

  return (
    <div className="min-h-screen bg-gray-100 py-8 antialiased">
      <div className="container mx-auto max-w-5xl px-4 space-y-10">
        
        {/* User Profile Details Card */}
        <section className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl">
          <div className="flex flex-col sm:flex-row items-center sm:items-start">
            {user.photoUrl && (
              <div className="flex-shrink-0 mb-6 sm:mb-0 sm:mr-8 w-32 h-32 sm:w-40 sm:h-40 relative">
                <Image 
                  src={user.photoUrl} 
                  alt={user.fullName || 'User photo'} 
                  layout="fill"
                  objectFit="cover"
                  className="rounded-full shadow-lg border-4 border-white"
                />
              </div>
            )}
            <div className="flex-grow text-center sm:text-left">
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-6 pb-3 border-b-2">Health Profile</h1>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-lg">
                <p><strong>Full Name:</strong> {user.fullName || 'N/A'}</p>
                <p><strong>Date of Birth:</strong> {user.dateOfBirth ? formatDate(user.dateOfBirth) : 'N/A'}</p>
                <p><strong>Gender:</strong> {user.gender || 'N/A'}</p>
                <p><strong>Country:</strong> {user.country || 'N/A'}</p>
                <p><strong>State/Region:</strong> {user.state || 'N/A'}</p>
                <p><strong>Profession:</strong> {user.profession || 'N/A'}</p>
                <p><strong>Race:</strong> {user.race || 'N/A'}</p>
                <p><strong>Diabetes Status:</strong> {user.hasDiabetes ? <span className='text-red-600 font-semibold'>Yes</span> : 'No'}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Latest Assessments By Type Section */}
        {orderedTypes.length > 0 && (
          <section className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-5 pb-3 border-b-2">Latest Assessments by Type</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {orderedTypes.map((type) => {
                const latestAssessment = latestAssessmentsByType[type];
                if (!latestAssessment) return null;
                return (
                  <div key={type} className={`p-4 rounded-lg shadow-md ${getAssessmentCardBg(latestAssessment)}`}>
                    <h3 className="text-xl font-semibold text-gray-700">{latestAssessment.type.charAt(0).toUpperCase() + latestAssessment.type.slice(1)} Test</h3>
                    <p className="text-gray-600">Taken on: {formatDate(latestAssessment.createdAt)}</p>
                    <p className="text-2xl font-bold my-2" style={{ color: latestAssessment.type === 'glaucoma' ? '#28a745' : (latestAssessment.type === 'cancer' ? '#e83e8c' : '#007bff')}}>
                      Score: {latestAssessment.totalScore.toFixed(2)} / 10
                    </p>
                    <p className="font-medium">
                      Risk Level: <span className={`px-2 py-1 rounded-md text-sm ${latestAssessment.type === 'glaucoma' ? getGlaucomaScoreColor(latestAssessment.totalScore) : getCancerScoreColor(latestAssessment.totalScore)}`}>
                        {getRiskLevelName(latestAssessment.totalScore, latestAssessment.type)}
                      </span>
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Recent Assessments History - Now shows charts */}
        <section className="bg-white p-6 sm:p-8 rounded-xl shadow-2xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-5 pb-3 border-b-2">Assessment Score Trends</h2>
          {assessments && assessments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.keys(assessmentHistoryForCharts).map((type) => {
                const chartDataForType = assessmentHistoryForCharts[type];
                if (!chartDataForType || chartDataForType.length < 2) { // Only show chart if 2+ data points
                  return (
                    <div key={type} className="text-center text-gray-600 py-4">
                      <p>Not enough data to display trend for {type.charAt(0).toUpperCase() + type.slice(1)}.</p>
                    </div>
                  );
                }

                const data = {
                  labels: chartDataForType.map(item => item.date),
                  datasets: [
                    {
                      label: `${type.charAt(0).toUpperCase() + type.slice(1)} Risk Score`,
                      data: chartDataForType.map(item => item.score),
                      borderColor: type === 'glaucoma' ? 'rgb(34, 197, 94)' : (type === 'cancer' ? 'rgb(244, 114, 182)' : 'rgb(59, 130, 246)'),
                      backgroundColor: type === 'glaucoma' ? 'rgba(34, 197, 94, 0.5)' : (type === 'cancer' ? 'rgba(244, 114, 182, 0.5)' : 'rgba(59, 130, 246, 0.5)'),
                      tension: 0.1
                    }
                  ]
                };

                return (
                  <div key={type} className="bg-gray-50 p-4 rounded-md shadow">
                    <h3 className="text-xl font-semibold text-gray-700 mb-3 text-center">
                      {type.charAt(0).toUpperCase() + type.slice(1)} Trend
                    </h3>
                    <div className="h-56 md:h-64"> {/* Reduced chart height */}
                      <Line options={chartOptions} data={data} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-600 text-center py-4">No assessment history found to display trends.</p>
          )}
        </section>

      </div>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { userId } = context.params || {};

  if (!userId || typeof userId !== 'string') {
    return { props: { error: 'User ID not provided or invalid.' } };
    // Or return { notFound: true };
  }

  try {
    // Construct the absolute URL for the API endpoint
    const protocol = context.req.headers['x-forwarded-proto'] || 'http';
    const host = context.req.headers.host;
    const apiUrl = `${protocol}://${host}/api/users/${userId}/public-profile`;

    const res = await fetch(apiUrl);
    
    if (!res.ok) {
      const errorData = await res.json();
      return { props: { error: errorData.error || `Error fetching profile: ${res.status}`, userId: userId as string } };
    }

    const profileData: PublicProfileData = await res.json();
    return { props: { profileData, userId: userId as string } };

  } catch (e: any) {
    console.error('getServerSideProps Error for public profile:', e);
    return { props: { error: e.message || 'Failed to fetch profile data.', userId: userId as string } };
  }
};

export default PublicProfilePage; 