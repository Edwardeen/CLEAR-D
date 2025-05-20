import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '../../../lib/dbConnect';
import ServerSetting from '../../../models/ServerSetting';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const internalSecret = process.env.INTERNAL_STATUS_SECRET_KEY;
  if (!internalSecret) {
     console.error('INTERNAL_STATUS_SECRET_KEY not defined in the API route environment.');
     // If the secret isn't configured on the API side, we can't validate, posing a security risk if we proceed.
     // It's safer to deny the request. The middleware will then use its cached value.
     return res.status(500).json({ error: 'Internal configuration error: Secret not set' });
  }

  const providedSecret = req.headers['x-internal-status-secret'];
  if (providedSecret !== internalSecret) {
    console.warn('Attempt to access internal status API without valid secret or with incorrect secret.');
    return res.status(403).json({ message: 'Forbidden' });
  }

  try {
    await dbConnect();
    const serverSetting = await ServerSetting.findOne({ key: 'global_server_status' });
    // Default to true (online) if no setting is found in the database
    const isOnline = serverSetting ? serverSetting.isServiceGloballyActive : true; 
    return res.status(200).json({ isServiceGloballyActive: isOnline });
  } catch (error) {
    console.error('Error fetching server status for internal API:', error);
    // If there's a database error, default to true (online) to prevent accidental full site outage.
    // The middleware will log that it's using a cached value if this fetch fails.
    return res.status(500).json({ 
      error: 'Failed to fetch status from database', 
      isServiceGloballyActive: true // Fail-safe to online
    });
  }
} 