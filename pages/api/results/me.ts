import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/dbConnect';
import Assessment, { IAssessment } from '@/models/Assessment'; 
import { getSession } from 'next-auth/react';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getSession({ req });
  if (!session || !session.user?.id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const userId = session.user.id;

  await dbConnect();

  if (req.method === 'GET') {
    try {
      // Find the latest assessment of each type for the user
      const latestGlaucoma = await Assessment.findOne({ userId: userId, type: 'glaucoma' })
                                           .sort({ createdAt: -1 }) // Get the most recent
                                           .lean();
                                           
      const latestCancer = await Assessment.findOne({ userId: userId, type: 'cancer' })
                                         .sort({ createdAt: -1 })
                                         .lean();

      // We can return these separately or combined
      // Returning separately for now
      res.status(200).json({
        latestGlaucoma: latestGlaucoma, 
        latestCancer: latestCancer,
      });

    } catch (error: any) {
        console.error("Error fetching latest results:", error);
        res.status(500).json({ message: 'Failed to fetch latest results', error: error.message });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 