import type { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import dbConnect from '../../lib/dbConnect';
import Assessment, { IAssessment, IFormData } from '../../models/Assessment';
import User from '../../models/User'; // Needed for populating user info
import { calculateRisk } from '../../utils/riskCalculator';
import { getOverallRecommendations } from '../../utils/recommendations';
import mongoose from 'mongoose';

interface AssessmentPostData {
  formData: IFormData;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log("--- Handling /api/assessments request ---"); // Add log
  console.log("Request Method:", req.method); // Add log
  console.log("Request Cookies:", req.headers.cookie); // Add log: See if cookie arrives

  // Add this log:
  console.log("NEXTAUTH_SECRET loaded in /api/assessments:", process.env.NEXTAUTH_SECRET ? 'Loaded (value hidden)' : '!!! NOT LOADED !!!');

  const session = await getSession({ req });

  console.log("Result of getSession:", session); // Add log: Crucial! See what getSession returns

  if (!session || !session.user?.id) {
    console.error("getSession failed or returned invalid session. Returning 401."); // Add log
    return res.status(401).json({ message: 'Unauthorized' });
  }

  console.log("Session valid, user ID:", session.user.id); // Add log

  await dbConnect();

  const userId = new mongoose.Types.ObjectId(session.user.id);
  const userRole = session.user.role;

  switch (req.method) {
    case 'POST':
      try {
        const { formData }: AssessmentPostData = req.body;

        if (!formData) {
          return res.status(400).json({ message: 'Missing form data' });
        }

        // Perform risk calculation
        const riskResults = calculateRisk(formData);
        const recommendationResults = getOverallRecommendations(riskResults);

        const newAssessment = new Assessment({
          userId: userId,
          formData: formData,
          glaucomaScore: riskResults.glaucomaScore,
          cancerScore: riskResults.cancerScore,
          higherRiskDisease: recommendationResults.higherRiskDisease,
          recommendations: recommendationResults.recommendations,
          glaucomaRecommendations: recommendationResults.glaucomaRecommendations,
          cancerRecommendations: recommendationResults.cancerRecommendations,
          timestamp: new Date(),
        });

        await newAssessment.save();

        // Return the newly created assessment including its ID
        return res.status(201).json({ message: 'Assessment saved successfully', assessment: newAssessment });

      } catch (error) {
        console.error('POST /api/assessments Error:', error);
        if (error instanceof Error && error.name === 'ValidationError') {
            return res.status(400).json({ message: 'Validation Error', errors: (error as any).errors });
        }
        return res.status(500).json({ message: 'Internal Server Error' });
      }

    case 'GET':
      try {
        let assessments;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10; // Default limit 10
        const skip = (page - 1) * limit;

        let query = {};
        let totalAssessments = 0;

        if (userRole === 'doctor') {
          // Doctor sees all assessments, potentially filtered
          const filter: any = {};
          if (req.query.userEmail) {
            const user = await User.findOne({ email: req.query.userEmail as string }).select('_id');
            if (user) {
              filter.userId = user._id;
            } else {
              // No user found with that email, return empty results
              return res.status(200).json({ assessments: [], totalAssessments: 0, totalPages: 0, currentPage: page });
            }
          }
          if (req.query.startDate || req.query.endDate) {
            filter.timestamp = {};
            if (req.query.startDate) {
                filter.timestamp.$gte = new Date(req.query.startDate as string);
            }
            if (req.query.endDate) {
                 // Add 1 day to include the end date
                const endDate = new Date(req.query.endDate as string);
                endDate.setDate(endDate.getDate() + 1);
                filter.timestamp.$lt = endDate;
            }
          }

          query = filter;
          totalAssessments = await Assessment.countDocuments(query);
          assessments = await Assessment.find(query)
            .populate('userId', 'name email') // Populate user name and email
            .sort({ timestamp: -1 }) // Sort by most recent
            .skip(skip)
            .limit(limit)
            .lean(); // Use lean for performance

        } else {
          // Regular user sees only their own assessments
          query = { userId: userId };
          totalAssessments = await Assessment.countDocuments(query);
          assessments = await Assessment.find(query)
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
        }

        const totalPages = Math.ceil(totalAssessments / limit);

        return res.status(200).json({ assessments, totalAssessments, totalPages, currentPage: page });

      } catch (error) {
        console.error('GET /api/assessments Error:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
      }

    default:
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
} 