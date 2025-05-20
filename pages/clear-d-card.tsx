import type { NextPage, GetServerSideProps } from 'next';
import { useSession } from 'next-auth/react';
import { getServerSession } from 'next-auth';
import { authOptions } from './api/auth/[...nextauth]';
import { useRouter } from 'next/router';
import { useState, useEffect, useRef, createRef } from 'react';
import Link from 'next/link';
import Card, { ICard } from '@/models/Card'; // Import Card model
import User, { IUser } from '@/models/User'; // Import User model and IUser interface
import CardViewer from '@/components/CardViewer'; // Import CardViewer component
import dbConnect from '@/lib/dbConnect';
import Assessment from '@/models/Assessment';
import { downloadComponentAsPdf } from '@/utils/downloadAsPdf'; // Import the utility

interface ClearDCardPageProps {
  userCards?: ICard[];
  userData?: {
    name?: string;
    icPassportNo?: string;
    photoUrl?: string;
  };
  glaucomaScores?: Record<string, number>;
  cancerScores?: Record<string, number>;
  error?: string | null;
}

const ClearDCardPage: NextPage<ClearDCardPageProps> = ({ 
  userCards: initialCards, 
  userData, 
  glaucomaScores,
  cancerScores,
  error 
}) => {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [cards, setCards] = useState<ICard[]>(initialCards || []);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(error || null);

  // Create refs for each card
  const cardRefs = useRef<React.RefObject<HTMLDivElement>[]>([]);
  useEffect(() => {
    cardRefs.current = cards.map((_, i) => cardRefs.current[i] ?? createRef<HTMLDivElement>());
  }, [cards]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/clear-d-card');
    }
    if (status === 'authenticated' && !initialCards) {
        fetchUserCards();
    }
  }, [status, router, initialCards]);

  const fetchUserCards = async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/cards/me');
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to fetch CLEAR-D cards');
      }
      const data = await res.json();
      setCards(data.cards || []);
    } catch (err: any) {
      setMessage(err.message);
      setCards([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateCard = async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/cards', { method: 'POST' });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to generate new card');
      }
      const { card: newCard } = await res.json();
      // Add the new card to the beginning of the list for immediate display
      setCards(prevCards => [newCard, ...prevCards]);
      setMessage('New CLEAR-D Card generated successfully!');
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadCard = (index: number, cardNo: string) => {
    const cardElement = cardRefs.current[index]?.current;
    if (cardElement) {
      const fullName = userData?.name || 'User';
      const filename = `${fullName}_${cardNo}.pdf`;
      downloadComponentAsPdf(cardElement, filename);
    }
  };

  if (status === 'loading') {
    return <div className="text-center p-10">Loading page...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 mb-8 text-center">Your CLEAR-D Health Cards</h1>
      
      {message && <p className={`my-4 text-center ${message.includes('Failed') || message.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>{message}</p>}

      <div className="text-center mb-10">
        <button 
          onClick={handleGenerateCard}
          disabled={isLoading}
          className="px-8 py-3 text-lg font-semibold text-white bg-teal-500 rounded-lg shadow-md hover:bg-teal-600 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-opacity-75"
        >
          {isLoading ? 'Processing...' : 'Generate New CLEAR-D Card'}
        </button>
      </div>

      {cards.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 items-start justify-items-center">
          {cards.map((card, index) => {
            const cardId = String(card._id);
            const glaucomaScore = cardId && glaucomaScores ? glaucomaScores[cardId] : undefined;
            const cancerScore = cardId && cancerScores ? cancerScores[cardId] : undefined;
            
            return (
              <div 
                key={String(card._id) || card.cardNo} 
                className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md flex flex-col items-center transition-all duration-300 hover:shadow-2xl hover:-translate-y-1"
              >
                <div className="mb-4 text-center w-full">
                  <h3 className="text-xl font-semibold text-gray-800">Card ID: {card.cardNo}</h3>
                  {card.createdAt && (
                    <p className="text-sm text-gray-500">
                      Generated on: {new Date(card.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>

                <div ref={cardRefs.current[index]} className="w-full mb-4">
                  <CardViewer 
                    card={card} 
                    userName={userData?.name}
                    userIc={userData?.icPassportNo}
                    userPhotoUrl={userData?.photoUrl}
                    glaucomaScore={glaucomaScore}
                    cancerScore={cancerScore}
                  />
                </div>

                <button 
                  onClick={() => handleDownloadCard(index, card.cardNo)}
                  className="mt-auto inline-block px-8 py-3 text-base font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 w-full"
                >
                  Download PDF
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        !isLoading && <p className="text-center text-gray-600 mt-8 text-lg">You currently have no CLEAR-D cards. Click the button above to generate one.</p>
      )}
    </div>
  );
};

export const getServerSideProps: GetServerSideProps<ClearDCardPageProps> = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session || !session.user?.id) {
    return {
      redirect: {
        destination: '/login?callbackUrl=/clear-d-card',
        permanent: false,
      },
    };
  }

  await dbConnect();
  let userCards: ICard[] = [];
  let userData: ClearDCardPageProps['userData'] = {};
  let glaucomaScores: Record<string, number> = {};
  let cancerScores: Record<string, number> = {};
  let error: string | null = null;

  try {
    // Fetch user data
    const rawUser = await User.findById(session.user.id).select('name icPassportNo photoUrl').lean();
    if (rawUser) {
      const user = JSON.parse(JSON.stringify(rawUser)) as IUser;
      const firstName = user.name?.first || '';
      const lastName = user.name?.last || '';
      userData = {
        name: `${firstName} ${lastName}`.trim() || undefined,
        icPassportNo: user.icPassportNo,
        photoUrl: user.photoUrl,
      };
    }

    // Fetch user cards
    const rawCards = await Card.find({ userId: session.user.id }).sort({ createdAt: -1 }).lean();
    userCards = JSON.parse(JSON.stringify(rawCards));

    // Fetch assessment scores - Get latest scores for each type
    if (userCards.length > 0) {
      // Get most recent glaucoma assessment
      const latestGlaucomaAssessment = await Assessment.findOne({ 
        userId: session.user.id,
        type: 'glaucoma'
      }).sort({ createdAt: -1 }).lean();

      // Get most recent cancer assessment
      const latestCancerAssessment = await Assessment.findOne({ 
        userId: session.user.id,
        type: 'cancer'
      }).sort({ createdAt: -1 }).lean();

      // Store scores for each card
      userCards.forEach(card => {
        const cardId = String(card._id);
        
        if (card.riskFor.includes('glaucoma') && latestGlaucomaAssessment) {
          glaucomaScores[cardId] = latestGlaucomaAssessment.totalScore;
        }
        
        if (card.riskFor.includes('cancer') && latestCancerAssessment) {
          cancerScores[cardId] = latestCancerAssessment.totalScore;
        }
      });
    }
  } catch (e: any) {
    console.error('SSR Error fetching card data:', e);
    error = 'Could not load card data. Please try again later.';
  }

  return { 
    props: { 
      userCards, 
      userData, 
      glaucomaScores,
      cancerScores,
      error 
    } 
  }; 
};

export default ClearDCardPage; 