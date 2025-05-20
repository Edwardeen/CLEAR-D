import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/dbConnect';
import Counselor from '@/models/Counselor';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  await dbConnect();

  if (req.method === 'GET') {
    try {
      const { state, type, search, specialization, page = '1', limit = '10' } = req.query;
      
      // Build query
      const query: Record<string, any> = {};
      
      // Filter by state if provided
      if (state && typeof state === 'string') {
        query.state = state;
      }
      
      // Filter by type if provided
      if (type && typeof type === 'string') {
        query.type = type;
      }

      // Filter by specialization if provided
      if (specialization && typeof specialization === 'string') {
        query.specializations = { $regex: specialization, $options: 'i' };
      }
      
      // Add text search if provided
      if (search && typeof search === 'string') {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { address: { $regex: search, $options: 'i' } },
          { specializations: { $regex: search, $options: 'i' } },
          { languages: { $regex: search, $options: 'i' } }
        ];
      }

      // Pagination
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;
      
      // Execute query with pagination
      const counselors = await Counselor.find(query)
        .sort({ state: 1, name: 1 })
        .skip(skip)
        .limit(limitNum);
      
      // Get total count for pagination
      const totalCount = await Counselor.countDocuments(query);
      const totalPages = Math.ceil(totalCount / limitNum);
      
      // Get unique states and specializations for filtering
      const states = await Counselor.distinct('state');
      const specializations = await Counselor.distinct('specializations');
      
      res.status(200).json({
        counselors,
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          totalPages,
        },
        filters: {
          states,
          types: ["Kerajaan", "Swasta", "Individual", "NGO", "Other"],
          specializations
        }
      });
    } catch (error: any) {
      console.error('Error fetching counselors:', error);
      res.status(500).json({ error: 'Failed to fetch counselors' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 