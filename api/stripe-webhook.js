import crypto from 'node:crypto';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
    });
  }

  const secrets = [
  process.env.STRIPE_WEBHOOK_SECRET,
  process.env.STRIPE_WEBHOOK_TEST_SECRET,
].filter(Boolean);
  const signature = req.headers['stripe-signature'];

  if (!secret || !signature) {
    return res.status(400).json({
      error: 'Webhook configuration missing',
    });
  }

  try {
    const chunks = [];

    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk));
    }

    const payload = Buffer.concat(chunks);
    const signedPayload = String(signature);
    const elements = signedPayload.split(',');

    const timestamp = elements
      .find((part) => part.startsWith('t='))
      ?.slice(2);

    const signatures = elements
      .filter((part) => part.startsWith('v1='))
      .map((part) => part.slice(3));

    if (!timestamp || signatures.length === 0) {
      return res.status(400).json({
        error: 'Invalid Stripe signature',
      });
    }

    const age = Math.abs(
      Math.floor(Date.now() / 1000) - Number(timestamp)
    );

    if (!Number.isFinite(age) || age > 300) {
      return res.status(400).json({
        error: 'Expired Stripe signature',
      });
    }

    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${payload.toString('utf8')}`)
      .digest();

    const valid = signatures.some((value) => {
      if (!/^[a-f0-9]{64}$/i.test(value)) return false;

      const received = Buffer.from(value, 'hex');

      return crypto.timingSafeEqual(expected, received);
    });

    if (!valid) {
      return res.status(400).json({
        error: 'Signature verification failed',
      });
    }

    const event = JSON.parse(payload.toString('utf8'));

    if (event.type === 'payment_intent.succeeded') {
      console.log(
        'Stripe payment confirmed:',
        event.data.object.id
      );

      // Prochaine étape :
      // enregistrer la commande de façon persistante,
      // puis créer un brouillon Printful une seule fois.
      // Aucune commande Printful n'est créée ici.
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);

    return res.status(400).json({
      error: 'Invalid webhook payload',
    });
  }
}
