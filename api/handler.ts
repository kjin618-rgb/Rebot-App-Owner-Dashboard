import { handleApiRequest } from '../src/lib/api-handlers';

export default async function handler(req: any, res: any) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true, imported: true }));
}
