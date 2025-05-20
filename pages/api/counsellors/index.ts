import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/dbConnect';
import Counsellor, { ICounsellor } from '@/models/Counsellor';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  await dbConnect();

  if (req.method === 'GET') {
    try {
      // Can add filtering by specialty later if needed, e.g., req.query.specialty
      const counsellors = await Counsellor.find({})
                                          .sort({ name: 1 }) // Sort by name
                                          .limit(100) // Limit results for now
                                          .lean();
      
      res.status(200).json({ counsellors });

    } catch (error: any) {
      console.error("Error fetching counsellors:", error);
      res.status(500).json({ message: 'Failed to fetch counsellors', error: error.message });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 