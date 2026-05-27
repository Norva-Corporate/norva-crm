---
name: signaux-google-news
description: Use this skill to detect external engagement signals on a French SMB by scraping Google News (free, no auth required). Returns a structured list of recent news mentions classified as fundraising, recruitment, expansion, awards, or distress. Used by Re-scoring Deal to refresh a deal's context with what changed externally since the last scoring, and by the future Veille Signaux agent for proactive ABM tracking. Skip silently if Google rate-limits or returns no relevant snippet.
---

# Skill — Détection signaux d'engagement (Google News)

## Quand utiliser

- **Agent Re-scoring Deal** : à l'étape 4.2 (Reconstitue le contexte),
  appelé pour détecter ce qui a changé chez l'entreprise depuis le
  dernier scoring (levée de fonds, gros recrutements, expansion, prix).
  Skip silencieux si Google bloque.
- **Futur agent Veille Signaux** (#10 roadmap) : appel hebdo sur tous
  les contacts/companies en pipeline `qualified+` pour ABM proactif.

**Skip si** :
- Tu as déjà appelé cette skill pour la même entité dans les
  **7 derniers jours** (économise les requêtes — les news bougent
  rarement aussi vite)
- Le nom commercial est trop générique (`Le Salon`, `Pizza Express`,
  `Boulangerie Centrale`) → trop de faux positifs, skip et tagger
  `raw_payload.signaux_news = { skipped: "nom_trop_generique" }`

## Source

Google News public (pas d'API officielle dans le tier gratuit, on
scrape les résultats publics) :

    https://news.google.com/search?q=<query>&hl=fr&gl=FR&ceid=FR:fr

Via WebFetch (l'outil Multica) — pas besoin de clé.

## Construction de la requête

Encoder l'URL pour la `query` :

    "<nom commercial>" <ville>

Le double-quote autour du nom limite les faux positifs. Ajouter la ville
quand c'est connu (filtre régional).

Exemple :

    "Salon Marie" Lyon

→ URL :

    https://news.google.com/search?q=%22Salon+Marie%22+Lyon&hl=fr&gl=FR&ceid=FR:fr

## Parsing de la réponse

Google News renvoie du HTML. Via WebFetch, demande au modèle d'extraire :

- Pour chaque article visible (les ~10 premiers résultats suffisent) :
  - Titre
  - URL source
  - Date (souvent relative : "il y a 3 jours", "le 12 mai 2026")
  - Source (Le Monde, Les Echos, BFM, presse locale, etc.)
  - Snippet (1-2 lignes)

## Classification des signaux (regex sur titres + snippets)

Cinq catégories de signaux, par ordre d'importance commerciale :

### 1. `fundraising` (levée de fonds) — signal très fort

Patterns à matcher (case-insensitive) :

- `lev[ée]e? de fonds`
- `série [A-D]`
- `tour de table`
- `lev[ée] [\d]+\s?(K|M|million)`
- `boucle un tour`

**Contribution Re-scoring** : axe Budget +0.2 immédiat (boost significatif),
flag `signal_fort` à true.

### 2. `recruitment` (gros recrutements) — signal fort

Patterns :

- `recrute\s+\d+`
- `embauche\s+\d+\s+(collaborateurs|salariés|personnes)`
- `[\d]+\s+nouveaux postes`
- `expansion de l'équipe`

**Contribution** : axe Reach +0.1 (plus de monde = plus de canaux),
axe Budget +0.1 (capacité à embaucher = trésorerie).

### 3. `expansion` (croissance physique / nouveau site)

Patterns :

- `s'agrandit`
- `nouveau site`
- `nouvelle agence`
- `nouveau magasin`
- `inauguration`
- `ouverture (d'un|à) `
- `s'installe à`

**Contribution** : axe Budget +0.15.

### 4. `award` (prix, classement, reconnaissance)

Patterns :

- `(prix|trophée|médaille) (du|de la|des|d'or)`
- `meilleur [a-z]+`
- `classement`
- `nommé[e]?`
- `lauréat[e]?`

**Contribution** : axe Fit +0.05 (légère reconnaissance qualité).

### 5. `distress` (mauvais signal — recoupe BODACC)

Patterns :

- `redressement judiciaire`
- `liquidation`
- `procédure collective`
- `cessation de paiement`
- `licenciement[s]? collectif`

**Contribution** : flag `company_active_doubt = true`, signaler à
l'utilisateur. Recouper avec `prospection-bodacc-check` qui est la
source de vérité officielle.

## Output — UPDATE à appliquer

Pour un lead/deal/contact :

    UPDATE public.lead_imports
    SET raw_payload = raw_payload || jsonb_build_object(
          'signaux_news', jsonb_build_object(
            'checked_at', now()::text,
            'signals', jsonb_build_array(
              jsonb_build_object(
                'titre', '<title>',
                'url', '<url>',
                'date', '<ISO ou texte relatif>',
                'source', '<source name>',
                'type_signal', '<fundraising|recruitment|expansion|award|distress>',
                'confiance', '<high|medium|low>'
              )
            ),
            'count_total', <int>
          )
        )
    WHERE id = '<lead_id>';

Pour Re-scoring Deal, c'est différent — pas de UPDATE direct sur
le deal, mais ajout dans la `payload` de l'activity de re-scoring :

    INSERT INTO public.activities (...) VALUES (
      'note', 'deal', '<deal_id>',
      jsonb_build_object(
        'body', '...',
        'old_score', ...,
        'new_score', ...,
        'signaux_news', '<liste détectée>',
        'agent', 'multica-rescoring-deal'
      ), ...
    );

## Niveau de confiance

- `high` : titre + snippet matchent clairement le pattern ET le nom
  commercial apparaît littéralement dans le titre
- `medium` : titre OU snippet matchent, mais incertitude sur l'entité
  exacte (nom partiel, ambigüité)
- `low` : pattern faiblement matché, snippet ambigu

Ne **jamais** stocker un signal `confiance: low` — c'est du bruit.
Seuls `high` et `medium` sont retournés.

## Rate limit (estimé)

Google News n'a pas de quota documenté pour le scraping public, mais
en pratique :

- ~30 requêtes par heure depuis une même IP avant CAPTCHA
- Skip silencieusement si Google retourne une page CAPTCHA ou un 429
- Tracker : `raw_payload.signaux_news.quota_state = { "last_429_at": "..." }`

## Cas spéciaux

### Aucun résultat / 0 article

Cas normal pour les TPE (artisans, coiffeurs, plombiers) qui n'ont
jamais d'écho médiatique. Réponse :

    raw_payload.signaux_news = {
      checked_at: '...',
      signals: [],
      count_total: 0,
      note: 'aucun signal détecté'
    }

→ neutre, n'affecte pas le scoring.

### Nom homonyme (faux positifs)

Si le nom commercial est partagé avec une marque nationale ou une
personne publique → bruit important. Avant d'enregistrer un signal,
vérifier que le **nom de la company** apparaît dans le titre ET que
la **ville** apparaît dans le titre ou le snippet (sinon `low`,
qu'on ne stocke pas).

### Article ancien

Si toutes les news détectées datent de > 12 mois → tagger
`raw_payload.signaux_news.note = 'pas de signaux récents'`. Pour
Re-scoring : pas de changement de score, juste mise à jour du
`checked_at`.

## Règles strictes

- ❌ JAMAIS appeler cette skill plus d'une fois par 7 jours pour la
  même entité
- ❌ JAMAIS stocker un signal `confiance: low` — c'est du bruit
- ❌ JAMAIS skip BODACC sous prétexte que Google News a détecté un
  signal `distress` — BODACC reste la source de vérité officielle
- ❌ JAMAIS scrapper Google News pour un nom < 3 caractères ou
  manifestement générique
- ✅ Skip silencieusement (pas d'erreur) si Google rate-limite ou
  retourne CAPTCHA
- ✅ Si un signal `fundraising` est détecté, mentionner explicitement
  dans le rationale de la re-scoring activity ("levée de X M€
  détectée le YYYY-MM-DD, source Z")
