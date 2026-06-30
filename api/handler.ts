import { getStore } from '../src/lib/db-server';

export default async function handler(req: any, res: any) {
  try {
    const reqUrl = new URL(req.url, 'http://localhost');
    const path = reqUrl.pathname;
    const m = path.match(/^\/api\/store\/([^/]+)$/);
    if (m) {
      const store = await getStore(m[1]);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(store));
      return;
    }
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'not found', path }));
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: String(err?.message ?? err) }));
  }
}
