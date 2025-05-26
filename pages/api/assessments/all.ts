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
    const limit = parseInt(req.query.limit as string) || 256;
    const skip = (page - 1) * limit;

    // Add sorting functionality
    const sortField = req.query.sortField as string;
    const sortOrder = req.query.sortOrder as string; // 'asc' or 'desc'
    
    // Default sort: newest first
    let sortOptions: any = { createdAt: -1 }; 
    
    const allowedSortFields = [
      'timestamp', 'createdAt', 'totalScore', 'glaucomaScore', 'cancerScore', 
      'userId.name', 'userId.email', 'type'
    ];
    
    if (sortField && allowedSortFields.includes(sortField)) {
      // Handle special cases for userId fields
      if (sortField === 'userId.name' || sortField === 'userId.email') {
        // These will be handled after fetching data
        console.log(`Special sorting field detected: ${sortField}. Will handle after fetch.`);
      } 
      // Handle date fields and score fields directly in sortOptions
      else if (sortField === 'timestamp' || sortField === 'createdAt') {
        sortOptions = { 'createdAt': sortOrder === 'asc' ? 1 : -1 };
      }
      else { // This will now also handle totalScore, glaucomaScore, cancerScore, and type
        sortOptions = { [sortField]: sortOrder === 'asc' ? 1 : -1 };
      }
    }

    try {
      // Add filtering params similar to the main assessments endpoint if needed
      let query: any = {};
      
      // Add type filter
      if (req.query.type && typeof req.query.type === 'string') {
        query.type = req.query.type;
      }
      
      // Add date range filters
      if (req.query.startDate || req.query.endDate) {
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
          query.createdAt = dateFilter;
        }
      }
      
      const totalAssessments = await Assessment.countDocuments(query);

      let assessments = await Assessment.find(query)
        .populate({
          path: 'userId',
          select: 'name email icPassportNo', 
          model: User 
        })
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean();
        
      // LOGGING FOR DEBUGGING icPassportNo
      if (assessments && assessments.length > 0 && assessments[0].userId) {
        console.log('API /api/assessments/all.ts - First populated userId:', JSON.stringify(assessments[0].userId, null, 2));
      }
      // END LOGGING

      // Post-fetch sorting for special fields (ONLY userId.name and userId.email)
      if (sortField) {
        // Handle userId.name sorting
        if (sortField === 'userId.name') {
          assessments.sort((a, b) => {
            let valA = '';
            let valB = '';

            if (a.userId && typeof a.userId === 'object' && 'name' in a.userId) {
              if (typeof a.userId.name === 'string') {
                valA = a.userId.name.toLowerCase();
              } else if (a.userId.name && typeof a.userId.name === 'object') {
                valA = `${(a.userId.name as { first?: string }).first || ''} ${(a.userId.name as { last?: string }).last || ''}`.trim().toLowerCase();
              }
            }
            
            if (b.userId && typeof b.userId === 'object' && 'name' in b.userId) {
              if (typeof b.userId.name === 'string') {
                valB = b.userId.name.toLowerCase();
              } else if (b.userId.name && typeof b.userId.name === 'object') {
                valB = `${(b.userId.name as { first?: string }).first || ''} ${(b.userId.name as { last?: string }).last || ''}`.trim().toLowerCase();
              }
            }

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
          });
        }
        
        // Handle userId.email sorting
        else if (sortField === 'userId.email') {
          assessments.sort((a, b) => {
            let valA = '';
            let valB = '';

            if (a.userId && typeof a.userId === 'object' && 'email' in a.userId) {
              valA = (a.userId as { email?: string }).email?.toLowerCase() || '';
            }
            
            if (b.userId && typeof b.userId === 'object' && 'email' in b.userId) {
              valB = (b.userId as { email?: string }).email?.toLowerCase() || '';
            }

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
          });
        }
      }

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