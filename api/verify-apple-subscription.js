import { createPrivateKey, sign, randomUUID } from "node:crypto";
import { SignedDataVerifier, Environment } from "@apple/app-store-server-library";
import { getAppleRootCertificates } from "./apple-root-certificates.js";

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
  nonce: randomUUID(),
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
        const appleRootCertificates = await getAppleRootCertificates();

   const environments = [
  {
    name: "PRODUCTION",
    url: "https://api.storekit.itunes.apple.com",
    verifierEnvironment: Environment.PRODUCTION,
  },
  {
    name: "SANDBOX",
    url: "https://api.storekit-sandbox.itunes.apple.com",
    verifierEnvironment: Environment.SANDBOX,
  },
];

let appleData = null;
let selectedEnvironment = null;

for (const environment of environments) {
  const response = await fetch(
    `${environment.url}/inApps/v1/transactions/${transactionId}`,
    {
      headers: {
        Authorization: `Bearer ${appleToken}`,
        Accept: "application/json",
      },
    }
  );

  if (response.ok) {
    appleData = await response.json();
    selectedEnvironment = environment;
    break;
  }

  console.error(
    `Apple ${environment.name} HTTP status:`,
    response.status
  );

  // Une erreur 401 concerne l'authentification.
  // Inutile de tenter Sandbox avec le même jeton.
  if (response.status === 401) {
    return res.status(502).json({
      verified: false,
      premium: false,
      error: "Authentification Apple refusée",
    });
  }

  // Transaction absente en production :
  // essayer l'environnement Sandbox.
  if (response.status !== 404) {
    return res.status(502).json({
      verified: false,
      premium: false,
      error: "Vérification Apple indisponible",
    });
  }
}

if (!appleData || !selectedEnvironment) {
  return res.status(404).json({
    verified: false,
    premium: false,
    error: "Transaction introuvable chez Apple",
  });
}

if (typeof appleData.signedTransactionInfo !== "string") {
  return res.status(502).json({
    verified: false,
    premium: false,
    error: "Réponse Apple sans transaction signée",
  });
}
     
        const verifier = new SignedDataVerifier(
  appleRootCertificates,
  true,
  selectedEnvironment.verifierEnvironment,
  "com.adamtrustcompany.ChrysAdamApp54"
);

    const transaction = await verifier.verifyAndDecodeTransaction(
      appleData.signedTransactionInfo
    );

         const allowedProducts = [
      "com.adamtrustcompany.ChrysAdamApp54.fanpremium.monthly",
      "com.adamtrustcompany.ChrysAdamApp54.fanpremium.annual",
    ];

    if (!allowedProducts.includes(transaction.productId)) {
      return res.status(403).json({
        verified: false,
        premium: false,
        error: "Produit Apple non autorisé",
      });
    }

         const expiration = Number(transaction.expiresDate);

    if (
      !Number.isFinite(expiration) ||
      expiration <= Date.now() ||
      transaction.revocationDate != null
    ) {
      return res.status(403).json({
        verified: false,
        premium: false,
        error: "Abonnement expiré ou révoqué",
      });
    }
     
         if (String(transaction.transactionId) !== transactionId) {
      return res.status(403).json({
        verified: false,
        premium: false,
        error: "Identifiant de transaction non conforme",
      });
    }

         return res.status(503).json({
      verified: false,
      premium: false,
      error: "Rattachement de l'abonnement au compte à finaliser",
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
