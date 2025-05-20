import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/dbConnect';
import Assessment, { IAssessment } from '@/models/Assessment';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session || !session.user?.id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const userId = session.user.id;

  const page = req.query.page ? parseInt(req.query.page as string) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 10; // Default limit 10
  const skip = (page - 1) * limit;

  await dbConnect();

  if (req.method === 'GET') {
    try {
      const query: any = { userId: userId };
      
      // Optionally, filter by type if a 'type' query param is provided
      if (req.query.type && (req.query.type === 'glaucoma' || req.query.type === 'cancer')) {
        query.type = req.query.type as 'glaucoma' | 'cancer';
      }

      // Use Promise.all to run both queries in parallel for better performance
      const [totalAssessments, assessments] = await Promise.all([
        Assessment.countDocuments(query),
        Assessment.find(query)
          .select('type totalScore riskLevel createdAt') // Only select fields we need
          .sort({ createdAt: -1 }) // Most recent first for history view
          .skip(skip)
          .limit(limit)
          .lean()
      ]);

      const totalPages = Math.ceil(totalAssessments / limit);

      // Set cache headers for better performance
      res.setHeader('Cache-Control', 'public, max-age=10, s-maxage=30, stale-while-revalidate=60');
      
      res.status(200).json({
        assessments,
        totalAssessments,
        totalPages,
        currentPage: page,
      });

    } catch (error: any) {
      console.error("Error fetching user assessments:", error);
      res.status(500).json({ message: 'Failed to fetch user assessments', error: error.message });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 