export default async function handler(req: any, res: any) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    ok: true,
    url: req.url,
    node: process.version,
    supabase_url: !!process.env.SUPABASE_URL,
    supabase_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  }));
}
