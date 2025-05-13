import type { NextApiRequest, NextApiResponse } from 'next';
import { unstable_getServerSession } from 'next-auth/next';
import dbConnect from '../../lib/dbConnect';
import Assessment from '../../models/Assessment';
import { authOptions } from './auth/[...nextauth]';

interface GlobalAverageResponse {
  totalAssessments: number;
  averageGlaucomaScore: number;
  averageCancerScore: number;
  monthlyData: {
    month: string;
    avgGlaucomaScore: number;
    avgCancerScore: number;
    count: number;
  }[];
}

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
  
  try {
    // Calculate overall averages from all assessments
    const overallStats = await Assessment.aggregate([
      {
        $group: {
          _id: null,
          totalAssessments: { $sum: 1 },
          averageGlaucomaScore: { $avg: "$glaucomaScore" },
          averageCancerScore: { $avg: "$cancerScore" }
        }
      }
    ]);
    
    // Get monthly aggregated data for the chart (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const monthlyData = await Assessment.aggregate([
      {
        $match: {
          timestamp: { $gte: sixMonthsAgo }
        }
      },
      {
        $sort: { timestamp: 1 }
      },
      {
        $group: {
          _id: {
            year: { $year: "$timestamp" },
            month: { $month: "$timestamp" }
          },
          avgGlaucomaScore: { $avg: "$glaucomaScore" },
          avgCancerScore: { $avg: "$cancerScore" },
          count: { $sum: 1 },
          firstTimestamp: { $first: "$timestamp" }
        }
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 }
      },
      {
        $project: {
          _id: 0,
          month: {
            $concat: [
              { $toString: "$_id.month" },
              "/",
              { $toString: "$_id.year" }
            ]
          },
          avgGlaucomaScore: { $round: ["$avgGlaucomaScore", 2] },
          avgCancerScore: { $round: ["$avgCancerScore", 2] },
          count: 1
        }
      }
    ]);
    
    // If there's no data, return default values
    if (overallStats.length === 0) {
      return res.status(200).json({
        totalAssessments: 0,
        averageGlaucomaScore: 0,
        averageCancerScore: 0,
        monthlyData: []
      });
    }
    
    const result: GlobalAverageResponse = {
      totalAssessments: overallStats[0].totalAssessments,
      averageGlaucomaScore: Math.round(overallStats[0].averageGlaucomaScore * 100) / 100,
      averageCancerScore: Math.round(overallStats[0].averageCancerScore * 100) / 100,
      monthlyData
    };
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('GET /api/global-average-stats Error:', error);
    return res.status(500).json({ message: 'Error calculating global statistics' });
  }
} 