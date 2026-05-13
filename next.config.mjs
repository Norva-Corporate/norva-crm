/** @type {import('next').NextConfig} */
const nextConfig = {
  // Externaliser les packages serveur qui ne doivent PAS être bundlés par Turbopack :
  // - @react-pdf/renderer : génération PDF invoices/devis (déjà en place)
  // - puppeteer-core + @sparticuz/chromium : génération PDF briefs.
  //   Le binary chromium n'est PAS bundlé — on utilise le mode "URL" qui
  //   télécharge le pack.tar depuis GitHub Releases au runtime (voir
  //   src/lib/briefs/generate-pdf.ts). serverExternalPackages reste
  //   nécessaire pour que la lib chromium ne soit pas tree-shakée.
  serverExternalPackages: [
    "@react-pdf/renderer",
    "puppeteer-core",
    "@sparticuz/chromium",
  ],
};

export default nextConfig;
