# Logos des agents Norva

5 logos SVG simples pour distinguer tes agents dans multica.

## Fichiers

| # | Agent | Fichier | Couleur |
|---|-------|---------|---------|
| 1 | Lead Intake | `01-lead-intake.svg` | Indigo `#6366F1` |
| 2 | Enrichissement | `02-enrichissement.svg` | Violet `#A855F7` |
| 3 | Premier Contact | `03-premier-contact.svg` | Bleu `#3B82F6` |
| 4 | Audit Site | `04-audit-site.svg` | Vert `#22C55E` |
| 5 | Re-scoring Deal | `05-rescoring-deal.svg` | Orange `#F97316` |

## Format

- **SVG** vectoriel, viewBox 512×512
- Coins arrondis (rayon 96) — s'intègre proprement comme avatar carré
- Couleur de fond unique par agent (codée en dur)
- Icône blanche centrée, lisible en petit format (32×32 et plus)

## Comment les utiliser dans multica

1. Page de l'agent dans multica
2. Clic sur l'avatar par défaut (le robot 🤖)
3. Upload → choisis le SVG correspondant
4. Save

Si multica n'accepte pas le SVG (certaines plateformes demandent
PNG/JPG), convertis avec :

- **CloudConvert** : <https://cloudconvert.com/svg-to-png>
- **Sur ta machine** *(si tu as `inkscape` ou `magick`)* :

      inkscape --export-type=png --export-filename=01.png 01-lead-intake.svg

  Ou :

      magick convert -background none -resize 512x512 01-lead-intake.svg 01.png

- **En ligne via Figma** : drag-drop le SVG, export en PNG depuis le menu

## Pour les futurs agents (roadmap)

Si tu veux que je dessine les logos pour les 5 agents roadmap
(Suivi Pipeline, Réactivation, Onboarding Won, Devis Generator,
Veille Signaux), dis-le.

Idées d'icônes par agent :

| Agent | Couleur suggérée | Icône suggérée |
|-------|------------------|----------------|
| Suivi Pipeline | Cyan `#06B6D4` | Calendrier avec cloche |
| Réactivation Dormants | Rose `#EC4899` | Coeur qui se réveille / sablier |
| Onboarding Won | Doré `#EAB308` | Trophée + checklist |
| Devis Generator | Émeraude `#10B981` | Document avec € |
| Veille Signaux | Rouge `#EF4444` | Antenne / radar pulsant |
