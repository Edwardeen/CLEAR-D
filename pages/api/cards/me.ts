import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/dbConnect';
import Card, { ICard } from '@/models/Card';
import { getSession } from 'next-auth/react';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getSession({ req });
  if (!session || !session.user?.id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const userId = session.user.id;

  await dbConnect();

  if (req.method === 'GET') {
    try {
      const userCards = await Card.find({ userId: userId })
                                  .sort({ issueDate: -1 }) // Show most recent first
                                  .lean();

      res.status(200).json({ cards: userCards });

    } catch (error: any) {
      console.error("Error fetching user's CLEAR-D Cards:", error);
      res.status(500).json({ message: 'Failed to fetch user cards', error: error.message });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 