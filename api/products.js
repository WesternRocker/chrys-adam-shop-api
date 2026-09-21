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

  if (req.query.mockups === 'result') {
  const resultResponse = await fetch(
    'https://api.printful.com/v2/mockup-tasks?id=972123004',
    { headers }
  );

  const resultData = await resultResponse.json();

  return res.status(resultResponse.status).json(resultData);
}  

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

        const mockupImages =
  product.id === 474053427
    ? [
        'https://printful-upload.s3-accelerate.amazonaws.com/tmp/1ec8e578465f98d102603a09b392145d/unisex-organic-cotton-creator-2.0-t-shirt-white-front-6ab14e19531f3.jpg',
        'https://printful-upload.s3-accelerate.amazonaws.com/tmp/84064e65ac6f46238d54d7b077207963/unisex-organic-cotton-creator-2.0-t-shirt-white-back-6ab14e19539da.jpg',
        'https://printful-upload.s3-accelerate.amazonaws.com/tmp/16c32c3f4b5fa1729714db310096dea4/unisex-organic-cotton-creator-2.0-t-shirt-white-left-front-6ab14e1953c31.jpg',
        'https://printful-upload.s3-accelerate.amazonaws.com/tmp/8b6819eac930ea3b421fce8449e3aaa1/unisex-organic-cotton-creator-2.0-t-shirt-white-right-front-6ab14e1953da2.jpg',
      ]
    : [];

       return {
  ...syncProduct,
  sync_variants: syncVariants,
  mockup_images: mockupImages,
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
