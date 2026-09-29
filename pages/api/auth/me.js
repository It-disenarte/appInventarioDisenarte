import { getSessionFromReq } from '../../../lib/auth';

export default async function handler(req, res) {
  const session = await getSessionFromReq(req);
  res.status(200).json({ user: session });
}
