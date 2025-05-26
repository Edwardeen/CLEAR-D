import type { NextPage } from 'next';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { FiGithub, FiLinkedin, FiExternalLink, FiAward, FiCode, FiDatabase, FiCloud, FiTrendingUp } from 'react-icons/fi';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import edward from '../public/edward.jpg';

// Helper component for section titles
const SectionTitle: React.FC<{ title: string; subtitle?: string; className?: string }> = ({ title, subtitle, className }) => (
  <div className={`text-center mb-12 ${className || ''}`}>
    {subtitle && <p className="text-blue-600 font-semibold text-sm uppercase tracking-wider">{subtitle}</p>}
    <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mt-2">{title}</h2>
  </div>
);

// Team Member Card Component
const TeamMemberCard: React.FC<{ name: string; title: string; description: string; imageSrc: string }> = 
  ({ name, title, description, imageSrc }) => (
  <div className="bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl flex flex-row items-stretch">
    {/* Text Content Area (Left) */}
    <div className="p-6 flex-1 flex flex-col">
      <h3 className="text-xl font-bold text-gray-800 mb-2">{name}</h3>
      <p className="text-blue-600 font-medium mb-4">{title}</p>
      <p className="text-gray-600 text-sm flex-grow">{description}</p>
    </div>
    {/* Image Area (Right) */}
    <div className="relative w-40 md:w-48 flex-shrink-0">
      <Image 
        src={imageSrc} 
        alt={name} 
        layout="fill" 
        objectFit="cover" 
        className="transition-transform duration-300 group-hover:scale-105"
      />
    </div>
  </div>
);

// Placeholder Team Member Card Component
const PlaceholderTeamCard: React.FC = () => (
  <div className="bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl">
    <div className="p-6 flex flex-col items-center">
      <div className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center mb-4">
        <span className="text-gray-400 text-5xl">+</span>
      </div>
      <h3 className="text-xl font-bold text-gray-800 mb-2">Not yet added</h3>
      <p className="text-blue-600 font-medium mb-4">Waiting for data</p>
      <p className="text-gray-600 text-sm text-center">Waiting for data.</p>
    </div>
  </div>
);

// Developer Feature Card
const FeatureCard: React.FC<{ title: string; description: string; icon: React.ReactNode }> = 
  ({ title, description, icon }) => (
  <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300">
    <div className="text-blue-600 mb-4 text-2xl">{icon}</div>
    <h3 className="text-lg font-semibold text-gray-800 mb-2">{title}</h3>
    <p className="text-gray-600 text-sm">{description}</p>
  </div>
);

// Project Card Component
const ProjectCard: React.FC<{ title: string; description: string; metrics?: string }> = 
  ({ title, description, metrics }) => (
  <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
    <h4 className="text-lg font-bold text-gray-800 mb-2">{title}</h4>
    <p className="text-gray-600 text-sm mb-3">{description}</p>
    {metrics && <p className="text-sm text-blue-600 font-medium">{metrics}</p>}
  </div>
);

const AboutPage: NextPage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Client-side check for redirecting unauthenticated users
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  // Handle loading state
  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <p className="text-gray-500 text-lg">Loading session...</p>
      </div>
    );
  }

  // Render "not authenticated" state
  if (!session) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
        <p className="text-gray-500 text-lg">Redirecting to login...</p>
      </div>
    );
  }

  // Main content when authenticated
  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-20">
        <div className="container mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">About CLEAR-D</h1>
          <p className="text-lg md:text-xl max-w-3xl mx-auto">
            Empowering diabetic individuals with advanced tools for early detection of glaucoma and cancer risks.
          </p>
        </div>
      </section>

      {/* About the App Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-6">
          <SectionTitle title="Our Mission" subtitle="What We Do" />
          <div className="max-w-4xl mx-auto text-center">
            <div className="prose prose-lg mx-auto text-gray-700">
              <p>
                CLEAR-D (Cancer & Glaucoma Early Recognition for Diabetics) is a specialized platform designed to address 
                the heightened health risks faced by individuals with diabetes. We focus on two critical health concerns: 
                glaucoma and cancer, both of which show increased prevalence in diabetic populations.
              </p>
              <p>
                Our platform provides accessible digital screening tools that help identify potential early warning signs, 
                empowering users to seek appropriate medical consultation in a timely manner. By combining medical expertise 
                with technological innovation, we aim to improve health outcomes through early detection and informed action.
              </p>
              <p>
                CLEAR-D is an early diagnostic solution, it acts as a risk assessment and awareness tool that complements regular 
                medical care. We bridge the gap between routine check-ups by providing users with personalized risk assessments, 
                educational resources, and connections to specialized healthcare providers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Team Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-6">
          <SectionTitle title="Our Core Team and Inventors" subtitle="The People Behind CLEAR-D" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Dr. Siti Fara Fadila */}
            <TeamMemberCard 
              name="Dr. Siti Fara Fadila Binti Abd Razak"
              title="Senior Lecturer and Researcher, Universiti Tenaga Nasional"
              description="Specializing in Islamic Finance & Waqf Financial Modelling. Ph.D. (2024), MBA in Finance, BSc (Hons) in International Financial Economics. Prolific researcher/consultant with multiple gold medals, two Best Woman Inventor&apos;s awards, and RM297,000 TNB Seeding Fund secured."
              imageSrc="/placeholder-female1.jpg"
            />
            
            {/* Mohd Zulkeflee */}
            <TeamMemberCard 
              name="Mohd Zulkeflee Bin Abd Razak"
              title="Senior Lecturer and Researcher, Universiti Tenaga Nasional"
              description="Distinguished academic with 20+ years in business, marketing & leadership. Diploma in Business Studies (UiTM), BBA (Hons) in International Business, MBA in Marketing, and Ph.D. candidate at UMPSA. Senior Lecturer at UNITEN since 2010, specializing in service recovery, retailing, franchising & sustainability."
              imageSrc="/placeholder-male1.jpg"
            />

            <TeamMemberCard 
              name="Maziah binti Mokhtar, CA(M)"
              title="Lecturer and Researcher, Accounting and Economics Department, Universiti Tenaga Nasional"
              description="Maziah is a Chartered Accountant and PhD candidate specializing in Sustainability Reporting. She holds a Master of Accountancy from UiTM and  has practical experience in accounting, auditing, and financial management. She teaches various finance-related courses and is an active member of MIA, ASEAN CPA, MFPC, and ESG Malaysia."
              imageSrc="/placeholder-female2.jpg"
            />

            <TeamMemberCard 
              name="Izzatul Ussna Ridzwan "
              title="Lecturer and Researcher, Accounting and Economics Department, Universiti Tenaga Nasional"
              description="She holds a Master in Accountancy and a Bachelor of Accounting (Hons.) from UiTM, Malaysia. Her career includes secondments to UNITEN's Intelligence and Strategy Management Centre and Yayasan Canselor UNITEN. She teaches a range of accounting and finance courses, conducts impactful research, and has received multiple research awards. A member of professional bodies such as ACFE and ESG Malaysia, she actively contributes to UNITEN's academic and community initiatives."
              imageSrc="/placeholder-female3.jpg"
            />

            <TeamMemberCard 
              name="Zurina Ismail"
              title="Lecturer and Researcher, Management Department, Universiti Tenaga Nasional"
              description="Zurina Ismail is a lecturer and PhD candidate that focusing on smart grid awareness, energy sustainability, and human capital development. She also leads CSR and public affairs at Yayasan Canselor UNITEN. Her work supports education, community impact, and national energy goals through research, training, and stakeholder engagement."
              imageSrc="/placeholder-female4.jpg"
            />
          </div>
        </div>
      </section>

      {/* Solo Developer Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-6">
          <SectionTitle title="Development Team" subtitle="Technical Leadership" />
          
          <div className="max-w-5xl mx-auto">
            {/* Developer Info */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-lg p-8 mb-12">
              <div className="flex flex-col md:flex-row">
                <div className="md:w-1/3 flex flex-col items-center mb-6 md:mb-0">
                  <div className="w-40 h-40 rounded-full overflow-hidden bg-gray-200 mb-4">
                    {/* Replace with actual image if available */}
                    <div className="w-full h-full bg-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                     <Image src={edward} alt="Edward Nathan Samuel" width={1000} height={1000} />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800">Edward Nathan Samuel</h3>
                  <p className="text-blue-600 font-medium mb-4">Full-Stack Developer and Data Scientist</p>
                  
                  <div className="flex space-x-3 mt-2">
                    <a href="https://github.com/Edwardeen" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-blue-600">
                      <FiGithub size={20} />
                    </a>
                    <a href="https://www.linkedin.com/in/edwarddnathann/" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-blue-600">
                      <FiLinkedin size={20} />
                    </a>
                    <a href="https://edwarddnathann.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-gray-700 hover:text-blue-600">
                      <FiExternalLink size={20} />
                    </a>
                  </div>
                </div>
                
                <div className="md:w-2/3 md:pl-8">
                  <p className="text-gray-700 mb-4">
                    As the sole architect and engineer behind our core platform, Edward drives every phase of development—from initial product concept and system design to hands-on coding, deployment, and maintenance.
                  </p>
                  
                  <div className="grid md:grid-cols-2 gap-4 mb-6">
                    <FeatureCard 
                      icon={<FiCode />}
                      title="Full-Stack Architecture"
                      description="Designing and implementing scalable back-ends (Next.js, TypeScript, MongoDB) alongside responsive front-end interfaces with Tailwind CSS and NextAuth.js."
                    />
                    <FeatureCard 
                      icon={<FiDatabase />}
                      title="Data Engineering & Analytics"
                      description="Building ETL pipelines, structuring analytics-ready data schemas, and crafting interactive dashboards that translate raw data into actionable insights."
                    />
                    <FeatureCard 
                      icon={<FiTrendingUp />}
                      title="Machine Learning & NLP"
                      description="Developing end-to-end ML workflows for health risk detection and predictive analytics using scikit-learn pipelines and 10-fold CV."
                    />
                    <FeatureCard 
                      icon={<FiCloud />}
                      title="DevOps & Reliability"
                      description="Managing CI/CD pipelines, optimizing performance for 99.9% uptime on Vercel, and overseeing continuous monitoring."
                    />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Featured Projects */}
            <div className="mb-12">
              <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">Featured Projects</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <ProjectCard 
                  title="CLEAR-D: Cancer & Glaucoma Early Detection System"
                  description="Architected a clinical scoring engine with Excel parsing, risk visualizations, and a Next.js-powered dashboard."
                  metrics="Supported 15,000+ visits on launch day"
                />
                <ProjectCard 
                  title="NOW2: Waste Donation & Waqf Platform"
                  description="Developed an environmental-tech solution converting waste into WAQF funds."
                  metrics="Bronze Medal at MTE 2024 with 99.9% uptime"
                />
                <ProjectCard 
                  title="SpaceX Falcon 9 Landing Prediction"
                  description="Engineered a clean dataset from REST APIs, built and hyperparameter-tuned ML models."
                  metrics="Achieved 83.33% prediction accuracy"
                />
                <ProjectCard 
                  title="Depression Detection via NLP"
                  description="Created text-classification pipelines using TF-IDF, Random Forest, and Naive Bayes."
                  metrics="91.3% detection accuracy"
                />
              </div>
            </div>
            
            {/* Certifications */}
            <div>
              <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">Certifications</h3>
              <div className="bg-white rounded-lg shadow-md p-6">
                <ul className="grid md:grid-cols-2 gap-3">
                  <li className="flex items-center">
                    <FiAward className="text-blue-600 mr-2" />
                    <span>Information Technology Specialist – Artificial Intelligence (Certiport, Pearson)</span>
                  </li>
                  <li className="flex items-center">
                    <FiAward className="text-blue-600 mr-2" />
                    <span>Machine Learning with Python (IBM)</span>
                  </li>
                  <li className="flex items-center">
                    <FiAward className="text-blue-600 mr-2" />
                    <span>Applied Data Science Capstone (IBM)</span>
                  </li>
                  <li className="flex items-center">
                    <FiAward className="text-blue-600 mr-2" />
                    <span>Introduction to Data Science (Cisco)</span>
                  </li>
                  <li className="flex items-center">
                    <FiAward className="text-blue-600 mr-2" />
                    <span>Introduction to Python (SoloLearn)</span>
                  </li>
                </ul>
              </div>
            </div>
            
            {/* Portfolio & Contact */}
            <div className="text-center mt-8">
              <p className="text-gray-700">
                Explore Edward&apos;s full portfolio, source code, and case studies at{' '}
                <a href="https://edwarddnathann.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-semibold hover:underline">
                  edwarddnathann.vercel.app
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Call to Action */}
      <section className="py-16 bg-blue-600 text-white">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to Explore CLEAR-D?</h2>
          <p className="text-lg max-w-2xl mx-auto mb-8">
            Take control of your health with our specialized assessment tools designed for individuals with diabetes.
          </p>
          <div className="flex flex-col items-center space-y-4 sm:flex-row sm:justify-center sm:space-x-4 sm:space-y-0">
            <Link href="/assessment/glaucoma" legacyBehavior>
              <a className="bg-white text-blue-700 font-semibold py-3 px-8 rounded-lg shadow-md hover:bg-gray-100 transition duration-300 text-lg w-full sm:w-auto">
                Start Glaucoma Assessment
              </a>
            </Link>
            <Link href="/assessment/cancer" legacyBehavior>
              <a className="bg-pink-500 hover:bg-pink-600 text-white font-semibold py-3 px-8 rounded-lg shadow-md transition duration-300 text-lg w-full sm:w-auto">
                Start Cancer Assessment
              </a>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage; 