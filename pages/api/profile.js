import { prisma } from '../../lib/prisma';
import { getSessionFromReq } from '../../lib/auth';

// Preferencias del propio usuario (cualquier rol). Por ahora: mostrar o no el asistente de uso.
export default async function handler(req, res) {
  const session = await getSessionFromReq(req);
  if (!session) return res.status(401).json({ error: 'No autenticado.' });

  if (req.method === 'PATCH') {
    const { showGuide } = req.body || {};
    if (typeof showGuide !== 'boolean') return res.status(400).json({ error: 'Valor inválido.' });
    const user = await prisma.user.update({ where: { id: session.id }, data: { showGuide }, select: { id: true, email: true, name: true, role: true, showGuide: true } });
    return res.status(200).json({ user });
  }

  res.status(405).end();
}
