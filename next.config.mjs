/** @type {import('next').NextConfig} */
const nextConfig = {
  // Externaliser les packages serveur qui ne doivent PAS être bundlés par Turbopack :
  // - @react-pdf/renderer : génération PDF invoices/devis (déjà en place)
  // - puppeteer-core + @sparticuz/chromium : génération PDF briefs (le binary
  //   chromium ne doit pas être tree-shaké sinon executablePath() pointe sur
  //   un fichier inexistant → 500 au runtime)
  serverExternalPackages: [
    "@react-pdf/renderer",
    "puppeteer-core",
    "@sparticuz/chromium",
  ],
};

export default nextConfig;
