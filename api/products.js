export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = process.env.PRINTFUL_TOKEN;

  if (!token) {
    return res.status(500).json({
      error: 'PRINTFUL_TOKEN is not configured on the server',
    });
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };

  try {
    // 1. Récupération de la liste des produits
    const response = await fetch(
      'https://api.printful.com/store/products?status=all',
      { headers }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Printful API error',
        details: data,
      });
    }

    const products = data.result ?? [];

    // TEST - styles de mockups disponibles pour le T-shirt

  if (req.query.mockups === 'generate') {
  const mockupResponse = await fetch(
    'https://api.printful.com/v2/mockup-tasks',
    {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        format: 'jpg',
        mockup_width_px: 1000,
        products: [
          {
            source: 'catalog',
            catalog_product_id: 456,
            catalog_variant_ids: [11864],
            mockup_style_ids: [6094, 6095, 6098, 6099],
            placements: [
              {
                placement: 'front',
                technique: 'dtg',
                layers: [
                  {
                    type: 'file',
                    url: 'https://files.cdn.printful.com/files/6e8/6e81090fa346321188561a9d7faab5e3_preview.png',
                  },
                ],
              },
            ],
          },
        ],
      }),
    }
  );

  const mockupData = await mockupResponse.json();

  return res.status(mockupResponse.status).json(mockupData);
}
    
    const mockupStylesResponse = await fetch(
  'https://api.printful.com/v2/catalog-products/456/mockup-styles',
  { headers }
);

const mockupStylesData = await mockupStylesResponse.json();

    // 2. Récupération des détails + variantes + prix
    const detailedProducts = await Promise.all(
      products.map(async (product) => {
        const detailResponse = await fetch(
          `https://api.printful.com/store/products/${product.id}`,
          { headers }
        );

        const detailData = await detailResponse.json();

        if (!detailResponse.ok) {
          return {
            ...product,
            sync_variants: [],
          };
        }

        const syncProduct =
          detailData.result?.sync_product ?? product;

        const syncVariants =
          detailData.result?.sync_variants ?? [];

        const prices = syncVariants
          .map((variant) => parseFloat(variant.retail_price))
          .filter((price) => !Number.isNaN(price));

        return {
          ...syncProduct,
          sync_variants: syncVariants,
          price:
            prices.length > 0
              ? Math.min(...prices).toFixed(2)
              : null,
        };
      })
    );

    return res.status(200).json({
      ok: true,
      products: detailedProducts,
      paging: data.paging ?? null,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Unable to contact Printful',
      message:
        error instanceof Error
          ? error.message
          : String(error),
    });
  }
}
