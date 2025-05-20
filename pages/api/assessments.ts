import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import dbConnect from '../../lib/dbConnect';
import Assessment from '../../models/Assessment';
import User from '../../models/User';
import mongoose from 'mongoose';
import { authOptions } from './auth/[...nextauth]';

// Helper function to generate risk filter conditions
const generateRiskFilterConditions = (
  assessmentType: string,
  scoreRanges: { gte?: number; lte?: number; gt?: number; lt?: number }
): any[] => {
  const conditions: any[] = [];
  const scoreQuery: any = {};

  if (scoreRanges.gte !== undefined) scoreQuery.$gte = scoreRanges.gte;
  if (scoreRanges.lte !== undefined) scoreQuery.$lte = scoreRanges.lte;
  if (scoreRanges.gt !== undefined) scoreQuery.$gt = scoreRanges.gt;
  if (scoreRanges.lt !== undefined) scoreQuery.$lt = scoreRanges.lt;

  // Condition for new format (type + totalScore)
  conditions.push({
    type: assessmentType,
    totalScore: scoreQuery,
  });

  // Condition for old format (specific score field, e.g., glaucomaScore or cancerScore)
  const oldScoreField = assessmentType === 'glaucoma' ? 'glaucomaScore' : 'cancerScore';
  conditions.push({
    [oldScoreField]: scoreQuery,
  });

  return conditions;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log("--- Handling /api/assessments request ---");
  console.log("Request Method:", req.method);

  // Get user session
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user?.id) {
    console.error("getSession failed or returned invalid session");
    return res.status(401).json({ message: 'Unauthorized' });
  }

  console.log("Session valid, user ID:", session.user.id);

  await dbConnect();

  const userId = new mongoose.Types.ObjectId(session.user.id);
  const userRole = session.user.role;

  // Enhanced Logging for Doctor Role & User Query Params
  console.log("API /api/assessments - Session User Role:", userRole);
  console.log("API /api/assessments - Query User Email Param:", req.query.userEmail);
  console.log("API /api/assessments - Query User ID Param:", req.query.userId);

  switch (req.method) {
    case 'GET':
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        // --- Sorting Logic --- 
        const sortField = req.query.sortField as string;
        const sortOrder = req.query.sortOrder as string; // 'asc' or 'desc'

        let sortOptions: any = { createdAt: -1 }; // Default sort: newest first

        const allowedSortFields = [
          'timestamp', 'createdAt', 'totalScore', 'glaucomaScore', 'cancerScore', 
          'userId.name', 'userId.email', 'type'
        ];

        if (sortField && allowedSortFields.includes(sortField)) {
          sortOptions = { [sortField]: sortOrder === 'asc' ? 1 : -1 };
        }
        
        let query: any = {};
        const andConditions: any[] = [];
        
        if (userRole === 'doctor') {
          // Doctor can see all assessments with filters
          
          if (req.query.userEmail) {
            const user = await User.findOne({ email: req.query.userEmail as string }).select('_id');
            if (user) {
              andConditions.push({ userId: user._id });
            } else {
              return res.status(200).json({ 
                assessments: [], 
                totalAssessments: 0, 
                totalPages: 0, 
                currentPage: page 
              });
            }
          }
          
          if (req.query.userId && mongoose.Types.ObjectId.isValid(req.query.userId as string)) {
            andConditions.push({ userId: new mongoose.Types.ObjectId(req.query.userId as string) });
          }
          
          const dateFilter: any = {};
          if (req.query.startDate) {
            dateFilter.$gte = new Date(req.query.startDate as string);
          }
          if (req.query.endDate) {
            const endDateObj = new Date(req.query.endDate as string);
            endDateObj.setDate(endDateObj.getDate() + 1);
            dateFilter.$lt = endDateObj;
          }
          if (Object.keys(dateFilter).length > 0) {
            andConditions.push({ createdAt: dateFilter });
          }

          if (req.query.type && typeof req.query.type === 'string' && req.query.type.trim() !== '') {
            andConditions.push({ type: req.query.type.trim() });
          }

          const minScoreRaw = req.query.minScore as string;
          const typeForScoreFilter = req.query.type as string; // Use the type from the illness filter if present

          if (minScoreRaw) {
            const minScore = parseFloat(minScoreRaw);
            if (!isNaN(minScore) && minScore > 0) {
              let scoreFilterConditions: any[] = [];
              if (typeForScoreFilter && typeForScoreFilter.trim() !== '') {
                scoreFilterConditions = generateRiskFilterConditions(typeForScoreFilter.trim(), { gte: minScore });
              } else {
                scoreFilterConditions = [
                  { totalScore: { $gte: minScore } },
                  { glaucomaScore: { $gte: minScore } },
                  { cancerScore: { $gte: minScore } }
                ];
              }
              if (scoreFilterConditions.length > 0) {
                andConditions.push({ $or: scoreFilterConditions });
              }
            }
          }
          
          if (andConditions.length > 0) {
            query.$and = andConditions;
          }

        } else {
          // Regular user sees only their own assessments
          query.userId = userId; // This is for non-doctor roles
          
          if (req.query.assessmentId && mongoose.Types.ObjectId.isValid(req.query.assessmentId as string)) {
            query._id = new mongoose.Types.ObjectId(req.query.assessmentId as string);
          }
        }
        
        console.log("API /api/assessments - Final query before countDocuments:", JSON.stringify(query, null, 2));
        console.log("API /api/assessments - Querying for userId:", query.userId ? query.userId.toString() : 'Not specified (all users for doctor if no email filter)');
        
        const totalAssessments = await Assessment.countDocuments(query);
        console.log("API /api/assessments - Total assessments found by countDocuments:", totalAssessments);
        
        let assessments: any[] = []; // Explicitly typed
        if (totalAssessments > 0) {
          assessments = await Assessment.find(query)
            .populate('userId', 'name email') 
            .sort(sortOptions)
            .skip(skip)
            .limit(limit)
            .lean();
          console.log("API /api/assessments - Assessments fetched by find (first 5 if many):", JSON.stringify(assessments.slice(0,5), null, 2));
        } else {
          console.log("API /api/assessments - No assessments to fetch via find() as count is 0.");
        }
        
        const totalPages = Math.ceil(totalAssessments / limit);

        return res.status(200).json({ 
          assessments, 
          totalAssessments, 
          totalPages, 
          currentPage: page 
        });

      } catch (error) {
        console.error('GET /api/assessments Error:', error);
        // Log the query that caused the error if possible
        if (error instanceof Error && 'query' in error) { // Check if query is a property of the error
            console.error('GET /api/assessments Error Query:', JSON.stringify((error as any).query, null, 2));
        }
        return res.status(500).json({ message: 'Internal Server Error', error: String(error) });
      }

    default:
      res.setHeader('Allow', ['GET']);
      return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }
} 