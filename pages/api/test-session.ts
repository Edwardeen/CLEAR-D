import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]'; // Adjust path if needed, likely correct for API routes

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    console.log('[API Test Session] No session found');
    return res.status(401).json({ message: 'Unauthorized', session });
  }

  console.log('[API Test Session] Session found:', JSON.stringify(session, null, 2));
  res.status(200).json({ message: 'Success', session });
} 