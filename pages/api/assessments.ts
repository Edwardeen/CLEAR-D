import type { NextApiRequest, NextApiResponse } from 'next';
import { unstable_getServerSession } from 'next-auth/next';
import dbConnect from '../../lib/dbConnect';
import Assessment, { IAssessment, IFormData } from '../../models/Assessment';
import User from '../../models/User'; // Needed for populating user info
import { calculateRisk } from '../../utils/riskCalculator';
import { getOverallRecommendations } from '../../utils/recommendations';
import mongoose from 'mongoose';
import { authOptions } from './auth/[...nextauth]';

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

  const session = await unstable_getServerSession(req, res, authOptions);

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
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        // --- Sorting Logic --- 
        const sortField = req.query.sortField as string;
        const sortOrder = req.query.sortOrder as string; // 'asc' or 'desc'

        let sortOptions: any = { timestamp: -1 }; // Default sort: newest first

        // Define allowed sort fields to prevent arbitrary sorting
        const allowedSortFields = [
          'timestamp', 'glaucomaScore', 'cancerScore', 
          'userId.name', 'userId.email' // For populated fields
        ];

        if (sortField && allowedSortFields.includes(sortField)) {
          // Need special handling for populated fields if using aggregation
          // For simple sort on populated fields, Mongoose might handle it directly
          // in .sort() if the path is correct after population.
          sortOptions = { [sortField]: sortOrder === 'asc' ? 1 : -1 };
        } else if (sortField) {
          console.warn(`Attempted to sort by invalid field: ${sortField}`);
          // Keep default sort if field is invalid
        }
        // --- End Sorting Logic ---
        
        let query = {};
        let totalAssessments = 0;
        let queryBuilder;

        if (userRole === 'doctor') {
          const filter: any = {};
          
          // Filter by email
          if (req.query.userEmail) {
            const user = await User.findOne({ email: req.query.userEmail as string }).select('_id');
            if (user) {
              filter.userId = user._id;
            } else {
              // No user found with that email, return empty results
              return res.status(200).json({ assessments: [], totalAssessments: 0, totalPages: 0, currentPage: page });
            }
          }
          
          // Filter by specific userId if provided (useful for showing a specific patient's history)
          if (req.query.userId && mongoose.Types.ObjectId.isValid(req.query.userId as string)) {
            filter.userId = new mongoose.Types.ObjectId(req.query.userId as string);
          }
          
          // Filter by date range
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
          
          queryBuilder = Assessment.find(query)
            .populate('userId', 'name email') // Populate user data
            .sort(sortOptions) // Apply dynamic sort
            .skip(skip)
            .limit(limit)
            .lean(); 

        } else {
          // Regular user sees only their own assessments
          query = { userId: userId };
          
          // If specific assessmentId is provided to get a specific one
          if (req.query.assessmentId && mongoose.Types.ObjectId.isValid(req.query.assessmentId as string)) {
            query = { 
              ...query, 
              _id: new mongoose.Types.ObjectId(req.query.assessmentId as string) 
            };
          }
          
          totalAssessments = await Assessment.countDocuments(query);
          queryBuilder = Assessment.find(query)
            // Apply default sort or allow user-specific sorting if needed later
            .sort({ timestamp: -1 }) 
            .skip(skip)
            .limit(limit)
            .lean();
        }
        
        const assessments = await queryBuilder; // Execute the query

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