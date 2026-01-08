/**
 * Données seed pour les sections et items d'inspection électrique CMEQ
 * Source: Fiche de vérification visuelle - Installation électrique - Immeubles d'habitation (Janvier 2020)
 */

export interface SectionSeed {
  code: string;
  name: string;
  description?: string;
  order_index: number;
  has_na_option: boolean;
  has_location_field: boolean;
  has_volts_field: boolean;
  has_amps_field: boolean;
  has_power_field: boolean;
  extra_fields?: Record<string, unknown>;
  items: ItemSeed[];
}

export interface ItemSeed {
  item_number: number;
  name: string;
  options: { value: string; label: string }[];
  has_text_input?: boolean;
  text_input_label?: string;
}

// Options communes réutilisables
const OK_NC = [
  { value: 'ok', label: 'OK' },
  { value: 'nc', label: 'NC' },
];

const NA_OK_NC = [
  { value: 'na', label: 'N/A' },
  { value: 'ok', label: 'OK' },
  { value: 'nc', label: 'NC' },
];

const NAC_OK_NC = [
  { value: 'nac', label: 'NAC' },
  { value: 'ok', label: 'OK' },
  { value: 'nc', label: 'NC' },
];

const CONDUCTEURS_OPTIONS = [
  { value: 'cuivre', label: 'Cuivre' },
  { value: 'aluminium', label: 'Aluminium' },
  { value: 'ok', label: 'OK' },
  { value: 'endommages', label: 'Endommagés' },
  { value: 'nc', label: 'NC' },
];

const ETAT_GENERAL_OPTIONS = [
  { value: 'ok', label: 'OK' },
  { value: 'rouille', label: 'Rouille' },
  { value: 'eau', label: 'Eau' },
  { value: 'debouchure_ouverte', label: 'Débouchure ouverte' },
  { value: 'nc', label: 'NC' },
];

const ISOLANT_OPTIONS = [
  { value: 'ok', label: 'OK' },
  { value: 'craquelure', label: 'Craquelure' },
  { value: 'decoloration', label: 'Décoloration' },
  { value: 'brisure', label: 'Brisure' },
];

const CONTINUITE_MASSES_OPTIONS = [
  { value: 'oui', label: 'OUI' },
  { value: 'cavalier_nc', label: 'Cavalier de jonction NC' },
  { value: 'decoloration', label: 'Décoloration' },
  { value: 'nc', label: 'NC' },
];

const FUSIBLES_OPTIONS = [
  { value: 'na', label: 'N/A' },
  { value: 'ok', label: 'OK' },
  { value: 'type_d', label: 'Type « D »' },
  { value: 'type_p', label: 'Type « P »' },
  { value: 'nac', label: 'NAC' },
  { value: 'nc', label: 'NC' },
];

const EMPLACEMENT_OPTIONS = [
  { value: 'nac', label: 'NAC' },
  { value: 'salle_bains', label: 'Salle de bains' },
  { value: 'placard', label: 'Placard' },
  { value: 'ok', label: 'OK' },
  { value: 'nc', label: 'NC' },
];

export const ELECTRICAL_INSPECTION_SECTIONS: SectionSeed[] = [
  // ========================================
  // 1.A - BRANCHEMENT AÉRIEN
  // ========================================
  {
    code: '1A',
    name: 'Branchement aérien',
    order_index: 1,
    has_na_option: true,
    has_location_field: false,
    has_volts_field: true,
    has_amps_field: true,
    has_power_field: false,
    items: [
      {
        item_number: 1,
        name: 'Mât',
        options: [
          { value: 'na', label: 'N/A' },
          { value: 'ok', label: 'OK' },
          { value: 'croche', label: 'Croche' },
          { value: 'endommage', label: 'Endommagé' },
          { value: 'plie', label: 'Plié' },
          { value: 'fixation_adequate', label: 'Fixation adéquate' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 2,
        name: 'Conduit',
        options: [
          { value: 'na', label: 'N/A' },
          { value: 'ok', label: 'OK' },
          { value: 'protection_requise', label: 'Protection requise' },
          { value: 'endommage', label: 'Endommagé' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 3,
        name: 'Câble (Ex. : TECK)',
        options: [
          { value: 'na', label: 'N/A' },
          { value: 'ok', label: 'OK' },
          { value: 'protection_requise', label: 'Protection requise' },
          { value: 'endommage', label: 'Endommagé' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 4,
        name: 'Type de câble',
        options: [
          { value: 'approuve', label: 'Approuvé pour l\'usage' },
          { value: 'nc', label: 'NC' },
        ],
        has_text_input: true,
        text_input_label: 'Type',
      },
      {
        item_number: 5,
        name: 'Tête de branchement',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'obstruee', label: 'Obstruée' },
          { value: 'endommagee', label: 'Endommagée' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 6,
        name: 'Raccordement aérien',
        options: OK_NC,
      },
      {
        item_number: 7,
        name: 'Ferrure',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'fixation', label: 'Fixation' },
          { value: 'porcelaine_cassee', label: 'Porcelaine cassée' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 8,
        name: 'Chevalets',
        options: [
          { value: 'na', label: 'N/A' },
          { value: 'ok', label: 'OK' },
          { value: 'endommage', label: 'Endommagé' },
          { value: 'fixation_adequate', label: 'Fixation adéquate' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 9,
        name: 'Câblage exposé < 1982-10-1',
        options: [
          { value: 'na', label: 'N/A' },
          { value: 'ok', label: 'OK' },
          { value: 'endommage', label: 'Endommagé' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 10,
        name: 'Conducteurs',
        options: CONDUCTEURS_OPTIONS,
      },
      {
        item_number: 11,
        name: 'Compatibilité Cu/Al',
        options: OK_NC,
      },
      {
        item_number: 12,
        name: 'Brise-glace',
        options: NA_OK_NC,
      },
      {
        item_number: 13,
        name: 'Embase',
        options: [
          { value: 'na', label: 'N/A' },
          { value: 'ok', label: 'OK' },
          { value: 'rouillee', label: 'Rouillée' },
          { value: 'endommagee', label: 'Endommagée' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 14,
        name: 'Bride de continuité des masses',
        options: NA_OK_NC,
      },
      {
        item_number: 15,
        name: 'Scellement',
        options: OK_NC,
      },
      {
        item_number: 16,
        name: 'Drainage',
        options: [
          { value: 'na', label: 'N/A' },
          { value: 'canalisation_drainee', label: 'Canalisation drainée' },
          { value: 'ok', label: 'OK' },
          { value: 'nc', label: 'NC' },
        ],
      },
    ],
  },

  // ========================================
  // 1.B - BRANCHEMENT AÉROSOUTERRAIN
  // ========================================
  {
    code: '1B',
    name: 'Branchement aérosouterrain',
    order_index: 2,
    has_na_option: true,
    has_location_field: false,
    has_volts_field: true,
    has_amps_field: true,
    has_power_field: false,
    items: [
      {
        item_number: 1,
        name: 'Poteau client',
        options: NA_OK_NC,
      },
      {
        item_number: 2,
        name: 'Ferrure',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'fixation', label: 'Fixation' },
          { value: 'porcelaine_cassee', label: 'Porcelaine cassée' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 3,
        name: 'Tête de branchement',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'obstruee', label: 'Obstruée' },
          { value: 'endommagee', label: 'Endommagée' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 4,
        name: 'Raccordement aérien',
        options: OK_NC,
      },
      {
        item_number: 5,
        name: 'Conduit',
        options: [
          { value: 'na', label: 'N/A' },
          { value: 'ok', label: 'OK' },
          { value: 'protection_requise', label: 'Protection requise' },
          { value: 'endommage', label: 'Endommagé' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 6,
        name: 'Joint de dilatation',
        options: OK_NC,
      },
      {
        item_number: 7,
        name: 'Câble (Ex. : TECK)',
        options: [
          { value: 'na', label: 'N/A' },
          { value: 'ok', label: 'OK' },
          { value: 'protection_requise', label: 'Protection requise' },
          { value: 'endommage', label: 'Endommagé' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 8,
        name: 'Type de câble',
        options: [
          { value: 'approuve', label: 'Approuvé pour l\'usage' },
          { value: 'nc', label: 'NC' },
        ],
        has_text_input: true,
        text_input_label: 'Type',
      },
      {
        item_number: 9,
        name: 'Conducteurs',
        options: CONDUCTEURS_OPTIONS,
      },
      {
        item_number: 10,
        name: 'Compatibilité Cu/Al',
        options: OK_NC,
      },
      {
        item_number: 11,
        name: 'Embase',
        options: [
          { value: 'na', label: 'N/A' },
          { value: 'ok', label: 'OK' },
          { value: 'rouillee', label: 'Rouillée' },
          { value: 'endommagee', label: 'Endommagée' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 12,
        name: 'Bride de continuité des masses',
        options: NA_OK_NC,
      },
      {
        item_number: 13,
        name: 'Scellement',
        options: OK_NC,
      },
      {
        item_number: 14,
        name: 'Drainage',
        options: [
          { value: 'na', label: 'N/A' },
          { value: 'canalisation_drainee', label: 'Canalisation drainée' },
          { value: 'ok', label: 'OK' },
          { value: 'nc', label: 'NC' },
        ],
      },
    ],
  },

  // ========================================
  // 1.C - BRANCHEMENT SOUTERRAIN
  // ========================================
  {
    code: '1C',
    name: 'Branchement souterrain',
    order_index: 3,
    has_na_option: true,
    has_location_field: false,
    has_volts_field: true,
    has_amps_field: true,
    has_power_field: false,
    items: [
      {
        item_number: 1,
        name: 'Conduit',
        options: [
          { value: 'na', label: 'N/A' },
          { value: 'ok', label: 'OK' },
          { value: 'protection_requise', label: 'Protection requise' },
          { value: 'endommage', label: 'Endommagé' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 2,
        name: 'Joint de dilatation',
        options: OK_NC,
      },
      {
        item_number: 3,
        name: 'Type de conducteurs',
        options: [
          { value: 'approuve', label: 'Approuvé pour l\'usage' },
          { value: 'nc', label: 'NC' },
        ],
        has_text_input: true,
        text_input_label: 'Type',
      },
      {
        item_number: 4,
        name: 'Conducteurs',
        options: CONDUCTEURS_OPTIONS,
      },
      {
        item_number: 5,
        name: 'Compatibilité Cu/Al',
        options: OK_NC,
      },
      {
        item_number: 6,
        name: 'Embase – NEMA',
        options: NA_OK_NC,
      },
      {
        item_number: 7,
        name: 'Embase',
        options: [
          { value: 'na', label: 'N/A' },
          { value: 'ok', label: 'OK' },
          { value: 'rouillee', label: 'Rouillée' },
          { value: 'endommagee', label: 'Endommagée' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 8,
        name: 'Boîte de jonction',
        options: [
          { value: 'na', label: 'N/A' },
          { value: 'ok', label: 'OK' },
          { value: 'rouillee', label: 'Rouillée' },
          { value: 'endommagee', label: 'Endommagée' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 9,
        name: 'Boîte de tirage',
        options: [
          { value: 'na', label: 'N/A' },
          { value: 'ok', label: 'OK' },
          { value: 'rouillee', label: 'Rouillée' },
          { value: 'endommagee', label: 'Endommagée' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 10,
        name: 'Scellement',
        options: OK_NC,
      },
      {
        item_number: 11,
        name: 'Drainage',
        options: [
          { value: 'na', label: 'N/A' },
          { value: 'canalisation_drainee', label: 'Canalisation drainée' },
          { value: 'ok', label: 'OK' },
          { value: 'nc', label: 'NC' },
        ],
      },
    ],
  },

  // ========================================
  // 2 - INTERRUPTEUR PRINCIPAL
  // ========================================
  {
    code: '2',
    name: 'Interrupteur principal',
    order_index: 4,
    has_na_option: true,
    has_location_field: true,
    has_volts_field: true,
    has_amps_field: true,
    has_power_field: false,
    items: [
      {
        item_number: 1,
        name: 'État général',
        options: ETAT_GENERAL_OPTIONS,
      },
      {
        item_number: 2,
        name: 'Isolant de l\'appareillage',
        options: ISOLANT_OPTIONS,
      },
      {
        item_number: 3,
        name: 'Isolant des câbles',
        options: ISOLANT_OPTIONS,
      },
      {
        item_number: 4,
        name: 'État des mâchoires',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'rouille', label: 'Rouille' },
          { value: 'decoloration', label: 'Décoloration' },
          { value: 'traces_surchauffe', label: 'Traces de surchauffe' },
        ],
      },
      {
        item_number: 5,
        name: 'Connecteurs et embouts adéquats',
        options: OK_NC,
      },
      {
        item_number: 6,
        name: 'Type de câble',
        options: [
          { value: 'approuve', label: 'Approuvé pour l\'usage' },
          { value: 'nc', label: 'NC' },
        ],
        has_text_input: true,
        text_input_label: 'Type',
      },
      {
        item_number: 7,
        name: 'Conducteurs',
        options: CONDUCTEURS_OPTIONS,
      },
      {
        item_number: 8,
        name: 'Compatibilité Cu/Al',
        options: OK_NC,
      },
      {
        item_number: 9,
        name: 'Protection vs conducteurs',
        options: NAC_OK_NC,
      },
      {
        item_number: 10,
        name: 'Identification courant maximal',
        options: OK_NC,
      },
      {
        item_number: 11,
        name: 'Continuité des masses',
        options: CONTINUITE_MASSES_OPTIONS,
      },
      {
        item_number: 12,
        name: 'Mise à la terre',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'decoloration', label: 'Décoloration' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 13,
        name: 'Type de fusibles',
        options: FUSIBLES_OPTIONS,
      },
      {
        item_number: 14,
        name: 'Scellement',
        options: OK_NC,
      },
      {
        item_number: 15,
        name: 'Emplacement',
        options: EMPLACEMENT_OPTIONS,
      },
      {
        item_number: 16,
        name: 'Identification fonction',
        options: OK_NC,
      },
      {
        item_number: 17,
        name: 'Espace dans l\'interrupteur',
        options: OK_NC,
      },
    ],
  },

  // ========================================
  // 3 - MISE À LA TERRE
  // ========================================
  {
    code: '3',
    name: 'Mise à la terre',
    order_index: 5,
    has_na_option: true,
    has_location_field: false,
    has_volts_field: false,
    has_amps_field: false,
    has_power_field: false,
    items: [
      {
        item_number: 1,
        name: 'Prise de terre',
        options: [
          { value: 'nac', label: 'NAC' },
          { value: 'prefabriquee', label: 'Préfabriquée' },
          { value: 'assemblage_pied_oeuvre', label: 'Assemblage à pied d\'œuvre' },
          { value: 'preexistante', label: 'Préexistante' },
        ],
      },
      {
        item_number: 2,
        name: 'Collier',
        options: [
          { value: 'na', label: 'N/A' },
          { value: 'nac', label: 'NAC' },
          { value: 'visible', label: 'Visible' },
          { value: 'oxydation', label: 'Oxydation' },
          { value: 'ok', label: 'OK' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 3,
        name: 'Mise à la terre de la tuyauterie',
        options: [
          { value: 'eau', label: 'Eau' },
          { value: 'gaz', label: 'Gaz' },
          { value: 'egout', label: 'Égout' },
          { value: 'na', label: 'N/A' },
        ],
      },
      {
        item_number: 4,
        name: 'Conducteur de mise à la terre',
        options: OK_NC,
      },
      {
        item_number: 5,
        name: 'Joints conducteur MALT',
        options: NA_OK_NC,
      },
      {
        item_number: 6,
        name: 'Calibre du conducteur de mise à la terre',
        options: OK_NC,
      },
      {
        item_number: 7,
        name: 'Joint visible à la prise de terre',
        options: [
          { value: 'non', label: 'NON' },
          { value: 'oui_conforme', label: 'OUI et Conforme' },
          { value: 'oui_nc', label: 'OUI et NC' },
        ],
      },
      {
        item_number: 8,
        name: 'Protection mécanique',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'nc', label: 'NC' },
          { value: 'na', label: 'N/A' },
        ],
      },
    ],
  },

  // ========================================
  // 4.A - ARMOIRE POUR TRANSFORMATEURS
  // ========================================
  {
    code: '4A',
    name: 'Armoire pour transformateurs',
    order_index: 6,
    has_na_option: true,
    has_location_field: true,
    has_volts_field: false,
    has_amps_field: false,
    has_power_field: false,
    items: [
      {
        item_number: 1,
        name: 'Descellement',
        options: [
          { value: 'impossible', label: 'Impossible' },
        ],
      },
      {
        item_number: 2,
        name: 'État général',
        options: ETAT_GENERAL_OPTIONS,
      },
      {
        item_number: 3,
        name: 'Connecteurs et embouts adéquats',
        options: OK_NC,
      },
      {
        item_number: 4,
        name: 'Continuité des masses',
        options: CONTINUITE_MASSES_OPTIONS,
      },
      {
        item_number: 5,
        name: 'Ouvertures',
        options: OK_NC,
      },
      {
        item_number: 6,
        name: 'Borne de neutre isolée',
        options: OK_NC,
      },
      {
        item_number: 7,
        name: 'Emplacement',
        options: OK_NC,
      },
    ],
  },

  // ========================================
  // 4.B - CENTRE DE MESURAGE
  // ========================================
  {
    code: '4B',
    name: 'Centre de mesurage',
    order_index: 7,
    has_na_option: true,
    has_location_field: true,
    has_volts_field: false,
    has_amps_field: false,
    has_power_field: false,
    extra_fields: { meter_number: true },
    items: [
      {
        item_number: 1,
        name: 'Descellement',
        options: [
          { value: 'impossible', label: 'Impossible' },
        ],
      },
      {
        item_number: 2,
        name: 'État général',
        options: ETAT_GENERAL_OPTIONS,
      },
      {
        item_number: 3,
        name: 'Plaque frontale',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'debouchure_ouverte', label: 'Débouchure ouverte' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 4,
        name: 'Isolation des barres omnibus',
        options: ISOLANT_OPTIONS,
      },
      {
        item_number: 5,
        name: 'Isolant des câbles',
        options: ISOLANT_OPTIONS,
      },
      {
        item_number: 6,
        name: 'Barres omnibus',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'oxydation', label: 'Oxydation' },
          { value: 'decoloration', label: 'Décoloration' },
          { value: 'traces_surchauffe', label: 'Traces de surchauffe' },
        ],
      },
      {
        item_number: 7,
        name: 'Connecteurs et embouts adéquats',
        options: OK_NC,
      },
      {
        item_number: 8,
        name: 'Type de câble',
        options: [
          { value: 'approuve', label: 'Approuvé pour l\'usage' },
          { value: 'nc', label: 'NC' },
        ],
        has_text_input: true,
        text_input_label: 'Type',
      },
      {
        item_number: 9,
        name: 'Conducteurs',
        options: CONDUCTEURS_OPTIONS,
      },
      {
        item_number: 10,
        name: 'Compatibilité Cu/Al',
        options: OK_NC,
      },
      {
        item_number: 11,
        name: 'Continuité des masses',
        options: CONTINUITE_MASSES_OPTIONS,
      },
      {
        item_number: 12,
        name: 'Emplacement',
        options: OK_NC,
      },
      {
        item_number: 13,
        name: 'Espace dans les coffrets secondaires',
        options: OK_NC,
      },
      {
        item_number: 14,
        name: 'Protection vs conducteurs',
        options: NAC_OK_NC,
      },
      {
        item_number: 15,
        name: 'Identification courant maximal',
        options: OK_NC,
      },
      {
        item_number: 16,
        name: 'Identification fonction',
        options: OK_NC,
      },
      {
        item_number: 17,
        name: 'N° de compteur',
        options: [],
        has_text_input: true,
        text_input_label: 'N° de compteur',
      },
    ],
  },

  // ========================================
  // 5 - RÉPARTITEUR (BOÎTE DE RÉPARTITION)
  // ========================================
  {
    code: '5',
    name: 'Répartiteur (boîte de répartition)',
    order_index: 8,
    has_na_option: true,
    has_location_field: true,
    has_volts_field: false,
    has_amps_field: false,
    has_power_field: false,
    items: [
      {
        item_number: 1,
        name: 'Utilisation obligatoire',
        options: OK_NC,
      },
      {
        item_number: 2,
        name: 'État général',
        options: ETAT_GENERAL_OPTIONS,
      },
      {
        item_number: 3,
        name: 'Plaque frontale',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'debouchure_ouverte', label: 'Débouchure ouverte' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 4,
        name: 'Isolation des barres omnibus',
        options: ISOLANT_OPTIONS,
      },
      {
        item_number: 5,
        name: 'Isolant des câbles',
        options: ISOLANT_OPTIONS,
      },
      {
        item_number: 6,
        name: 'Barres omnibus',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'oxydation', label: 'Oxydation' },
          { value: 'decoloration', label: 'Décoloration' },
          { value: 'traces_surchauffe', label: 'Traces de surchauffe' },
        ],
      },
      {
        item_number: 7,
        name: 'Connecteurs et embouts adéquats',
        options: OK_NC,
      },
      {
        item_number: 8,
        name: 'Fixation',
        options: OK_NC,
      },
      {
        item_number: 9,
        name: 'Type de câble',
        options: [
          { value: 'approuve', label: 'Approuvé pour l\'usage' },
          { value: 'nc', label: 'NC' },
        ],
        has_text_input: true,
        text_input_label: 'Type',
      },
      {
        item_number: 10,
        name: 'Mauvaise utilisation',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'autre_utilisation', label: 'Autre utilisation' },
          { value: 'mauvais_raccord', label: 'Mauvais raccord' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 11,
        name: 'Conducteurs',
        options: CONDUCTEURS_OPTIONS,
      },
      {
        item_number: 12,
        name: 'Compatibilité Cu/Al',
        options: OK_NC,
      },
      {
        item_number: 13,
        name: 'Conducteurs de grosseur réduite',
        options: OK_NC,
      },
      {
        item_number: 14,
        name: 'Continuité des masses',
        options: CONTINUITE_MASSES_OPTIONS,
      },
      {
        item_number: 15,
        name: 'Emplacement',
        options: [
          { value: 'placard', label: 'Placard' },
          { value: 'ok', label: 'OK' },
          { value: 'nc', label: 'NC' },
        ],
      },
    ],
  },

  // ========================================
  // 6 - PANNEAU DE DISTRIBUTION D'ARTÈRES
  // ========================================
  {
    code: '6',
    name: 'Panneau de distribution d\'artères',
    order_index: 9,
    has_na_option: true,
    has_location_field: true,
    has_volts_field: true,
    has_amps_field: true,
    has_power_field: false,
    extra_fields: { panel_type: ['disjoncteurs', 'fusibles'] },
    items: [
      {
        item_number: 1,
        name: 'État général',
        options: ETAT_GENERAL_OPTIONS,
      },
      {
        item_number: 2,
        name: 'Plaque frontale',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'debouchure_ouverte', label: 'Débouchure ouverte' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 3,
        name: 'Isolant de l\'appareillage',
        options: ISOLANT_OPTIONS,
      },
      {
        item_number: 4,
        name: 'Isolant des câbles',
        options: ISOLANT_OPTIONS,
      },
      {
        item_number: 5,
        name: 'Barres omnibus',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'oxydation', label: 'Oxydation' },
          { value: 'decoloration', label: 'Décoloration' },
          { value: 'traces_surchauffe', label: 'Traces de surchauffe' },
        ],
      },
      {
        item_number: 6,
        name: 'Disjoncteurs certifiés pour le panneau',
        options: OK_NC,
      },
      {
        item_number: 7,
        name: 'Calibre maximal des artères vs certification',
        options: OK_NC,
      },
      {
        item_number: 8,
        name: 'Connecteurs et embouts adéquats',
        options: OK_NC,
      },
      {
        item_number: 9,
        name: 'Type de câble',
        options: [
          { value: 'approuve', label: 'Approuvé pour l\'usage' },
          { value: 'nc', label: 'NC' },
        ],
        has_text_input: true,
        text_input_label: 'Type',
      },
      {
        item_number: 10,
        name: 'Conducteurs',
        options: CONDUCTEURS_OPTIONS,
      },
      {
        item_number: 11,
        name: 'Compatibilité Cu/Al',
        options: OK_NC,
      },
      {
        item_number: 12,
        name: 'Type de fusibles',
        options: FUSIBLES_OPTIONS,
      },
      {
        item_number: 13,
        name: 'Protection vs conducteurs',
        options: OK_NC,
      },
      {
        item_number: 14,
        name: 'Identification courant maximal',
        options: OK_NC,
      },
      {
        item_number: 15,
        name: 'Seulement un conducteur par disjoncteur',
        options: OK_NC,
      },
      {
        item_number: 16,
        name: 'Espace dans le panneau ou présence de marrettes',
        options: OK_NC,
      },
      {
        item_number: 17,
        name: 'Continuité des masses',
        options: CONTINUITE_MASSES_OPTIONS,
      },
      {
        item_number: 18,
        name: 'Emplacement',
        options: EMPLACEMENT_OPTIONS,
      },
      {
        item_number: 19,
        name: 'Identification fonction',
        options: OK_NC,
      },
    ],
  },

  // ========================================
  // 7 - INTERRUPTEURS SECONDAIRES
  // ========================================
  {
    code: '7',
    name: 'Interrupteurs secondaires',
    order_index: 10,
    has_na_option: true,
    has_location_field: true,
    has_volts_field: true,
    has_amps_field: true,
    has_power_field: false,
    items: [
      {
        item_number: 1,
        name: 'État général',
        options: ETAT_GENERAL_OPTIONS,
      },
      {
        item_number: 2,
        name: 'Isolant de l\'appareillage',
        options: ISOLANT_OPTIONS,
      },
      {
        item_number: 3,
        name: 'Isolant des câbles',
        options: ISOLANT_OPTIONS,
      },
      {
        item_number: 4,
        name: 'État des mâchoires',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'rouille', label: 'Rouille' },
          { value: 'decoloration', label: 'Décoloration' },
          { value: 'traces_surchauffe', label: 'Traces de surchauffe' },
        ],
      },
      {
        item_number: 5,
        name: 'Connecteurs et embouts adéquats',
        options: OK_NC,
      },
      {
        item_number: 6,
        name: 'Type de câble',
        options: [
          { value: 'approuve', label: 'Approuvé pour l\'usage' },
          { value: 'nc', label: 'NC' },
        ],
        has_text_input: true,
        text_input_label: 'Type',
      },
      {
        item_number: 7,
        name: 'Conducteurs',
        options: CONDUCTEURS_OPTIONS,
      },
      {
        item_number: 8,
        name: 'Compatibilité Cu/Al',
        options: OK_NC,
      },
      {
        item_number: 9,
        name: 'Protection vs conducteurs',
        options: NAC_OK_NC,
      },
      {
        item_number: 10,
        name: 'Identification courant maximal',
        options: OK_NC,
      },
      {
        item_number: 11,
        name: 'Continuité des masses',
        options: CONTINUITE_MASSES_OPTIONS,
      },
      {
        item_number: 12,
        name: 'Type de fusibles',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'type_d', label: 'Type « D »' },
          { value: 'type_p', label: 'Type « P »' },
          { value: 'nac', label: 'NAC' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 13,
        name: 'Emplacement',
        options: EMPLACEMENT_OPTIONS,
      },
      {
        item_number: 14,
        name: 'Identification fonction',
        options: OK_NC,
      },
      {
        item_number: 15,
        name: 'Espace dans les boîtiers',
        options: OK_NC,
      },
    ],
  },

  // ========================================
  // 8 - TRANSFORMATEURS DU TYPE SEC À AU PLUS 750 V
  // ========================================
  {
    code: '8',
    name: 'Transformateurs du type sec à au plus 750 V',
    order_index: 11,
    has_na_option: true,
    has_location_field: true,
    has_volts_field: true,
    has_amps_field: true,
    has_power_field: true,
    items: [
      {
        item_number: 1,
        name: 'État général',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'rouille', label: 'Rouille' },
          { value: 'eau', label: 'Eau' },
          { value: 'debouchure_ouverte', label: 'Débouchure ouverte' },
        ],
      },
      {
        item_number: 2,
        name: 'Isolant des câbles',
        options: ISOLANT_OPTIONS,
      },
      {
        item_number: 3,
        name: 'État des bornes',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'rouille', label: 'Rouille' },
          { value: 'decoloration', label: 'Décoloration' },
          { value: 'traces_surchauffe', label: 'Traces de surchauffe' },
        ],
      },
      {
        item_number: 4,
        name: 'Sectionnement',
        options: OK_NC,
      },
      {
        item_number: 5,
        name: 'Conducteurs vs courant nominal du transformateur ou charge',
        options: OK_NC,
      },
      {
        item_number: 6,
        name: 'Protection vs puissance du transformateur',
        options: OK_NC,
      },
      {
        item_number: 7,
        name: 'Protection vs conducteurs',
        options: OK_NC,
      },
      {
        item_number: 8,
        name: 'Disposition du câblage',
        options: OK_NC,
      },
      {
        item_number: 9,
        name: 'Type de câble',
        options: [
          { value: 'approuve', label: 'Approuvé pour l\'usage' },
          { value: 'nc', label: 'NC' },
        ],
        has_text_input: true,
        text_input_label: 'Type',
      },
      {
        item_number: 10,
        name: 'Conducteurs',
        options: CONDUCTEURS_OPTIONS,
      },
      {
        item_number: 11,
        name: 'Compatibilité Cu/Al',
        options: OK_NC,
      },
      {
        item_number: 12,
        name: 'Continuité des masses',
        options: CONTINUITE_MASSES_OPTIONS,
      },
      {
        item_number: 13,
        name: 'Mise à la terre',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'nc', label: 'NC' },
          { value: 'decoloration', label: 'Décoloration' },
        ],
      },
      {
        item_number: 14,
        name: 'Emplacement',
        options: [
          { value: 'placard', label: 'Placard' },
          { value: 'ok', label: 'OK' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 15,
        name: 'Dégagements à respecter',
        options: OK_NC,
      },
    ],
  },

  // ========================================
  // 9 - PANNEAUX DE DISTRIBUTION SECONDAIRES
  // ========================================
  {
    code: '9',
    name: 'Panneaux de distribution secondaires',
    order_index: 12,
    has_na_option: true,
    has_location_field: true,
    has_volts_field: true,
    has_amps_field: true,
    has_power_field: false,
    extra_fields: { panel_type: ['disjoncteurs', 'fusibles'] },
    items: [
      {
        item_number: 1,
        name: 'État général',
        options: ETAT_GENERAL_OPTIONS,
      },
      {
        item_number: 2,
        name: 'Plaque frontale',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'debouchure_ouverte', label: 'Débouchure ouverte' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 3,
        name: 'Isolant de l\'appareillage',
        options: ISOLANT_OPTIONS,
      },
      {
        item_number: 4,
        name: 'Isolant des câbles',
        options: ISOLANT_OPTIONS,
      },
      {
        item_number: 5,
        name: 'Barres omnibus',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'oxydation', label: 'Oxydation' },
          { value: 'decoloration', label: 'Décoloration' },
          { value: 'traces_surchauffe', label: 'Traces de surchauffe' },
        ],
      },
      {
        item_number: 6,
        name: 'Disjoncteurs certifiés pour le panneau',
        options: OK_NC,
      },
      {
        item_number: 7,
        name: 'Calibre maximal des dérivations vs certification',
        options: OK_NC,
      },
      {
        item_number: 8,
        name: 'Connecteurs et embouts adéquats',
        options: OK_NC,
      },
      {
        item_number: 9,
        name: 'Type de câble',
        options: [
          { value: 'approuve', label: 'Approuvé pour l\'usage' },
          { value: 'nc', label: 'NC' },
        ],
        has_text_input: true,
        text_input_label: 'Type',
      },
      {
        item_number: 10,
        name: 'Conducteurs',
        options: CONDUCTEURS_OPTIONS,
      },
      {
        item_number: 11,
        name: 'Compatibilité Cu/Al',
        options: OK_NC,
      },
      {
        item_number: 12,
        name: 'Type de fusibles',
        options: FUSIBLES_OPTIONS,
      },
      {
        item_number: 13,
        name: 'Protection vs conducteurs',
        options: OK_NC,
      },
      {
        item_number: 14,
        name: 'Identification courant maximal',
        options: OK_NC,
      },
      {
        item_number: 15,
        name: 'Seulement un conducteur par disjoncteur',
        options: OK_NC,
      },
      {
        item_number: 16,
        name: 'Espace dans le panneau ou présence de marrettes',
        options: [
          { value: 'non', label: 'NON' },
          { value: 'ok', label: 'OK' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 17,
        name: 'Panneau combiné',
        options: OK_NC,
      },
      {
        item_number: 18,
        name: 'Continuité des masses',
        options: CONTINUITE_MASSES_OPTIONS,
      },
      {
        item_number: 19,
        name: 'Emplacement',
        options: EMPLACEMENT_OPTIONS,
      },
      {
        item_number: 20,
        name: 'Identification fonction',
        options: OK_NC,
      },
    ],
  },

  // ========================================
  // 10 - GÉNÉRATRICE
  // ========================================
  {
    code: '10',
    name: 'Génératrice',
    order_index: 13,
    has_na_option: true,
    has_location_field: false,
    has_volts_field: true,
    has_amps_field: true,
    has_power_field: true,
    items: [
      {
        item_number: 1,
        name: 'Type',
        options: [
          { value: 'portative', label: 'Portative' },
          { value: 'permanente', label: 'Permanente' },
        ],
      },
      {
        item_number: 2,
        name: 'Fixation (ancrages)',
        options: [
          { value: 'na', label: 'N/A' },
          { value: 'oui', label: 'OUI' },
          { value: 'non', label: 'NON' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 3,
        name: 'Raccordement',
        options: [
          { value: 'pinces', label: 'Pinces' },
          { value: 'connecteur', label: 'Connecteur' },
          { value: 'fixe', label: 'Fixe' },
          { value: 'ok', label: 'OK' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 4,
        name: 'Dispositif de sectionnement',
        options: OK_NC,
      },
      {
        item_number: 5,
        name: 'Dispositif de protection',
        options: OK_NC,
      },
      {
        item_number: 6,
        name: 'Protection vs conducteurs',
        options: OK_NC,
      },
      {
        item_number: 7,
        name: 'Interrupteur d\'interconnexion',
        options: [
          { value: 'manuel', label: 'Manuel' },
          { value: 'automatique', label: 'Automatique' },
          { value: 'ok', label: 'OK' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 8,
        name: 'Prise de terre',
        options: [
          { value: 'prefabriquee', label: 'Préfabriquée' },
          { value: 'assemblage_pied_oeuvre', label: 'Assemblage à pied d\'œuvre' },
          { value: 'preexistante', label: 'Préexistante' },
        ],
      },
      {
        item_number: 9,
        name: 'Collier',
        options: [
          { value: 'na', label: 'N/A' },
          { value: 'nac', label: 'NAC' },
          { value: 'oxydation', label: 'Oxydation' },
          { value: 'visible', label: 'Visible' },
          { value: 'ok', label: 'OK' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 10,
        name: 'Conducteur de mise à la terre (Cu)',
        options: OK_NC,
      },
      {
        item_number: 11,
        name: 'Joints conducteur MALT',
        options: NA_OK_NC,
      },
      {
        item_number: 12,
        name: 'Calibre du conducteur de mise à la terre',
        options: OK_NC,
      },
      {
        item_number: 13,
        name: 'Joint visible à la prise de terre',
        options: [
          { value: 'non', label: 'NON' },
          { value: 'oui_conforme', label: 'OUI et Conforme' },
          { value: 'oui_nc', label: 'OUI et NC' },
        ],
      },
      {
        item_number: 14,
        name: 'Protection mécanique MALT',
        options: NA_OK_NC,
      },
      {
        item_number: 15,
        name: 'Continuité des masses',
        options: CONTINUITE_MASSES_OPTIONS,
      },
    ],
  },

  // ========================================
  // 11 - DÉMARREURS ET MOTEURS ÉLECTRIQUES
  // ========================================
  {
    code: '11',
    name: 'Démarreurs (variateurs de fréquence) et moteurs électriques',
    order_index: 14,
    has_na_option: true,
    has_location_field: true,
    has_volts_field: false,
    has_amps_field: false,
    has_power_field: false,
    extra_fields: { equipment_type: ['demarreur', 'variateur_frequence', 'moteur'] },
    items: [
      // Démarreur / Variateur
      {
        item_number: 1,
        name: 'État général (Démarreur/Variateur)',
        options: ETAT_GENERAL_OPTIONS,
      },
      {
        item_number: 2,
        name: 'Isolant des câbles (Démarreur/Variateur)',
        options: ISOLANT_OPTIONS,
      },
      {
        item_number: 3,
        name: 'Connecteurs et embouts adéquats (Démarreur/Variateur)',
        options: OK_NC,
      },
      {
        item_number: 4,
        name: 'Type de câble (Démarreur/Variateur)',
        options: [
          { value: 'approuve', label: 'Approuvé pour l\'usage' },
          { value: 'nc', label: 'NC' },
        ],
        has_text_input: true,
        text_input_label: 'Type',
      },
      {
        item_number: 5,
        name: 'Conducteurs (Démarreur/Variateur)',
        options: CONDUCTEURS_OPTIONS,
      },
      {
        item_number: 6,
        name: 'Compatibilité Cu/Al (Démarreur/Variateur)',
        options: OK_NC,
      },
      {
        item_number: 7,
        name: 'Type de fusibles (Démarreur/Variateur)',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'type_d', label: 'Type « D »' },
          { value: 'type_p', label: 'Type « P »' },
          { value: 'nac', label: 'NAC' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 8,
        name: 'Dispositif de sectionnement (Démarreur/Variateur)',
        options: NA_OK_NC,
      },
      {
        item_number: 9,
        name: 'Emplacement du dispositif de sectionnement (Démarreur/Variateur)',
        options: OK_NC,
      },
      {
        item_number: 10,
        name: 'Calibre du circuit (Démarreur/Variateur)',
        options: OK_NC,
      },
      {
        item_number: 11,
        name: 'Calibre de la protection contre les surintensités (Démarreur/Variateur)',
        options: OK_NC,
      },
      {
        item_number: 12,
        name: 'Calibre de la protection contre les surcharges (Démarreur/Variateur)',
        options: NA_OK_NC,
      },
      {
        item_number: 13,
        name: 'Continuité des masses (Démarreur/Variateur)',
        options: CONTINUITE_MASSES_OPTIONS,
      },
      {
        item_number: 14,
        name: 'Emplacement (Démarreur/Variateur)',
        options: [
          { value: 'placard', label: 'Placard' },
          { value: 'ok', label: 'OK' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 15,
        name: 'Identification fonction (Démarreur/Variateur)',
        options: OK_NC,
      },
      // Moteur
      {
        item_number: 16,
        name: 'Type de moteur',
        options: OK_NC,
      },
      {
        item_number: 17,
        name: 'Protection thermique',
        options: NA_OK_NC,
      },
      {
        item_number: 18,
        name: 'État général (Moteur)',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'rouille', label: 'Rouille' },
          { value: 'eau', label: 'Eau' },
          { value: 'debouchure_ouverte', label: 'Débouchure ouverte' },
        ],
      },
      {
        item_number: 19,
        name: 'Isolant des câbles (Moteur)',
        options: ISOLANT_OPTIONS,
      },
      {
        item_number: 20,
        name: 'Connecteurs et embouts adéquats (Moteur)',
        options: OK_NC,
      },
      {
        item_number: 21,
        name: 'Type de câble (Moteur)',
        options: [
          { value: 'approuve', label: 'Approuvé pour l\'usage' },
          { value: 'nc', label: 'NC' },
        ],
        has_text_input: true,
        text_input_label: 'Type',
      },
      {
        item_number: 22,
        name: 'Conducteurs (Moteur)',
        options: CONDUCTEURS_OPTIONS,
      },
      {
        item_number: 23,
        name: 'Compatibilité Cu/Al (Moteur)',
        options: OK_NC,
      },
      {
        item_number: 24,
        name: 'Type de fusibles (Moteur)',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'type_d', label: 'Type « D »' },
          { value: 'type_p', label: 'Type « P »' },
          { value: 'nac', label: 'NAC' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 25,
        name: 'Dispositif de sectionnement (Moteur)',
        options: OK_NC,
      },
      {
        item_number: 26,
        name: 'Emplacement du dispositif de sectionnement (Moteur)',
        options: OK_NC,
      },
      {
        item_number: 27,
        name: 'Calibre du circuit (Moteur)',
        options: OK_NC,
      },
      {
        item_number: 28,
        name: 'Calibre de la protection contre les surintensités (Moteur)',
        options: OK_NC,
      },
      {
        item_number: 29,
        name: 'Continuité des masses (Moteur)',
        options: CONTINUITE_MASSES_OPTIONS,
      },
      {
        item_number: 30,
        name: 'Emplacement (Moteur)',
        options: OK_NC,
      },
      {
        item_number: 31,
        name: 'Identification (Moteur)',
        options: OK_NC,
      },
    ],
  },

  // ========================================
  // 12 - CONTRÔLES
  // ========================================
  {
    code: '12',
    name: 'Contrôles',
    order_index: 15,
    has_na_option: true,
    has_location_field: true,
    has_volts_field: false,
    has_amps_field: false,
    has_power_field: false,
    extra_fields: { control_type: ['capteur', 'controleur', 'operateur'] },
    items: [
      {
        item_number: 1,
        name: 'État général',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'rouille', label: 'Rouille' },
          { value: 'eau', label: 'Eau' },
          { value: 'poussiere', label: 'Poussière' },
          { value: 'debouchure_ouverte', label: 'Débouchure ouverte' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 2,
        name: 'Isolant des câbles',
        options: ISOLANT_OPTIONS,
      },
      {
        item_number: 3,
        name: 'Connecteurs et embouts adéquats',
        options: OK_NC,
      },
      {
        item_number: 4,
        name: 'Type de câble',
        options: [
          { value: 'approuve', label: 'Approuvé pour l\'usage' },
          { value: 'nc', label: 'NC' },
        ],
        has_text_input: true,
        text_input_label: 'Type',
      },
      {
        item_number: 5,
        name: 'Conducteurs',
        options: CONDUCTEURS_OPTIONS,
      },
      {
        item_number: 6,
        name: 'Compatibilité Cu/Al',
        options: OK_NC,
      },
      {
        item_number: 7,
        name: 'Type de fusibles',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'type_d', label: 'Type « D »' },
          { value: 'type_p', label: 'Type « P »' },
          { value: 'nac', label: 'NAC' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 8,
        name: 'Calibre du circuit',
        options: OK_NC,
      },
      {
        item_number: 9,
        name: 'Calibre de la protection contre les surintensités',
        options: OK_NC,
      },
      {
        item_number: 10,
        name: 'Continuité des masses',
        options: CONTINUITE_MASSES_OPTIONS,
      },
      {
        item_number: 11,
        name: 'Emplacement',
        options: [
          { value: 'sec', label: 'Sec' },
          { value: 'classe_i', label: 'Classe I' },
          { value: 'classe_ii', label: 'Classe II' },
          { value: 'classe_iii', label: 'Classe III' },
          { value: 'cat_1', label: 'Cat. 1' },
          { value: 'cat_2', label: 'Cat. 2' },
          { value: 'ok', label: 'OK' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 12,
        name: 'Identification',
        options: OK_NC,
      },
    ],
  },

  // ========================================
  // 13 - CHAUFFAGE CENTRAL
  // ========================================
  {
    code: '13',
    name: 'Chauffage central',
    order_index: 16,
    has_na_option: true,
    has_location_field: true,
    has_volts_field: true,
    has_amps_field: true,
    has_power_field: true,
    extra_fields: { heating_type: ['electricite', 'gaz', 'mazout', 'bi_energie', 'autres'] },
    items: [
      {
        item_number: 1,
        name: 'État général',
        options: ETAT_GENERAL_OPTIONS,
      },
      {
        item_number: 2,
        name: 'Conducteurs vs charge',
        options: OK_NC,
      },
      {
        item_number: 3,
        name: 'Protection vs charge',
        options: OK_NC,
      },
      {
        item_number: 4,
        name: 'Protection vs conducteurs',
        options: OK_NC,
      },
      {
        item_number: 5,
        name: 'Connecteurs et embouts adéquats',
        options: OK_NC,
      },
      {
        item_number: 6,
        name: 'Type de câble',
        options: [
          { value: 'approuve', label: 'Approuvé pour l\'usage' },
          { value: 'nc', label: 'NC' },
        ],
        has_text_input: true,
        text_input_label: 'Type',
      },
      {
        item_number: 7,
        name: 'Conducteurs',
        options: CONDUCTEURS_OPTIONS,
      },
      {
        item_number: 8,
        name: 'Compatibilité Cu/Al',
        options: OK_NC,
      },
      {
        item_number: 9,
        name: 'Sectionneur',
        options: [
          { value: 'na', label: 'N/A' },
          { value: 'localisation_ok', label: 'Localisation OK' },
          { value: 'localisation_nc', label: 'Localisation NC' },
        ],
      },
      {
        item_number: 10,
        name: 'État du sectionneur',
        options: [
          { value: 'na', label: 'N/A' },
          { value: 'ok', label: 'OK' },
          { value: 'rouille', label: 'Rouille' },
          { value: 'isolant_brise', label: 'Isolant brisé' },
          { value: 'traces_surchauffe', label: 'Traces de surchauffe' },
        ],
      },
      {
        item_number: 11,
        name: 'Type de fusibles',
        options: FUSIBLES_OPTIONS,
      },
      {
        item_number: 12,
        name: 'Puissance modifiée',
        options: [
          { value: 'non', label: 'NON' },
          { value: 'oui', label: 'OUI' },
          { value: 'ok', label: 'OK' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 13,
        name: 'Continuité des masses',
        options: CONTINUITE_MASSES_OPTIONS,
      },
      {
        item_number: 14,
        name: 'Emplacement',
        options: OK_NC,
      },
      {
        item_number: 15,
        name: 'Ligne de gaz – MALT',
        options: OK_NC,
      },
    ],
  },

  // ========================================
  // 14 - CHAUFFAGE DISTRIBUÉ
  // ========================================
  {
    code: '14',
    name: 'Chauffage distribué',
    order_index: 17,
    has_na_option: true,
    has_location_field: true,
    has_volts_field: false,
    has_amps_field: false,
    has_power_field: false,
    extra_fields: { heating_type: ['plinthes', 'convecteurs', 'ventilo_convecteurs', 'autres'] },
    items: [
      {
        item_number: 1,
        name: 'État général',
        options: ETAT_GENERAL_OPTIONS,
      },
      {
        item_number: 2,
        name: 'Conducteurs vs charge',
        options: OK_NC,
      },
      {
        item_number: 3,
        name: 'Protection vs charge',
        options: OK_NC,
      },
      {
        item_number: 4,
        name: 'Protection vs conducteurs',
        options: OK_NC,
      },
      {
        item_number: 5,
        name: 'Connecteurs et embouts adéquats',
        options: OK_NC,
      },
      {
        item_number: 6,
        name: 'Type de câble',
        options: [
          { value: 'approuve', label: 'Approuvé pour l\'usage' },
          { value: 'nc', label: 'NC' },
        ],
        has_text_input: true,
        text_input_label: 'Type',
      },
      {
        item_number: 7,
        name: 'Conducteurs',
        options: CONDUCTEURS_OPTIONS,
      },
      {
        item_number: 8,
        name: 'Compatibilité Cu/Al',
        options: OK_NC,
      },
      {
        item_number: 9,
        name: 'Protection',
        options: [
          { value: 'disjoncteur', label: 'Disjoncteur' },
          { value: 'fusible', label: 'Fusible' },
        ],
      },
      {
        item_number: 10,
        name: 'Dispositif de protection bipolaire',
        options: OK_NC,
      },
      {
        item_number: 11,
        name: 'Type de fusibles',
        options: [
          { value: 'na', label: 'N/A' },
          { value: 'ok', label: 'OK' },
          { value: 'type_d', label: '« D »' },
          { value: 'type_p', label: '« P »' },
          { value: 'nac', label: 'NAC' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 12,
        name: 'Capacité du thermostat',
        options: OK_NC,
      },
      {
        item_number: 13,
        name: 'Localisation du thermostat',
        options: OK_NC,
      },
      {
        item_number: 14,
        name: 'Continuité des masses',
        options: CONTINUITE_MASSES_OPTIONS,
      },
      {
        item_number: 15,
        name: 'Emplacement',
        options: OK_NC,
      },
      {
        item_number: 16,
        name: 'Autres',
        options: OK_NC,
        has_text_input: true,
        text_input_label: 'Préciser',
      },
    ],
  },

  // ========================================
  // 15 - CHAUFFE-EAU
  // ========================================
  {
    code: '15',
    name: 'Chauffe-eau',
    order_index: 18,
    has_na_option: true,
    has_location_field: true,
    has_volts_field: true,
    has_amps_field: true,
    has_power_field: true,
    extra_fields: { heating_type: ['electricite', 'gaz', 'mazout', 'autres'] },
    items: [
      {
        item_number: 1,
        name: 'Type de chauffe-eau',
        options: [
          { value: 'commercial', label: 'Commercial' },
          { value: 'residentiel', label: 'Résidentiel' },
          { value: 'ok', label: 'OK' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 2,
        name: 'Raccordement',
        options: OK_NC,
      },
      {
        item_number: 3,
        name: 'Conducteurs vs charge',
        options: OK_NC,
      },
      {
        item_number: 4,
        name: 'Protection vs charge',
        options: OK_NC,
      },
      {
        item_number: 5,
        name: 'Protection vs conducteurs',
        options: OK_NC,
      },
      {
        item_number: 6,
        name: 'Connecteurs et embouts adéquats',
        options: OK_NC,
      },
      {
        item_number: 7,
        name: 'Type de câble',
        options: [
          { value: 'approuve', label: 'Approuvé pour l\'usage' },
          { value: 'nc', label: 'NC' },
        ],
        has_text_input: true,
        text_input_label: 'Type',
      },
      {
        item_number: 8,
        name: 'Conducteurs',
        options: CONDUCTEURS_OPTIONS,
      },
      {
        item_number: 9,
        name: 'Compatibilité Cu/Al',
        options: OK_NC,
      },
      {
        item_number: 10,
        name: 'Continuité des masses',
        options: CONTINUITE_MASSES_OPTIONS,
      },
      {
        item_number: 11,
        name: 'Dispositif de protection bipolaire',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'nc', label: 'NC' },
          { value: 'disjoncteur', label: 'Disjoncteur' },
          { value: 'fusible', label: 'Fusible' },
        ],
      },
      {
        item_number: 12,
        name: 'État du sectionneur',
        options: [
          { value: 'na', label: 'N/A' },
          { value: 'ok', label: 'OK' },
          { value: 'rouille', label: 'Rouille' },
          { value: 'isolant_brise', label: 'Isolant brisé' },
          { value: 'traces_surchauffe', label: 'Traces de surchauffe' },
        ],
      },
      {
        item_number: 13,
        name: 'Type de fusibles',
        options: FUSIBLES_OPTIONS,
      },
      {
        item_number: 14,
        name: 'Emplacement',
        options: OK_NC,
      },
    ],
  },

  // ========================================
  // 16 - CUISINIÈRE
  // ========================================
  {
    code: '16',
    name: 'Cuisinière',
    order_index: 19,
    has_na_option: true,
    has_location_field: false,
    has_volts_field: false,
    has_amps_field: false,
    has_power_field: false,
    extra_fields: { appliance_status: ['non_deplacee', 'electricite', 'gaz'] },
    items: [
      {
        item_number: 1,
        name: 'Isolant des câbles',
        options: [
          { value: 'nac', label: 'NAC' },
          { value: 'ok', label: 'OK' },
          { value: 'craquelure', label: 'Craquelure' },
          { value: 'decoloration', label: 'Décoloration' },
          { value: 'brisure', label: 'Brisure' },
        ],
      },
      {
        item_number: 2,
        name: 'Connecteurs et embouts adéquats',
        options: OK_NC,
      },
      {
        item_number: 3,
        name: 'Type de câble',
        options: [
          { value: 'approuve', label: 'Approuvé pour l\'usage' },
          { value: 'nc', label: 'NC' },
        ],
        has_text_input: true,
        text_input_label: 'Type',
      },
      {
        item_number: 4,
        name: 'Conducteurs',
        options: CONDUCTEURS_OPTIONS,
      },
      {
        item_number: 5,
        name: 'Compatibilité Cu/Al',
        options: OK_NC,
      },
      {
        item_number: 6,
        name: 'Conducteurs vs charge',
        options: OK_NC,
      },
      {
        item_number: 7,
        name: 'Protection vs charge',
        options: OK_NC,
      },
      {
        item_number: 8,
        name: 'Protection vs conducteurs',
        options: OK_NC,
      },
      {
        item_number: 9,
        name: 'Mise à la terre',
        options: OK_NC,
      },
      {
        item_number: 10,
        name: 'État physique',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'plaque_brisee', label: 'Plaque brisée' },
          { value: 'prise_brisee', label: 'Prise brisée' },
          { value: 'aucune_plaque', label: 'Aucune plaque' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 11,
        name: 'Continuité des masses',
        options: CONTINUITE_MASSES_OPTIONS,
      },
      {
        item_number: 12,
        name: 'Dispositif de protection bipolaire',
        options: [
          { value: 'disjoncteur', label: 'Disjoncteur' },
          { value: 'fusible', label: 'Fusible' },
          { value: 'ok', label: 'OK' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 13,
        name: 'Prise 14-50R',
        options: [
          { value: 'endommagee', label: 'Endommagée' },
          { value: 'ok', label: 'OK' },
          { value: 'nc', label: 'NC' },
        ],
      },
    ],
  },

  // ========================================
  // 17 - SÉCHEUSE
  // ========================================
  {
    code: '17',
    name: 'Sécheuse',
    order_index: 20,
    has_na_option: true,
    has_location_field: false,
    has_volts_field: false,
    has_amps_field: false,
    has_power_field: false,
    extra_fields: { appliance_status: ['non_deplacee', 'electricite', 'gaz'] },
    items: [
      {
        item_number: 1,
        name: 'Isolant des câbles',
        options: [
          { value: 'nac', label: 'NAC' },
          { value: 'ok', label: 'OK' },
          { value: 'craquelure', label: 'Craquelure' },
          { value: 'decoloration', label: 'Décoloration' },
          { value: 'brisure', label: 'Brisure' },
        ],
      },
      {
        item_number: 2,
        name: 'Connecteurs et embouts adéquats',
        options: OK_NC,
      },
      {
        item_number: 3,
        name: 'Type de câble',
        options: [
          { value: 'approuve', label: 'Approuvé pour l\'usage' },
          { value: 'nc', label: 'NC' },
        ],
        has_text_input: true,
        text_input_label: 'Type',
      },
      {
        item_number: 4,
        name: 'Conducteurs',
        options: CONDUCTEURS_OPTIONS,
      },
      {
        item_number: 5,
        name: 'Compatibilité Cu/Al',
        options: OK_NC,
      },
      {
        item_number: 6,
        name: 'Conducteurs vs charge',
        options: OK_NC,
      },
      {
        item_number: 7,
        name: 'Protection vs charge',
        options: OK_NC,
      },
      {
        item_number: 8,
        name: 'Protection vs conducteurs',
        options: OK_NC,
      },
      {
        item_number: 9,
        name: 'Mise à la terre',
        options: OK_NC,
      },
      {
        item_number: 10,
        name: 'État physique',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'plaque_brisee', label: 'Plaque brisée' },
          { value: 'prise_brisee', label: 'Prise brisée' },
          { value: 'aucune_plaque', label: 'Aucune plaque' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 11,
        name: 'Continuité des masses',
        options: CONTINUITE_MASSES_OPTIONS,
      },
      {
        item_number: 12,
        name: 'Dispositif de protection bipolaire',
        options: [
          { value: 'disjoncteur', label: 'Disjoncteur' },
          { value: 'fusible', label: 'Fusible' },
          { value: 'ok', label: 'OK' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 13,
        name: 'Prise 14-30R',
        options: [
          { value: 'endommagee', label: 'Endommagée' },
          { value: 'ok', label: 'OK' },
          { value: 'nc', label: 'NC' },
        ],
      },
    ],
  },

  // ========================================
  // 18 - PRISES ET INTERRUPTEURS
  // ========================================
  {
    code: '18',
    name: 'Prises et interrupteurs',
    order_index: 21,
    has_na_option: true,
    has_location_field: true,
    has_volts_field: false,
    has_amps_field: false,
    has_power_field: false,
    items: [
      {
        item_number: 1,
        name: 'État général',
        options: ETAT_GENERAL_OPTIONS,
      },
      {
        item_number: 2,
        name: 'Isolant de l\'appareillage',
        options: ISOLANT_OPTIONS,
      },
      {
        item_number: 3,
        name: 'Isolant des câbles',
        options: ISOLANT_OPTIONS,
      },
      {
        item_number: 4,
        name: 'Connecteurs et embouts adéquats',
        options: OK_NC,
      },
      {
        item_number: 5,
        name: 'Type de câble',
        options: [
          { value: 'approuve', label: 'Approuvé pour l\'usage' },
          { value: 'nc', label: 'NC' },
        ],
        has_text_input: true,
        text_input_label: 'Type',
      },
      {
        item_number: 6,
        name: 'Conducteurs',
        options: CONDUCTEURS_OPTIONS,
      },
      {
        item_number: 7,
        name: 'Compatibilité Cu/Al',
        options: OK_NC,
      },
      {
        item_number: 8,
        name: 'Calibre du circuit',
        options: OK_NC,
      },
      {
        item_number: 9,
        name: 'Calibre de la protection',
        options: OK_NC,
      },
      {
        item_number: 10,
        name: 'Test de polarité',
        options: OK_NC,
      },
      {
        item_number: 11,
        name: 'Mise à la terre',
        options: OK_NC,
      },
      {
        item_number: 12,
        name: 'DDFT (>2007)',
        options: OK_NC,
      },
      {
        item_number: 13,
        name: 'État physique',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'plaque_brisee', label: 'Plaque brisée' },
          { value: 'prise_brisee', label: 'Prise brisée' },
          { value: 'aucune_plaque', label: 'Aucune plaque' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 14,
        name: 'Continuité des masses',
        options: CONTINUITE_MASSES_OPTIONS,
      },
      {
        item_number: 15,
        name: 'Emplacement',
        options: OK_NC,
      },
      {
        item_number: 16,
        name: 'Prise à obturateurs',
        options: OK_NC,
      },
    ],
  },

  // ========================================
  // 19 - PRISES DANS SALLE DE BAINS OU TOILETTES
  // ========================================
  {
    code: '19',
    name: 'Prises dans salle de bains ou toilettes',
    order_index: 22,
    has_na_option: true,
    has_location_field: true,
    has_volts_field: false,
    has_amps_field: false,
    has_power_field: false,
    items: [
      {
        item_number: 1,
        name: 'État général',
        options: ETAT_GENERAL_OPTIONS,
      },
      {
        item_number: 2,
        name: 'Isolant de l\'appareillage',
        options: ISOLANT_OPTIONS,
      },
      {
        item_number: 3,
        name: 'Isolant des câbles',
        options: ISOLANT_OPTIONS,
      },
      {
        item_number: 4,
        name: 'Connecteurs et embouts adéquats',
        options: OK_NC,
      },
      {
        item_number: 5,
        name: 'Type de câble',
        options: [
          { value: 'approuve', label: 'Approuvé pour l\'usage' },
          { value: 'nc', label: 'NC' },
        ],
        has_text_input: true,
        text_input_label: 'Type',
      },
      {
        item_number: 6,
        name: 'Conducteurs',
        options: CONDUCTEURS_OPTIONS,
      },
      {
        item_number: 7,
        name: 'Compatibilité Cu/Al',
        options: OK_NC,
      },
      {
        item_number: 8,
        name: 'Calibre du circuit',
        options: OK_NC,
      },
      {
        item_number: 9,
        name: 'Calibre de la protection',
        options: OK_NC,
      },
      {
        item_number: 10,
        name: 'Test de polarité',
        options: OK_NC,
      },
      {
        item_number: 11,
        name: 'Mise à la terre',
        options: OK_NC,
      },
      {
        item_number: 12,
        name: 'DDFT (> 1987) ou rasoir',
        options: OK_NC,
      },
      {
        item_number: 13,
        name: 'État physique',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'plaque_brisee', label: 'Plaque brisée' },
          { value: 'prise_brisee', label: 'Prise brisée' },
          { value: 'aucune_plaque', label: 'Aucune plaque' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 14,
        name: 'Continuité des masses',
        options: CONTINUITE_MASSES_OPTIONS,
      },
      {
        item_number: 15,
        name: '> 500 mm douche ou baignoire',
        options: OK_NC,
      },
      {
        item_number: 16,
        name: 'Prises à obturateurs',
        options: OK_NC,
      },
    ],
  },

  // ========================================
  // 20 - PRISES EXTÉRIEURES
  // ========================================
  {
    code: '20',
    name: 'Prises extérieures',
    order_index: 23,
    has_na_option: true,
    has_location_field: true,
    has_volts_field: false,
    has_amps_field: false,
    has_power_field: false,
    items: [
      {
        item_number: 1,
        name: 'État général',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'rouille', label: 'Rouille' },
          { value: 'eau', label: 'Eau' },
          { value: 'poussiere', label: 'Poussière' },
          { value: 'debouchure_ouverte', label: 'Débouchure ouverte' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 2,
        name: 'Isolant de l\'appareillage',
        options: ISOLANT_OPTIONS,
      },
      {
        item_number: 3,
        name: 'Isolant des câbles',
        options: ISOLANT_OPTIONS,
      },
      {
        item_number: 4,
        name: 'Connecteurs et embouts adéquats',
        options: OK_NC,
      },
      {
        item_number: 5,
        name: 'Type de câble',
        options: [
          { value: 'approuve', label: 'Approuvé pour l\'usage' },
          { value: 'nc', label: 'NC' },
        ],
        has_text_input: true,
        text_input_label: 'Type',
      },
      {
        item_number: 6,
        name: 'Conducteurs',
        options: CONDUCTEURS_OPTIONS,
      },
      {
        item_number: 7,
        name: 'Compatibilité Cu/Al',
        options: OK_NC,
      },
      {
        item_number: 8,
        name: 'Calibre du circuit',
        options: OK_NC,
      },
      {
        item_number: 9,
        name: 'Calibre de la protection',
        options: OK_NC,
      },
      {
        item_number: 10,
        name: 'Test de polarité',
        options: OK_NC,
      },
      {
        item_number: 11,
        name: 'Mise à la terre',
        options: OK_NC,
      },
      {
        item_number: 12,
        name: 'Plaque résistante aux intempéries',
        options: OK_NC,
      },
      {
        item_number: 13,
        name: 'État physique',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'plaque_brisee', label: 'Plaque brisée' },
          { value: 'prise_brisee', label: 'Prise brisée' },
          { value: 'aucune_plaque', label: 'Aucune plaque' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 14,
        name: 'Continuité des masses',
        options: CONTINUITE_MASSES_OPTIONS,
      },
      {
        item_number: 15,
        name: 'Prises à obturateurs',
        options: OK_NC,
      },
    ],
  },

  // ========================================
  // 21 - AUTRES SORTIES
  // ========================================
  {
    code: '21',
    name: 'Autres sorties',
    order_index: 24,
    has_na_option: true,
    has_location_field: true,
    has_volts_field: false,
    has_amps_field: false,
    has_power_field: false,
    extra_fields: { outlet_type: ['luminaires', 'avertisseurs_fumee'] },
    items: [
      {
        item_number: 1,
        name: 'Luminaire',
        options: [
          { value: 'na', label: 'N/A' },
          { value: 'placard', label: 'Placard' },
          { value: 'ok', label: 'OK' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 2,
        name: 'Enseigne de sortie',
        options: NA_OK_NC,
      },
      {
        item_number: 3,
        name: 'Ampoules',
        options: NA_OK_NC,
      },
      {
        item_number: 4,
        name: 'Avertisseur de fumée',
        options: NA_OK_NC,
      },
      {
        item_number: 5,
        name: 'État général',
        options: ETAT_GENERAL_OPTIONS,
      },
      {
        item_number: 6,
        name: 'Isolant de l\'appareillage',
        options: ISOLANT_OPTIONS,
      },
      {
        item_number: 7,
        name: 'Isolant des câbles',
        options: ISOLANT_OPTIONS,
      },
      {
        item_number: 8,
        name: 'Connecteurs et embouts adéquats',
        options: OK_NC,
      },
      {
        item_number: 9,
        name: 'Type de câble',
        options: [
          { value: 'approuve', label: 'Approuvé pour l\'usage' },
          { value: 'nc', label: 'NC' },
        ],
        has_text_input: true,
        text_input_label: 'Type',
      },
      {
        item_number: 10,
        name: 'Conducteurs',
        options: CONDUCTEURS_OPTIONS,
      },
      {
        item_number: 11,
        name: 'Compatibilité Cu/Al',
        options: OK_NC,
      },
      {
        item_number: 12,
        name: 'Calibre du circuit',
        options: OK_NC,
      },
      {
        item_number: 13,
        name: 'Calibre de la protection',
        options: OK_NC,
      },
      {
        item_number: 14,
        name: 'Polarité',
        options: NA_OK_NC,
      },
      {
        item_number: 15,
        name: 'Mise à la terre',
        options: OK_NC,
      },
      {
        item_number: 16,
        name: 'Montage bout-à-bout vs autres circuits',
        options: NA_OK_NC,
      },
      {
        item_number: 17,
        name: 'État physique',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'lentille_brisee', label: 'Lentille brisée' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 18,
        name: 'Continuité des masses',
        options: CONTINUITE_MASSES_OPTIONS,
      },
      {
        item_number: 19,
        name: 'Emplacement',
        options: OK_NC,
      },
    ],
  },

  // ========================================
  // 22 - BOÎTES DE JONCTION ACCESSIBLES
  // ========================================
  {
    code: '22',
    name: 'Boîtes de jonction accessibles',
    order_index: 25,
    has_na_option: true,
    has_location_field: true,
    has_volts_field: false,
    has_amps_field: false,
    has_power_field: false,
    items: [
      {
        item_number: 1,
        name: 'État général',
        options: ETAT_GENERAL_OPTIONS,
      },
      {
        item_number: 2,
        name: 'Isolant des câbles',
        options: ISOLANT_OPTIONS,
      },
      {
        item_number: 3,
        name: 'Connecteurs et embouts adéquats',
        options: OK_NC,
      },
      {
        item_number: 4,
        name: 'Type de câble',
        options: [
          { value: 'approuve', label: 'Approuvé pour l\'usage' },
          { value: 'nc', label: 'NC' },
        ],
        has_text_input: true,
        text_input_label: 'Type',
      },
      {
        item_number: 5,
        name: 'Mise à la terre',
        options: OK_NC,
      },
      {
        item_number: 6,
        name: 'Conducteurs',
        options: CONDUCTEURS_OPTIONS,
      },
      {
        item_number: 7,
        name: 'Compatibilité Cu/Al',
        options: OK_NC,
      },
      {
        item_number: 8,
        name: 'État physique',
        options: [
          { value: 'ok', label: 'OK' },
          { value: 'bris', label: 'Bris' },
          { value: 'diff_plaque', label: '≠ plaque' },
          { value: 'nc', label: 'NC' },
        ],
      },
      {
        item_number: 9,
        name: 'Remplissage',
        options: OK_NC,
      },
      {
        item_number: 10,
        name: 'Continuité des masses',
        options: CONTINUITE_MASSES_OPTIONS,
      },
      {
        item_number: 11,
        name: 'Emplacement',
        options: OK_NC,
      },
    ],
  },

  // ========================================
  // 23 - DÉRIVATIONS DÉDIÉES
  // ========================================
  {
    code: '23',
    name: 'Dérivations dédiées (Attention à l\'âge de l\'installation)',
    order_index: 26,
    has_na_option: true,
    has_location_field: false,
    has_volts_field: false,
    has_amps_field: false,
    has_power_field: false,
    items: [
      {
        item_number: 1,
        name: 'Réfrigérateur ≥ 1977',
        options: [
          { value: 'na', label: 'N/A' },
          { value: 'oui', label: 'Oui' },
          { value: 'non', label: 'Non' },
        ],
      },
      {
        item_number: 2,
        name: 'Aire de lavage ou buanderie <1966',
        options: [
          { value: 'na', label: 'N/A' },
          { value: 'oui', label: 'Oui' },
          { value: 'non', label: 'Non' },
        ],
      },
      {
        item_number: 3,
        name: 'Local tout usage < 1966',
        options: [
          { value: 'na', label: 'N/A' },
          { value: 'oui', label: 'Oui' },
          { value: 'non', label: 'Non' },
        ],
      },
      {
        item_number: 4,
        name: 'Armoire ou niche pour micro-ondes ≥ 1987',
        options: [
          { value: 'na', label: 'N/A' },
          { value: 'oui', label: 'Oui' },
          { value: 'non', label: 'Non' },
        ],
      },
      {
        item_number: 5,
        name: 'Aspirateur central ≥ 1992',
        options: [
          { value: 'na', label: 'N/A' },
          { value: 'oui', label: 'Oui' },
          { value: 'non', label: 'Non' },
        ],
      },
      {
        item_number: 6,
        name: 'Coin-repas ≥ 1977',
        options: [
          { value: 'na', label: 'N/A' },
          { value: 'oui', label: 'Oui' },
          { value: 'non', label: 'Non' },
        ],
      },
      {
        item_number: 7,
        name: 'Chambres à coucher – anti-arcs ≥ 2004',
        options: [
          { value: 'na', label: 'N/A' },
          { value: 'oui', label: 'Oui' },
          { value: 'non', label: 'Non' },
        ],
      },
      {
        item_number: 8,
        name: 'Prises extérieures : logement / individuel R-de-C ≥ 1966 / 1977',
        options: [
          { value: 'na', label: 'N/A' },
          { value: 'oui', label: 'Oui' },
          { value: 'non', label: 'Non' },
        ],
      },
      {
        item_number: 9,
        name: 'Garage ou abri de voitures : logement / individuel ≥ 1977 / 92',
        options: [
          { value: 'na', label: 'N/A' },
          { value: 'oui', label: 'Oui' },
          { value: 'non', label: 'Non' },
        ],
      },
    ],
  },

  // ========================================
  // 24 - POINTS ADDITIONNELS À OBSERVER
  // ========================================
  {
    code: '24',
    name: 'Points additionnels à observer (Si applicables)',
    order_index: 27,
    has_na_option: true,
    has_location_field: false,
    has_volts_field: false,
    has_amps_field: false,
    has_power_field: false,
    items: [
      {
        item_number: 1,
        name: 'Approbation de l\'appareillage électrique',
        options: [],
        has_text_input: true,
        text_input_label: 'Notes',
      },
      {
        item_number: 2,
        name: 'Chauffage d\'appoint',
        options: [],
        has_text_input: true,
        text_input_label: 'Notes',
      },
      {
        item_number: 3,
        name: 'Contacteurs d\'éclairage',
        options: [],
        has_text_input: true,
        text_input_label: 'Notes',
      },
      {
        item_number: 4,
        name: 'Rallonges dissimulées ou fixées en permanence',
        options: [],
        has_text_input: true,
        text_input_label: 'Notes',
      },
      {
        item_number: 5,
        name: 'Prises multiples (pieuvres)',
        options: [],
        has_text_input: true,
        text_input_label: 'Notes',
      },
      {
        item_number: 6,
        name: 'Prises de courant : rétention',
        options: [],
        has_text_input: true,
        text_input_label: 'Notes',
      },
      {
        item_number: 7,
        name: 'Fixation des conduits',
        options: [],
        has_text_input: true,
        text_input_label: 'Notes',
      },
      {
        item_number: 8,
        name: 'Conduit PVC – Joints de dilatation',
        options: [],
        has_text_input: true,
        text_input_label: 'Notes',
      },
      {
        item_number: 9,
        name: 'Fixation des câbles',
        options: [],
        has_text_input: true,
        text_input_label: 'Notes',
      },
      {
        item_number: 10,
        name: 'Fixation de l\'appareillage',
        options: [],
        has_text_input: true,
        text_input_label: 'Notes',
      },
      {
        item_number: 11,
        name: 'Intégrité de l\'appareillage : couvercle manquant, « socket » de fluorescent cassé',
        options: [],
        has_text_input: true,
        text_input_label: 'Notes',
      },
      {
        item_number: 12,
        name: 'Câblage en surface, endommagement mécanique',
        options: [],
        has_text_input: true,
        text_input_label: 'Notes',
      },
      {
        item_number: 13,
        name: 'Nombre de fils dans un connecteur',
        options: [],
        has_text_input: true,
        text_input_label: 'Notes',
      },
      {
        item_number: 14,
        name: 'Raccordement aux bornes des conducteurs (brins coupés, etc.)',
        options: [],
        has_text_input: true,
        text_input_label: 'Notes',
      },
    ],
  },
];

// Calcul du nombre total d'items
export const TOTAL_ITEMS_COUNT = ELECTRICAL_INSPECTION_SECTIONS.reduce(
  (total, section) => total + section.items.length,
  0
);

export const TOTAL_SECTIONS_COUNT = ELECTRICAL_INSPECTION_SECTIONS.length;
