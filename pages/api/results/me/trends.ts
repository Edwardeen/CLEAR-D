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

  const { limit, type } = req.query;
  const numLimit = limit ? parseInt(limit as string) : 30; // Default limit

  await dbConnect();

  if (req.method === 'GET') {
    try {
      let query: any = { userId: userId };
      if (type && (type === 'glaucoma' || type === 'cancer')) {
        query.type = type as 'glaucoma' | 'cancer';
      }
      // If no type is specified, it will fetch all types for the user.
      // Client might need to filter or the chart component handle mixed types.

      const assessments = await Assessment.find(query)
                                          .sort({ createdAt: -1 }) // Most recent first
                                          .limit(numLimit)
                                          .select('type totalScore riskLevel createdAt') // Select fields relevant for trends
                                          .lean();
      
      // The chart might expect data in chronological order (oldest first)
      const assessmentsForChart = assessments.reverse();

      res.status(200).json({ assessments: assessmentsForChart });

    } catch (error: any) {
      console.error("Error fetching assessment trends:", error);
      res.status(500).json({ message: 'Failed to fetch assessment trends', error: error.message });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 