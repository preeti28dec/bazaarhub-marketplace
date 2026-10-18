import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND = process.env.BACKEND_URL || 'http://localhost:4000';
const HOP_BY_HOP = ['host', 'connection', 'content-length', 'transfer-encoding', 'keep-alive'];

/** Forwards /api/* to the Node backend so the browser only ever talks to one origin. */
async function proxy(req: NextRequest, { params }: { params: { path: string[] } }) {
  const url = `${BACKEND}/api/${params.path.map(encodeURIComponent).join('/')}${req.nextUrl.search}`;
  const headers = new Headers(req.headers);
  HOP_BY_HOP.forEach((h) => headers.delete(h));

  const hasBody = !['GET', 'HEAD'].includes(req.method);
  try {
    const res = await fetch(url, {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      redirect: 'manual',
      cache: 'no-store',
    });
    const out = new Headers();
    res.headers.forEach((value, key) => {
      if (!['content-encoding', 'content-length', 'transfer-encoding', 'set-cookie'].includes(key)) out.set(key, value);
    });
    for (const cookie of res.headers.getSetCookie()) out.append('set-cookie', cookie);
    return new Response(res.body, { status: res.status, headers: out });
  } catch {
    return Response.json({ error: 'Service unavailable. Is the backend running?' }, { status: 503 });
  }
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as PUT, proxy as DELETE };
