import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import dbConnect from '../../../lib/dbConnect';
import Assessment from '../../../models/Assessment';
import User from '../../../models/User';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // Check authentication
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  // Only doctors can access trends
  if (session.user?.role !== 'doctor') {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  const { email } = req.query;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ success: false, message: 'User email is required' });
  }

  try {
    await dbConnect();

    // Find the user by email - using regex for case-insensitive search
    const emailDecoded = decodeURIComponent(email).trim();
    const user = await User.findOne({ 
      email: { $regex: new RegExp(`^${emailDecoded.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
    }).select('_id name');
    
    if (!user) {
      console.warn(`User not found for email: ${emailDecoded}`);
      return res.status(404).json({ 
        success: false, 
        message: 'User not found',
        detail: `No user found with email: ${emailDecoded}`
      });
    }

    // Get userName for display
    let userName = '';
    if (user.name) {
      if (typeof user.name === 'string') {
        userName = user.name;
      } else if (user.name.first || user.name.last) {
        userName = `${user.name.first || ''} ${user.name.last || ''}`.trim();
      }
    }
    
    // Determine time period - default to 'all' (no date filter)
    const period = req.query.period as string || 'all';
    const sortBy = req.query.sortBy as string || 'date_asc'; // date_asc, date_desc, score_asc, score_desc
    
    // Build date filter if needed
    const dateFilter: any = {};
    const today = new Date();
    
    if (period === '1m') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(today.getMonth() - 1);
      dateFilter.createdAt = { $gte: oneMonthAgo };
    } else if (period === '3m') {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(today.getMonth() - 3);
      dateFilter.createdAt = { $gte: threeMonthsAgo };
    } else if (period === '6m') {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(today.getMonth() - 6);
      dateFilter.createdAt = { $gte: sixMonthsAgo };
    } else if (period === '1y') {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(today.getFullYear() - 1);
      dateFilter.createdAt = { $gte: oneYearAgo };
    }
    
    // Build query with filters
    const query = { 
      userId: user._id,
      ...dateFilter
    };

    // Add date range filters
    if (req.query.startDate) {
      const startDate = new Date(req.query.startDate as string);
      if (!isNaN(startDate.getTime())) {
        query.createdAt = { ...query.createdAt, $gte: startDate };
      }
    }
    
    if (req.query.endDate) {
      const endDate = new Date(req.query.endDate as string);
      // Set to end of day
      endDate.setHours(23, 59, 59, 999);
      if (!isNaN(endDate.getTime())) {
        query.createdAt = { ...query.createdAt, $lte: endDate };
      }
    }
    
    // Add illness type filter
    if (req.query.type && typeof req.query.type === 'string' && req.query.type.trim() !== '') {
      query.type = req.query.type.trim();
    }
    
    // Add min score filter
    if (req.query.minScore && typeof req.query.minScore === 'string') {
      const minScore = parseFloat(req.query.minScore);
      if (!isNaN(minScore)) {
        query.totalScore = { $gte: minScore };
      }
    }

    // Determine sort order
    let sortOrder: any = { createdAt: 1 }; // Default: oldest to newest
    
    if (sortBy === 'date_desc') {
      sortOrder = { createdAt: -1 }; // Newest to oldest
    } else if (sortBy === 'score_asc') {
      sortOrder = { totalScore: 1 }; // Low to high score
    } else if (sortBy === 'score_desc') {
      sortOrder = { totalScore: -1 }; // High to low score
    }

    // Find assessments for this user
    const assessments = await Assessment.find(query)
      .sort(sortOrder)
      .select('type totalScore createdAt')
      .lean();

    return res.status(200).json({
      success: true,
      userName,
      assessments,
      timePeriod: period,
      sort: sortBy,
      total: assessments.length
    });
  } catch (error: any) {
    console.error('Error fetching user trends:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error fetching user trends',
      error: error.message
    });
  }
}