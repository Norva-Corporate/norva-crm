/** @type {import('next').NextConfig} */
const nextConfig = {
  // Externaliser puppeteer-core + @sparticuz/chromium pour la génération
  // PDF (briefs ET invoices/devis — même pattern HTML → Puppeteer).
  // Le binary chromium n'est PAS bundlé : @sparticuz/chromium télécharge
  // le pack.tar depuis GitHub Releases au runtime via executablePath(url).
  // serverExternalPackages empêche Turbopack de tree-shake la lib JS.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
};

export default nextConfig;
