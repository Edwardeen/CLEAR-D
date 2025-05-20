import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/dbConnect';
import Assessment, { IAssessment } from '@/models/Assessment';
import User from '@/models/User'; // To populate user details if needed
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user || session.user.role !== 'doctor') {
    return res.status(403).json({ message: 'Forbidden: Access restricted to doctors.' });
  }

  if (req.method === 'GET') {
    await dbConnect();

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    try {
      const assessments = await Assessment.find({})
        .populate({
          path: 'userId',
          select: 'name email icPassportNo', // Select fields from User model
          model: User 
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const totalAssessments = await Assessment.countDocuments({});
      const totalPages = Math.ceil(totalAssessments / limit);

      res.status(200).json({
        assessments,
        currentPage: page,
        totalPages,
        totalAssessments,
      });
    } catch (error) {
      console.error('Error fetching all assessments:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 