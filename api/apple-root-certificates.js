const APPLE_ROOT_CERTIFICATE_URLS = [
  "https://www.apple.com/certificateauthority/AppleRootCA-G3.cer",
  "https://www.apple.com/appleca/AppleIncRootCertificate.cer",
];

export async function getAppleRootCertificates() {
  const certificates = await Promise.all(
    APPLE_ROOT_CERTIFICATE_URLS.map(async (url) => {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Téléchargement du certificat Apple impossible");
      }

      return Buffer.from(await response.arrayBuffer());
    })
  );

  return certificates;
}
