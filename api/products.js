export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.PRINTFUL_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'PRINTFUL_TOKEN is not configured on the server' });
  }

  try {
    const response = await fetch('https://api.printful.com/store/products?status=all', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Printful API error',
        details: data,
      });
    }

    return res.status(200).json({
      ok: true,
      products: data.result ?? [],
      paging: data.paging ?? null,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Unable to contact Printful',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
