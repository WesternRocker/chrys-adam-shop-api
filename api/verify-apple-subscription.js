import { createPrivateKey, sign } from "node:crypto";
import { SignedDataVerifier, Environment } from "@apple/app-store-server-library";

function createAppleToken() {
  const issuerId = process.env.APPLE_IAP_ISSUER_ID;
  const keyId = process.env.APPLE_IAP_KEY_ID;
  const privateKey = process.env.APPLE_IAP_PRIVATE_KEY;

  if (!issuerId || !keyId || !privateKey) {
    throw new Error("Configuration Apple incomplète");
  }

  const now = Math.floor(Date.now() / 1000);

  const encode = (data) =>
    Buffer.from(JSON.stringify(data)).toString("base64url");

  const header = encode({
    alg: "ES256",
    kid: keyId,
    typ: "JWT",
  });

  const payload = encode({
  iss: issuerId,
  iat: now,
  exp: now + 300,
  aud: "appstoreconnect-v1",
  bid: "com.adamtrustcompany.ChrysAdamApp54",
});

  const message = `${header}.${payload}`;

  const signature = sign(
    "sha256",
    Buffer.from(message),
    {
      key: createPrivateKey(privateKey.replace(/\\n/g, "\n")),
      dsaEncoding: "ieee-p1363",
    }
  ).toString("base64url");

  return `${message}.${signature}`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Méthode non autorisée",
    });
  }

   try {
    const { transactionId } = req.body || {};

    if (typeof transactionId !== "string" ||
        !/^\d{1,30}$/.test(transactionId)) {
      return res.status(400).json({
        verified: false,
        premium: false,
        error: "Identifiant de transaction Apple invalide",
      });
    }

        const appleToken = createAppleToken();

    const appleResponse = await fetch(
      `https://api.storekit.itunes.apple.com/inApps/v1/transactions/${transactionId}`,
      {
        headers: {
          Authorization: `Bearer ${appleToken}`,
          Accept: "application/json",
        },
      }
    );

    if (!appleResponse.ok) {
      return res.status(502).json({
        verified: false,
        premium: false,
        error: "Transaction non confirmée par Apple",
      });
    }

    return res.status(503).json({
      verified: false,
      premium: false,
      error: "Vérification cryptographique à finaliser",
    });
  } catch (error) {
    console.error("Configuration Apple indisponible");

    return res.status(503).json({
      verified: false,
      premium: false,
      error: "Service Apple indisponible",
    });
  }
}
