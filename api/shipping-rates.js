export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
    });
  }

  try {
    const { recipient, items } = req.body;

    if (
      !recipient ||
      !recipient.country_code ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        error: 'Invalid shipping data',
      });
    }

    const cleanItems = items.map((item) => ({
      variant_id: Number(item.variant_id),
      quantity: Number(item.quantity),
    }));

    if (
      cleanItems.some(
        (item) =>
          !Number.isInteger(item.variant_id) ||
          item.variant_id <= 0 ||
          !Number.isInteger(item.quantity) ||
          item.quantity <= 0
      )
    ) {
      return res.status(400).json({
        error: 'Invalid items',
      });
    }

    const response = await fetch(
      'https://api.printful.com/shipping/rates',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.PRINTFUL_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient: {
            name: recipient.name || '',
            address1: recipient.address1 || '',
            address2: recipient.address2 || '',
            city: recipient.city || '',
            country_code: recipient.country_code,
            zip: recipient.zip || '',
            phone: recipient.phone || '',
            email: recipient.email || '',
          },
          items: cleanItems,
          currency: 'EUR',
          locale: 'en_US',
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Printful shipping error:', data);

      return res.status(response.status).json({
        error:
          data?.error?.message ||
          data?.result ||
          'Unable to calculate shipping rates',
      });
    }

    return res.status(200).json({
      rates: data.result || [],
    });
  } catch (error) {
    console.error('Shipping rates error:', error);

    return res.status(500).json({
      error: 'Unable to calculate shipping rates',
    });
  }
}
