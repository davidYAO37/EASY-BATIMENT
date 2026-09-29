const collator = (a: string, b: string) => a.localeCompare(b, 'fr');

export const UNITE_GROUPS: { label: string; items: string[] }[] = [
  {
    label: 'Comptage',
    items: ['Pièce', 'Unité', 'Jeu', 'Paire', 'Ensemble', 'Kit', 'Lot', 'Pack'],
  },
  {
    label: 'Longueur',
    items: ['mm', 'cm', 'm', 'ml (mètre linéaire)', 'km'],
  },
  {
    label: 'Surface',
    items: ['m²', 'ha'],
  },
  {
    label: 'Volume',
    items: ['ml', 'Litre', 'm³'],
  },
  {
    label: 'Poids',
    items: ['g', 'kg', 'Quintal', 'Tonne'],
  },
  {
    label: 'Conditionnement',
    items: [
      'Sac', 'Sachet', 'Boîte', 'Carton', 'Palette', 'Fût', 'Bidon', 'Seau',
      'Tube', 'Rouleau', 'Bobine', 'Feuille', 'Plaque', 'Barre', 'Botte', 'Paquet',
    ],
  },
  {
    label: 'Logistique',
    items: ['Voyage', 'Camion', 'Benne'],
  },
  {
    label: 'Temps & services',
    items: ['Point', 'Heure', 'Jour', 'Semaine', 'Mois', 'Forfait'],
  },
].map((g) => ({ ...g, items: g.items.sort(collator) }));

export const UNITES = UNITE_GROUPS.flatMap((g) => g.items);

export const CATEGORY_GROUPS: { label: string; items: string[] }[] = [
  {
    label: 'Gros œuvre',
    items: [
      'Ciment & liants',
      'Agrégats (sable, gravier, concassé)',
      'Béton prêt à l\u2019emploi',
      'Ferraillage & acier',
      'Maçonnerie (blocs, briques)',
      'Bois, charpente & coffrage',
      'Échafaudage & étaiement',
      'Métallerie & serrurerie',
    ],
  },
  {
    label: 'Enveloppe',
    items: [
      'Couverture & toiture',
      'Étanchéité & isolation',
      'Menuiserie extérieure (fenêtres, portes)',
      'Façade & bardage',
    ],
  },
  {
    label: 'Second œuvre',
    items: [
      'Plâtrerie & cloisons (placo)',
      'Menuiserie intérieure',
      'Faux plafonds',
      'Plomberie & sanitaire',
      'Chauffage, ventilation & climatisation (CVC)',
      'Électricité',
      'Peinture & finition',
      'Carrelage & revêtement de sol',
      'Sols souples (PVC, moquette)',
      'Quincaillerie & visserie',
      'Cuisine & mobilier fixe',
    ],
  },
  {
    label: 'Extérieur / VRD',
    items: [
      'Terrassement & VRD',
      'Clôtures & portails',
      'Aménagement extérieur & espaces verts',
      'Assainissement & drainage',
    ],
  },
  {
    label: 'Matériel & outillage',
    items: [
      'Outillage à main',
      'Outillage électroportatif',
      'Matériel & engins de chantier',
      'Location de matériel',
      'Consommables & abrasifs',
    ],
  },
  {
    label: 'Sécurité & base vie',
    items: [
      'Sécurité & EPI',
      'Signalisation & balisage',
      'Base vie & hygiène chantier',
      'Traitement des déchets',
    ],
  },
  {
    label: 'Énergie & services',
    items: [
      'Carburant & lubrifiants',
      'Eau & énergie de chantier',
      'Transport & logistique',
      'Main-d\u2019œuvre & sous-traitance',
      'Études & bureau d\u2019études',
      'Nettoyage & réception de chantier',
    ],
  },
].map((g) => ({ ...g, items: g.items.sort(collator) }));

export const CATEGORIES = CATEGORY_GROUPS.flatMap((g) => g.items);
