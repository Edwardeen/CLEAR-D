import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/dbConnect';
import Hospital from '@/models/Hospital';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  await dbConnect();

  if (req.method === 'GET') {
    try {
      const { state, type, search, page = '1', limit = '10' } = req.query;
      
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
      
      // Add text search if provided
      if (search && typeof search === 'string') {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { address: { $regex: search, $options: 'i' } }
        ];
        
        // Try to also search in specialists
        // Note: this is complex because specialists can be a string or array
        // This approach will find matches in string specialists
        query.$or.push({ specialists: { $regex: search, $options: 'i' } });
      }

      // Pagination
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;
      
      // Execute query with pagination
      const hospitals = await Hospital.find(query)
        .sort({ state: 1, name: 1 })
        .skip(skip)
        .limit(limitNum);
      
      // Get total count for pagination
      const totalCount = await Hospital.countDocuments(query);
      const totalPages = Math.ceil(totalCount / limitNum);
      
      // Get unique states for filtering
      const states = await Hospital.distinct('state');
      
      res.status(200).json({
        hospitals,
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          totalPages,
        },
        filters: {
          states,
          types: ["Kerajaan", "Swasta", "Individual", "NGO", "Other"]
        }
      });
    } catch (error: any) {
      console.error('Error fetching hospitals:', error);
      res.status(500).json({ error: 'Failed to fetch hospitals' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 