import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
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
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user?.id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  await dbConnect();
  
  try {
    // Calculate overall averages from all assessments using conditional aggregation
    const overallStats = await Assessment.aggregate([
      {
        $group: {
          _id: null,
          totalAssessments: { $sum: 1 },
          glaucomaCount: { 
            $sum: { 
              $cond: [{ $eq: ["$type", "glaucoma"] }, 1, 0] 
            } 
          },
          cancerCount: { 
            $sum: { 
              $cond: [{ $eq: ["$type", "cancer"] }, 1, 0] 
            } 
          },
          // For new format:
          glaucomaScoreSum: { 
            $sum: { 
              $cond: [
                { $eq: ["$type", "glaucoma"] },
                { $ifNull: ["$totalScore", 0] },
                0
              ]
            } 
          },
          cancerScoreSum: { 
            $sum: { 
              $cond: [
                { $eq: ["$type", "cancer"] },
                { $ifNull: ["$totalScore", 0] },
                0
              ]
            } 
          },
          // For legacy format:
          legacyGlaucomaScoreSum: { 
            $sum: { $ifNull: ["$glaucomaScore", 0] } 
          },
          legacyCancerScoreSum: { 
            $sum: { $ifNull: ["$cancerScore", 0] } 
          },
          legacyGlaucomaCount: { 
            $sum: { 
              $cond: [{ $ne: [{ $ifNull: ["$glaucomaScore", null] }, null] }, 1, 0] 
            } 
          },
          legacyCancerCount: { 
            $sum: { 
              $cond: [{ $ne: [{ $ifNull: ["$cancerScore", null] }, null] }, 1, 0] 
            } 
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalAssessments: 1,
          // Calculate average from both formats, prioritizing new format if available
          averageGlaucomaScore: {
            $cond: [
              { $gt: ["$glaucomaCount", 0] },
              { $divide: ["$glaucomaScoreSum", "$glaucomaCount"] },
              { 
                $cond: [
                  { $gt: ["$legacyGlaucomaCount", 0] },
                  { $divide: ["$legacyGlaucomaScoreSum", "$legacyGlaucomaCount"] },
                  0
                ]
              }
            ]
          },
          averageCancerScore: {
            $cond: [
              { $gt: ["$cancerCount", 0] },
              { $divide: ["$cancerScoreSum", "$cancerCount"] },
              { 
                $cond: [
                  { $gt: ["$legacyCancerCount", 0] },
                  { $divide: ["$legacyCancerScoreSum", "$legacyCancerCount"] },
                  0
                ]
              }
            ]
          }
        }
      }
    ]);
    
    // Get monthly aggregated data for the chart (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const monthlyData = await Assessment.aggregate([
      {
        $match: {
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $sort: { createdAt: 1 }
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          glaucomaScoreSum: { 
            $sum: { 
              $cond: [
                { $eq: ["$type", "glaucoma"] },
                { $ifNull: ["$totalScore", 0] },
                0
              ]
            } 
          },
          cancerScoreSum: { 
            $sum: { 
              $cond: [
                { $eq: ["$type", "cancer"] },
                { $ifNull: ["$totalScore", 0] },
                0
              ]
            } 
          },
          glaucomaCount: { 
            $sum: { 
              $cond: [{ $eq: ["$type", "glaucoma"] }, 1, 0] 
            } 
          },
          cancerCount: { 
            $sum: { 
              $cond: [{ $eq: ["$type", "cancer"] }, 1, 0] 
            } 
          },
          // Legacy fields
          legacyGlaucomaScoreSum: { 
            $sum: { $ifNull: ["$glaucomaScore", 0] } 
          },
          legacyCancerScoreSum: { 
            $sum: { $ifNull: ["$cancerScore", 0] } 
          },
          legacyGlaucomaCount: { 
            $sum: { 
              $cond: [{ $ne: [{ $ifNull: ["$glaucomaScore", null] }, null] }, 1, 0] 
            } 
          },
          legacyCancerCount: { 
            $sum: { 
              $cond: [{ $ne: [{ $ifNull: ["$cancerScore", null] }, null] }, 1, 0] 
            } 
          },
          count: { $sum: 1 },
          firstTimestamp: { $first: "$createdAt" }
        }
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 }
      },
      {
        $project: {
          _id: 0,
          month: {
            $let: {
              vars: {
                monthNames: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
              },
              in: {
                $concat: [
                  { $arrayElemAt: ["$$monthNames", { $subtract: ["$_id.month", 1] }] },
                  " ",
                  { $toString: "$_id.year" }
                ]
              }
            }
          },
          avgGlaucomaScore: {
            $round: [
              {
                $cond: [
                  { $gt: ["$glaucomaCount", 0] },
                  { $divide: ["$glaucomaScoreSum", "$glaucomaCount"] },
                  { 
                    $cond: [
                      { $gt: ["$legacyGlaucomaCount", 0] },
                      { $divide: ["$legacyGlaucomaScoreSum", "$legacyGlaucomaCount"] },
                      0
                    ]
                  }
                ]
              },
              2
            ]
          },
          avgCancerScore: {
            $round: [
              {
                $cond: [
                  { $gt: ["$cancerCount", 0] },
                  { $divide: ["$cancerScoreSum", "$cancerCount"] },
                  { 
                    $cond: [
                      { $gt: ["$legacyCancerCount", 0] },
                      { $divide: ["$legacyCancerScoreSum", "$legacyCancerCount"] },
                      0
                    ]
                  }
                ]
              },
              2
            ]
          },
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
    return res.status(500).json({ message: 'Error calculating global statistics', error: String(error) });
  }
} 