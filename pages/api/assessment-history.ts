import type { NextApiRequest, NextApiResponse } from 'next';
import { unstable_getServerSession } from 'next-auth/next';
import dbConnect from '../../lib/dbConnect';
import Assessment, { IAssessment } from '../../models/Assessment';
import User from '../../models/User';
import mongoose from 'mongoose';
import { authOptions } from './auth/[...nextauth]';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET requests for this endpoint
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  // Get the authenticated session
  const session = await unstable_getServerSession(req, res, authOptions);

  if (!session || !session.user?.id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  await dbConnect();

  const userId = new mongoose.Types.ObjectId(session.user.id);
  const userRole = session.user.role;

  try {
    // Query parameters
    const limit = parseInt(req.query.limit as string) || 10;
    const targetUserId = req.query.userId as string; // For doctors to view specific user history
    
    let query: any = {};
    
    if (userRole === 'doctor') {
      // Doctors can view any user's history or all users
      if (targetUserId && mongoose.Types.ObjectId.isValid(targetUserId)) {
        query.userId = new mongoose.Types.ObjectId(targetUserId);
      }
      // If no targetUserId, return all assessments (possibly limited by other filters)
      
      // Optional email filter for doctors
      if (req.query.userEmail) {
        const user = await User.findOne({ email: req.query.userEmail as string }).select('_id');
        if (user) {
          query.userId = user._id;
        } else {
          // No user found with that email
          return res.status(200).json({ assessments: [] });
        }
      }
    } else {
      // Regular users can only view their own history
      query.userId = userId;
    }
    
    // Date range filters (if provided)
    if (req.query.startDate || req.query.endDate) {
      query.timestamp = {};
      if (req.query.startDate) {
        query.timestamp.$gte = new Date(req.query.startDate as string);
      }
      if (req.query.endDate) {
        // Add 1 day to include the end date
        const endDate = new Date(req.query.endDate as string);
        endDate.setDate(endDate.getDate() + 1);
        query.timestamp.$lt = endDate;
      }
    }
    
    // Fetch assessments with optimized fields for charting
    const assessments = await Assessment.find(query)
      .select('glaucomaScore cancerScore timestamp userId')
      .sort({ timestamp: 1 }) // Sort by oldest to newest for chart timeline
      .limit(limit)
      .lean();
    
    if (userRole === 'doctor') {
      // For doctors, include user information with each assessment
      const assessmentsWithUserInfo = await Promise.all(
        assessments.map(async (assessment) => {
          const user = await User.findById(assessment.userId).select('name email').lean();
          return {
            ...assessment,
            user: user || { name: 'Unknown', email: 'Unknown' }
          };
        })
      );
      
      return res.status(200).json({ assessments: assessmentsWithUserInfo });
    }
    
    // For regular users, just return their assessments
    return res.status(200).json({ assessments });
    
  } catch (error) {
    console.error('GET /api/assessment-history Error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
}