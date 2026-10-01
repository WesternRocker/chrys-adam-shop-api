export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, recipient } = req.body;
    const items = req.body?.items;

if (
  !recipient ||
  typeof recipient.country_code !== 'string' ||
  !/^[A-Z]{2}$/.test(recipient.country_code) ||
  !recipient.address1?.trim() ||
  !recipient.city?.trim() ||
  !recipient.zip?.trim()
) {
  return res.status(400).json({
    error: 'Adresse de livraison invalide',
  });
}

if (!Array.isArray(items) || items.length === 0) {
  return res.status(400).json({
    error: 'Panier invalide',
  });
}

for (const item of items) {
  if (
    !Number.isInteger(item.productId) ||
    !Number.isInteger(item.quantity) ||
    item.quantity < 1 ||
    item.quantity > 20 ||
!Number.isInteger(item.variantId) ||
item.variantId <= 0
  ) {
    return res.status(400).json({
      error: 'Produit ou quantité invalide',
    });
  }
}

    const printfulResponse = await fetch(
  'https://api.printful.com/store/products?status=all',
  {
    headers: {
      Authorization: `Bearer ${process.env.PRINTFUL_TOKEN}`,
      Accept: 'application/json',
    },
  }
);

if (!printfulResponse.ok) {
  throw new Error('Impossible de vérifier le catalogue Printful');
}

const printfulData = await printfulResponse.json();
const printfulProducts = printfulData.result ?? [];
    let productsTotalCents = 0;
    const shippingItems = [];

for (const item of items) {
  const product = printfulProducts.find(
    (p) => Number(p.id) === item.productId
  );

  if (!product) {
    return res.status(400).json({
      error: 'Produit introuvable chez Printful',
    });
  }

  const detailResponse = await fetch(
    `https://api.printful.com/store/products/${product.id}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.PRINTFUL_TOKEN}`,
        Accept: 'application/json',
      },
    }
  );

  if (!detailResponse.ok) {
    throw new Error('Impossible de vérifier le produit Printful');
  }

  const detailData = await detailResponse.json();

  const variant = (detailData.result?.sync_variants ?? []).find(
    (v) => Number(v.id) === item.variantId
  );

  const price = Number(variant?.retail_price);
  const priceCents = Math.round(price * 100);

  if (
    !variant ||
    !Number.isFinite(price) ||
    price <= 0 ||
    !Number.isSafeInteger(priceCents)
  ) {
    return res.status(400).json({
      error: 'Variante ou prix invalide',
    });
  }

  productsTotalCents += priceCents * item.quantity;
  shippingItems.push({
  variant_id: Number(variant.variant_id),
  quantity: item.quantity,
});
}
// Sécurité provisoire : désactiver les nouveaux paiements
    const shippingResponse = await fetch(
  'https://api.printful.com/shipping/rates',
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PRINTFUL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recipient,
      items: shippingItems,
      currency: 'EUR',
      locale: 'en_US',
    }),
  }
);

if (!shippingResponse.ok) {
  return res.status(400).json({
    error: 'Impossible de calculer les frais de livraison Printful',
  });
}

const shippingData = await shippingResponse.json();
const availableShippingRates = shippingData.result ?? [];

if (!Array.isArray(availableShippingRates) || availableShippingRates.length === 0) {
  return res.status(400).json({
    error: 'Aucun mode de livraison disponible',
  });
}
// jusqu'à la validation des prix côté serveur.
return res.status(503).json({
  error: 'Paiements temporairement indisponibles.',
});
    const response = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        amount: String(amount),
        currency: 'eur',
        'automatic_payment_methods[enabled]': 'true',
      }).toString(),
    });

    const paymentIntent = await response.json();

    if (!response.ok) {
      console.error('Stripe error:', paymentIntent);
      return res.status(response.status).json({
        error: paymentIntent.error?.message || 'Stripe error',
      });
    }

    return res.status(200).json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error('PaymentIntent error:', error);

    return res.status(500).json({
      error: 'Unable to create payment',
    });
  }
}
