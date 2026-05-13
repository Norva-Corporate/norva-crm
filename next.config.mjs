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
  // Inclure le dossier bin/ de @sparticuz/chromium dans le lambda Vercel
  // de la route PDF. Sans ça, le tracing Next.js n'embarque pas les
  // archives .br (chromium.br, fonts.tar.br, swiftshader.tar.br, al2023.tar.br)
  // et le binary est introuvable au runtime → ENOENT sur /var/task/.../bin
  outputFileTracingIncludes: {
    "/api/briefs/[id]/pdf": [
      "./node_modules/@sparticuz/chromium/bin/**/*",
    ],
  },
};

export default nextConfig;
