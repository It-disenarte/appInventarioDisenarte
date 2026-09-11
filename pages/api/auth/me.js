import { getSessionFromReq } from '../../../lib/auth';

export default function handler(req, res) {
  const session = getSessionFromReq(req);
  res.status(200).json({ user: session ? { id: session.id, email: session.email, name: session.name, role: session.role } : null });
}
