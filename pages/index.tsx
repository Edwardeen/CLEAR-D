import type { NextPage, GetServerSideProps } from 'next';
import { useSession } from 'next-auth/react';
import { getServerSession } from 'next-auth';
import { authOptions } from './api/auth/[...nextauth]';
import { useRouter } from 'next/router';
import Link from 'next/link';
import React, { useEffect, useRef, useState } from 'react';
import { FiCheckCircle, FiEye, FiBarChart2, FiUserCheck, FiPlayCircle, FiSend, FiShield, FiHeart, FiActivity, FiPlusCircle, FiFileText, FiLoader } from 'react-icons/fi'; // Example icons, install react-icons if not already

// Helper component for section titles
const SectionTitle: React.FC<{ title: string; subtitle?: string; className?: string }> = ({ title, subtitle, className }) => (
  <div className={`text-center mb-12 ${className}`}>
    {subtitle && <p className="text-blue-600 font-semibold text-sm uppercase tracking-wider">{subtitle}</p>}
    <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mt-2">{title}</h2>
  </div>
);

// Helper component for feature cards
const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; description: string; }> = ({ icon, title, description }) => (
  <div className="bg-white p-6 rounded-lg shadow-lg hover:shadow-xl flex flex-col items-center text-center transform hover:-translate-y-1 transition duration-300">
    <div className="text-blue-600 mb-4 text-4xl">{icon}</div>
    <h3 className="text-xl font-semibold text-gray-800 mb-2">{title}</h3>
    <p className="text-gray-600 text-sm">{description}</p>
  </div>
);

// Helper component for "How it Works" steps
const StepCard: React.FC<{ number: string; title: string; description: string; icon: React.ReactNode;}> = ({ number, title, description, icon }) => (
    <div className="flex flex-col items-center text-center p-4">
        <div className="relative mb-4">
            <div className="absolute -inset-2 bg-blue-500 rounded-full opacity-25 animate-ping"></div>
            <div className="relative flex items-center justify-center w-16 h-16 bg-blue-600 text-white rounded-full shadow-lg text-2xl font-bold">                
                {icon}
            </div>
            <span className="absolute -top-2 -right-2 bg-pink-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">{number}</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-800 mb-1">{title}</h3>
        <p className="text-gray-600 text-sm">{description}</p>
    </div>
);

// New Helper component for Focus Area cards
const FocusAreaCard: React.FC<{ title: string; description: string; icon: React.ReactNode; linkHref: string; linkText: string; bgColorClass: string; textColorClass: string; iconBgClass: string; iconColorClass: string; }> = 
  ({ title, description, icon, linkHref, linkText, bgColorClass, textColorClass, iconBgClass, iconColorClass }) => (
  <div className={`rounded-xl shadow-2xl overflow-hidden transform hover:scale-105 transition-transform duration-300 ${bgColorClass} ${textColorClass}`}>
    <div className="p-8 md:p-10">
      <div className={`mb-6 inline-flex items-center justify-center w-16 h-16 rounded-full ${iconBgClass} ${iconColorClass} text-3xl shadow-md`}>
        {icon}
      </div>
      <h3 className="text-2xl md:text-3xl font-bold mb-4">{title}</h3>
      <p className="mb-6 text-base opacity-90">{description}</p>
      <Link href={linkHref} legacyBehavior>
        <a className={`inline-block font-semibold py-3 px-6 rounded-lg shadow-md hover:opacity-80 transition-opacity bg-white ${textColorClass.startsWith('text-white') ? 'text-blue-700' : 'text-blue-700' }`}>
          {linkText} &rarr;
        </a>
      </Link>
    </div>
  </div>
);

interface GlobalStatsData {
  totalAssessments: number;
  averageGlaucomaScore: number;
  averageCancerScore: number;
}

const HomePage: NextPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [globalStats, setGlobalStats] = useState<GlobalStatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Client-side check for redirecting unauthenticated users
  useEffect(() => {
      // Remove the redirect to login as it's already handled by getServerSideProps
      // This prevents the redirect loop when combined with the server-side redirects
      
      // Fetch global stats when component mounts and user is authenticated
      if (status === 'authenticated') {
        const fetchGlobalStats = async () => {
          try {
            setStatsLoading(true);
            const res = await fetch('/api/global-average-stats');
            if (!res.ok) {
              throw new Error('Failed to fetch global statistics');
            }
            const data = await res.json();
            setGlobalStats(data);
            setStatsError(null);
          } catch (error: any) {
            console.error("[HomePage] Error fetching global stats:", error);
            setStatsError(error.message || 'Could not load statistics.');
            setGlobalStats(null); // Clear stats on error
          } finally {
            setStatsLoading(false);
          }
        };
        fetchGlobalStats();
      }
  }, [status, router]);

  const handleTestSession = async () => {
    console.log('[HomePage] Testing /api/test-session');
    try {
      const res = await fetch('/api/test-session', { credentials: 'include' });
      const data = await res.json();
      console.log('[HomePage] /api/test-session response status:', res.status);
      console.log('[HomePage] /api/test-session response data:', data);
      alert(`Session data from API: ${JSON.stringify(data.session, null, 2)}`);
    } catch (error) {
      console.error('[HomePage] Error calling /api/test-session:', error);
      alert('Error fetching session from API.');
    }
  };

  // Handle loading state
  if (status === 'loading') {
    return (
        <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
            <p className="text-gray-500 text-lg">Loading session...</p>
             {/* Optional: Add a spinner */}
        </div>
    );
  }

  // Render form if authenticated
  if (session) {
    const informationalLinks = [
      {
        href: '/glaucoma-info',
        label: 'About Glaucoma',
        description: 'Learn about the causes, symptoms, and importance of early screening for glaucoma in diabetic individuals.',
        icon: <FiEye className="w-8 h-8 mx-auto mb-3 text-blue-600" /> // Placeholder icon
      },
      {
        href: '/cancer-info',
        label: 'About Cancer & Diabetes',
        description: 'Understand the link between diabetes and certain cancers, and why proactive awareness is crucial.',
        icon: <FiPlusCircle className="w-8 h-8 mx-auto mb-3 text-pink-600" /> // Placeholder icon (represents health/medical)
      },
      {
        href: '/early-detection',
        label: 'Importance of Early Detection',
        description: 'Discover how early detection significantly improves outcomes for both glaucoma and cancer.',
        icon: <FiFileText className="w-8 h-8 mx-auto mb-3 text-green-600" /> // Placeholder icon
      },
    ];

    return (
      <div className="bg-gray-50 min-h-screen">
        {/* Hero Section */}
        <section className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-20 md:py-32">
          <div className="container mx-auto px-6 text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 animate-fadeInUp">
              Welcome, {session.user?.name || session.user?.email}!
            </h1>
            <p className="text-lg md:text-xl mb-10 max-w-3xl mx-auto animate-fadeInUp delay-200">
              Proactively manage your health. Our tools help diabetics assess risks for Glaucoma and Cancer early on.
            </p>
            <div className="flex flex-col items-center space-y-4 sm:flex-row sm:justify-center sm:space-x-4 sm:space-y-0 animate-fadeInUp delay-400">
              <Link href="/assessment/glaucoma" legacyBehavior>
                <a className="bg-white text-blue-700 font-semibold py-3 px-8 rounded-lg shadow-md hover:bg-gray-100 transition duration-300 text-lg transform hover:scale-105 w-full sm:w-auto">
                  Start Glaucoma Test
                </a>
              </Link>
              <Link href="/assessment/cancer" legacyBehavior>
                <a className="bg-pink-500 hover:bg-pink-600 text-white font-semibold py-3 px-8 rounded-lg shadow-md transition duration-300 text-lg transform hover:scale-105 w-full sm:w-auto">
                  Start Cancer Test
                </a>
              </Link>
            </div>
          </div>
        </section>

        {/* About Snippet Section - What is CLEAR-D? */}
        <section className="py-16 md:py-24 bg-white">
          <div className="container mx-auto px-6">
            <SectionTitle title="Understanding CLEAR-D" subtitle="Your Health Partner" />
            <div className="max-w-3xl mx-auto text-center text-gray-700 space-y-6">
              <p className="text-lg">
                CLEAR-D (Cancer & Glaucoma Early Recognition for Diabetics) is a dedicated platform designed to empower individuals with diabetes to take proactive steps towards managing their health risks. We provide accessible online assessment tools to help identify early signs associated with glaucoma and certain cancers, conditions often exacerbated by diabetes.
              </p>
              <p>
                Our mission is to foster awareness, encourage timely medical consultation, and ultimately contribute to better health outcomes through early detection and informed action.
              </p>
              <div>
                <Link href="/about" legacyBehavior>
                  <a className="text-blue-600 hover:text-blue-800 font-semibold transition duration-300">Learn more about our mission &rarr;</a>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Key Features Section */}
        <section className="py-16 md:py-24 bg-gray-50">
          <div className="container mx-auto px-6">
            <SectionTitle title="Why Choose CLEAR-D?" subtitle="Key Benefits" />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <FeatureCard 
                icon={<FiEye />} 
                title="Specialized Assessments" 
                description="Tailored screening tools for Glaucoma and Cancer risks, specifically considering diabetic health factors."
              />
              <FeatureCard 
                icon={<FiUserCheck />} 
                title="Personalized Indications" 
                description="Receive immediate risk level indications based on your responses, guiding your next steps."
              />
              <FeatureCard 
                icon={<FiBarChart2 />} 
                title="Track Your Health" 
                description="Monitor your assessment history and understand your health trends over time."
              />
               <FeatureCard 
                icon={<FiShield />} 
                title="Privacy Focused" 
                description="Your data is handled with utmost confidentiality and security. We prioritize your privacy."
              />
              <FeatureCard 
                icon={<FiHeart />} 
                title="Diabetic Centric" 
                description="Information and resources focused on the unique health challenges faced by individuals with diabetes."
              />
              <FeatureCard 
                icon={<FiActivity />} 
                title="Promotes Early Action"
                description="Encourages timely consultation with healthcare professionals for early diagnosis and management."
              />
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-16 md:py-24 bg-white">
          <div className="container mx-auto px-6">
            <SectionTitle title="Simple Steps to Get Started" subtitle="How It Works" />
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
              <StepCard 
                number="1" 
                icon={<FiPlayCircle />} 
                title="Create Your Account" 
                description="Quick and easy registration to access all our tools and resources securely."
              />
              <StepCard 
                number="2" 
                icon={<FiCheckCircle />} 
                title="Take an Assessment" 
                description="Choose between Glaucoma or Cancer risk assessments and answer a series of guided questions."
              />
              <StepCard 
                number="3" 
                icon={<FiBarChart2 />} 
                title="Receive Your Indication" 
                description="Instantly get a risk level indication based on your responses to help you understand your status."
              />
              <StepCard 
                number="4" 
                icon={<FiSend />} 
                title="Consult & Connect" 
                description="Use your results to discuss with your doctor and find specialists if needed using our listings."
              />
            </div>
          </div>
        </section>

        {/* --- Global Data Insights Section --- */}
        <section className="py-16 md:py-24 bg-gray-100">
          <div className="container mx-auto px-6">
            <SectionTitle title="Global Health Insights" subtitle="Platform Data Snapshot" />
            {statsLoading && (
              <div className="flex flex-col items-center justify-center text-center py-10">
                <FiLoader className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                <p className="text-gray-600">Loading latest statistics...</p>
              </div>
            )}
            {statsError && (
              <div className="text-center py-10 bg-red-50 p-4 rounded-md">
                <p className="text-red-600">Could not load statistics: {statsError}</p>
                {/* Optionally add a retry button here */}
              </div>
            )}
            {globalStats && !statsLoading && !statsError && (
              <>
                <div className="text-center mb-10">
                  <p className="text-xl text-gray-700">
                    Based on <span className="font-bold text-indigo-600">{globalStats.totalAssessments.toLocaleString()}</span> total assessments processed on our platform.
                  </p>
                </div>
                <div className="grid md:grid-cols-2 gap-10 lg:gap-16">
                  {/* Glaucoma Statistics Card */}
                  <div className="bg-white rounded-xl shadow-xl overflow-hidden transform transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
                    <div className="h-12 bg-blue-600"></div>
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-gray-800">Glaucoma Risk Snapshot</h3>
                        <div className="p-3 rounded-full bg-blue-100">
                          <FiEye className="w-6 h-6 text-blue-600" />
                        </div>
                      </div>
                      <div className="text-center p-4 bg-gray-50 rounded-lg mb-6">
                        <p className="text-sm text-gray-500">Average Community Risk Score</p>
                        <p className="text-3xl font-bold text-blue-600">
                          {globalStats.averageGlaucomaScore.toFixed(1)}<span className="text-lg">/10</span>
                        </p>
                      </div>
                      <p className="text-gray-600 text-sm mb-6">
                        This score represents the average risk indication for glaucoma among our users. Regular screenings are vital, especially for diabetics, as early detection can prevent significant vision loss.
                      </p>
                      <Link href="/stats#glaucoma" legacyBehavior>
                        <a className="inline-flex items-center font-medium text-blue-600 hover:text-blue-800">
                          Detailed Glaucoma Stats
                          <svg className="ml-1 w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
                        </a>
                      </Link>
                    </div>
                  </div>
                  
                  {/* Cancer Statistics Card */}
                  <div className="bg-white rounded-xl shadow-xl overflow-hidden transform transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
                    <div className="h-12 bg-pink-600"></div>
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-gray-800">Cancer Risk Snapshot</h3>
                        <div className="p-3 rounded-full bg-pink-100">
                          <FiActivity className="w-6 h-6 text-pink-600" />
                        </div>
                      </div>
                      <div className="text-center p-4 bg-gray-50 rounded-lg mb-6">
                        <p className="text-sm text-gray-500">Average Community Risk Score</p>
                        <p className="text-3xl font-bold text-pink-600">
                          {globalStats.averageCancerScore.toFixed(1)}<span className="text-lg">/10</span>
                        </p>
                      </div>
                      <p className="text-gray-600 text-sm mb-6">
                        This score reflects the average cancer risk indication. Diabetic individuals should be aware of varied risk factors and the importance of early, targeted screening for improved outcomes.
                      </p>
                      <Link href="/stats#cancer" legacyBehavior>
                        <a className="inline-flex items-center font-medium text-pink-600 hover:text-pink-800">
                          Detailed Cancer Stats
                          <svg className="ml-1 w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd"></path></svg>
                        </a>
                      </Link>
                    </div>
                  </div>
                </div>
              </>
            )}
            {/* Fallback if no stats and no error/loading - e.g., API returns empty or unexpected format */}
            {!globalStats && !statsLoading && !statsError && (
                <div className="text-center py-10">
                    <p className="text-gray-500">Global statistics are currently unavailable. Please check back later.</p>
                </div>
            )}
          </div>
        </section>

        {/* Secondary Call to Action Section */}
        <section className="py-16 md:py-24 bg-blue-600 text-white">
          <div className="container mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Take Control of Your Health?</h2>
            <p className="text-lg md:text-xl mb-10 max-w-2xl mx-auto">
              Don&apos;t wait for symptoms to appear. Early detection is key, especially for diabetics. Start your free assessment today.
            </p>
            <Link href="/assessment/glaucoma" legacyBehavior> 
              <a className="bg-white text-blue-700 font-semibold py-3 px-8 rounded-lg shadow-md hover:bg-gray-100 transition duration-300 text-lg transform hover:scale-105">
                Assess My Risk Now
              </a>
            </Link>
          </div>
        </section>

        {/* --- UPDATED: Find Hospital & Counselor Cards Section --- */}
        <section className="py-16 md:py-24 bg-white">
          <div className="container mx-auto px-6">
             <SectionTitle title="Find Help Nearby" subtitle="Hospitals & Counselors" />
             <div className="grid md:grid-cols-2 gap-10">
               {/* Find Hospitals Card */}
               <div className="bg-white rounded-xl shadow-xl overflow-hidden hover:shadow-2xl transition-shadow duration-300">
                 <div className="h-48 bg-gradient-to-r from-blue-500 to-blue-600 relative">
                   <div className="absolute inset-0 flex items-center justify-center">
                     <svg className="w-24 h-24 text-white opacity-20" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                       <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm5 5a1 1 0 10-2 0v2H5a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2H9V9z" clipRule="evenodd"></path>
                     </svg>
                   </div>
                   <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-blue-900 to-transparent text-white">
                     <h3 className="text-2xl font-bold">Find Hospitals</h3>
                     <p className="mt-1 text-blue-100">Locate healthcare facilities specialized in diabetes, glaucoma, and cancer care</p>
                   </div>
                 </div>
                 <div className="p-6">
                   <p className="text-gray-600 mb-4">
                     Find healthcare providers specialized in diabetes and related conditions. Our comprehensive database includes hospitals with expertise in managing and treating diabetic complications, glaucoma, and cancer.
                   </p>
                   <div className="mt-4 flex justify-between items-center">
                     <span className="text-sm text-gray-500">250+ hospitals listed</span>
                     <Link href="/hospitals" legacyBehavior>
                       <a className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                         Find Hospitals
                         <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                         </svg>
                       </a>
                     </Link>
                   </div>
                 </div>
               </div>

               {/* Find Counselors Card */}
               <div className="bg-white rounded-xl shadow-xl overflow-hidden hover:shadow-2xl transition-shadow duration-300">
                 <div className="h-48 bg-gradient-to-r from-purple-500 to-purple-600 relative">
                   <div className="absolute inset-0 flex items-center justify-center">
                     <svg className="w-24 h-24 text-white opacity-20" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                       <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path>
                     </svg>
                   </div>
                   <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-purple-900 to-transparent text-white">
                     <h3 className="text-2xl font-bold">Find Counselors</h3>
                     <p className="mt-1 text-purple-100">Connect with mental health professionals specializing in chronic health conditions</p>
                   </div>
                 </div>
                 <div className="p-6">
                   <p className="text-gray-600 mb-4">
                     Living with diabetes and related health concerns can be challenging. Our network of counselors provides mental health support specifically for individuals managing chronic health conditions.
                   </p>
                   <div className="mt-4 flex justify-between items-center">
                     <span className="text-sm text-gray-500">100+ counselors available</span>
                     <Link href="/counselors" legacyBehavior>
                       <a className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                         Find Counselors
                         <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                         </svg>
                       </a>
                     </Link>
                   </div>
                 </div>
               </div>
             </div>
          </div>
        </section>

      </div>
    );
  }

  // Fallback while redirecting or if logic fails
  return (
     <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
            <p className="text-gray-500 text-lg">Redirecting to login...</p>
        </div>
  );
};

// Protect the page: Redirect unauthenticated users to login
export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session) {
    return {
      redirect: {
        destination: '/login', // Redirect destination
        permanent: false, // Not a permanent redirect
      },
    };
  }

  // Make session serializable by converting undefined values to null
  const serializableSession = JSON.parse(JSON.stringify(session));

  // If session exists, pass it as a prop (optional, useSession hook handles it client-side too)
  return {
    props: { session: serializableSession },
  };
};

export default HomePage; 