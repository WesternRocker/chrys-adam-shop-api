export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Méthode non autorisée",
    });
  }

  // La vérification Apple sera intégrée ici.
  // Aucun abonnement n'est validé pour le moment.
  return res.status(503).json({
    verified: false,
    premium: false,
    error: "Validation Apple non configurée",
  });
}
