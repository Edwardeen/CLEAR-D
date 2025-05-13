import type { NextApiRequest, NextApiResponse } from 'next';
import { unstable_getServerSession } from 'next-auth/next';
import dbConnect from '../../lib/dbConnect';
import Assessment from '../../models/Assessment';
import mongoose from 'mongoose';
import { authOptions } from './auth/[...nextauth]';

interface WeeklyAverage {
  week: string;
  avgGlaucomaScore: number;
  avgCancerScore: number;
  count: number;
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

  // Determine how many weeks of data to fetch (default to 12 weeks)
  const weeks = parseInt(req.query.weeks as string) || 12;
  
  try {
    // Calculate date for the start of the period we want to analyze
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (weeks * 7));

    // MongoDB aggregation pipeline to calculate weekly averages
    const weeklyAverages = await Assessment.aggregate([
      // Filter assessments within our date range
      { 
        $match: { 
          timestamp: { $gte: startDate } 
        } 
      },
      // Add fields for week calculation
      {
        $addFields: {
          // Create ISO week string (YYYY-WW format)
          weekOfYear: {
            $concat: [
              { $toString: { $year: "$timestamp" } },
              "-",
              { 
                $cond: {
                  if: { $lt: [{ $week: "$timestamp" }, 10] },
                  then: { $concat: ["0", { $toString: { $week: "$timestamp" } }] },
                  else: { $toString: { $week: "$timestamp" } }
                }
              }
            ]
          }
        }
      },
      // Group by week and calculate averages
      {
        $group: {
          _id: "$weekOfYear",
          avgGlaucomaScore: { $avg: "$glaucomaScore" },
          avgCancerScore: { $avg: "$cancerScore" },
          count: { $sum: 1 }
        }
      },
      // Reshape output
      {
        $project: {
          _id: 0,
          week: "$_id",
          avgGlaucomaScore: { $round: ["$avgGlaucomaScore", 2] },
          avgCancerScore: { $round: ["$avgCancerScore", 2] },
          count: 1
        }
      },
      // Sort by week
      { $sort: { week: 1 } }
    ]);

    return res.status(200).json({ weeklyAverages });
    
  } catch (error) {
    console.error('GET /api/global-assessment-stats Error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
} 