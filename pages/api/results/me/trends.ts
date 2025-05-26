import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/dbConnect';
import Assessment from '@/models/Assessment';
import User from '@/models/User'; // Import User model to find user by email
import { getSession } from 'next-auth/react';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getSession({ req });
  if (!session || !session.user?.id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Determine whose trends to fetch
  let targetUserId: string | undefined = undefined;
  const requestedUserEmail = req.query.userEmail as string;

  await dbConnect(); // Connect to DB early

  if (requestedUserEmail) {
    // If userEmail is provided, requester must be a doctor
    if (session.user.role !== 'doctor') {
      return res.status(403).json({ message: 'Forbidden: Only doctors can view trends for other users.' });
    }
    // Find user by email to get their ID
    try {
      const user = await User.findOne({ email: requestedUserEmail }).lean();
      if (!user) {
        return res.status(404).json({ message: 'User not found for the provided email.' });
      }
      targetUserId = user._id.toString();
    } catch (dbError) {
      console.error('Error fetching user by email for trends:', dbError);
      return res.status(500).json({ message: 'Database error finding user.' });
    }
  } else {
    // If no userEmail, fetch for the logged-in user themselves
    targetUserId = session.user.id;
  }

  if (!targetUserId) {
    // This case should ideally not be reached if logic above is correct
    return res.status(400).json({ message: 'Could not determine target user for trends.'});
  }

  const { limit, type } = req.query;
  const numLimit = limit ? parseInt(limit as string) : 30; // Default limit

  if (req.method === 'GET') {
    try {
      let query: any = { userId: targetUserId }; // Use targetUserId
      if (type && (type === 'glaucoma' || type === 'cancer')) {
        query.type = type as 'glaucoma' | 'cancer';
      }

      const assessments = await Assessment.find(query)
                                          .sort({ createdAt: 1 }) // Oldest first for trend line
                                          .limit(numLimit)
                                          .select('type totalScore glaucomaScore cancerScore riskLevel createdAt timestamp') 
                                          .lean();
      
      // Data is already sorted oldest first by `sort({ createdAt: 1 })`
      // const assessmentsForChart = assessments.reverse(); // No longer needed

      res.status(200).json({ assessments }); // Send assessments directly

    } catch (error: any) {
      console.error("Error fetching assessment trends:", error);
      res.status(500).json({ message: 'Failed to fetch assessment trends', error: error.message });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 