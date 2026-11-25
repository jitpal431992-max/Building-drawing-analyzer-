import { DSRMasterItem } from '../types';

export interface TagAnalysisInput {
  description: string;
  category?: string;
  chapter?: string;
  itemType?: string;
  groupHeading?: string;
  footnote?: string;
  unit?: string | null;
  variantText?: string;
}

export type TagDomain =
  | 'Function'
  | 'Safety & Protection'
  | 'Environment'
  | 'System'
  | 'Installation'
  | 'Material';

export interface TagSuggestion {
  tag: string;
  domain: TagDomain;
  reason: string;
  score: number;
}

interface TagRule {
  tag: string;
  domain: TagDomain;
  priority: number;
  /** Keywords/phrases checked against description (primary) and metadata (secondary) */
  patterns: RegExp[];
  /** Optional exclusion pattern: if it matches AND no strong description hit occurs, suppress */
  excludePatterns?: RegExp[];
  /** Equivalent existing canonical tags so we avoid near-duplicates */
  aliases?: string[];
  /** Whether metadata (category/chapter/itemType) may contribute, or description-only */
  allowMetadataFallback?: boolean;
}

const TAG_RULES: TagRule[] = [
  {
    tag: 'Wiring',
    domain: 'Function',
    priority: 100,
    patterns: [
      /\bwiring\b/i,
      /\brewiring\b/i,
      /\bpoint\s+wiring\b/i,
      /\blight\s+point\b/i,
      /\bfan\s+point\b/i,
      /\bcall\s+bell\b/i,
      /\bsub-?main\b/i,
      /\bcircuit\s+wiring\b/i,
      /\bloop\s+earthing\b/i,
      /\bsingle\s+core\s+cable\b/i,
      /\bconductor\s+cable\b/i,
      /\bswitch\s+box\b/i,
      /\bpiano\s+type\b/i,
      /\bmodular\s+(switch|socket|plate)\b/i,
    ],
    allowMetadataFallback: true,
  },
  {
    tag: 'Safety',
    domain: 'Safety & Protection',
    priority: 98,
    patterns: [
      /\bsafety\b/i,
      /\belcb\b/i,
      /\brccb\b/i,
      /\brcbo\b/i,
      /\bearth\s+leakage\b/i,
      /\bsurge\s+(protection|arrestor|arrester|suppressor|diverter)\b/i,
      /\bspd\b/i,
      /\blightning\s+(arrestor|arrester|protection|conductor)\b/i,
      /\bfire\s+(alarm|extinguisher|hydrant|sprinkler|pump|rated|retardant|survival|stop|barrier|detection|curtain)\b/i,
      /\bfrls\b/i,
      /\bhffr\b/i,
      /\blszh\b/i,
      /\bflameproof\b/i,
      /\bexplosion\s*proof\b/i,
      /\bemergency\s+(stop|light|exit|push|lighting)\b/i,
      /\binterlock(?:ing|ed)?\b/i,
      /\bearthing\b/i,
      /\bshock\s+(treatment|chart)\b/i,
      /\bdanger\s+(board|plate|notice)\b/i,
      /\binsulat(?:ing|ed)\s+(rubber\s+)?mat\b/i,
      /\bsmoke\s+detector\b/i,
      /\bheat\s+detector\b/i,
      /\bsafety\s+(device|switch|gear|belt|shoe|helmet|sensor|edge|curtain)\b/i,
      /\boverload\s+(protection|relay)\b/i,
      /\bshort\s+circuit\b/i,
    ],
    allowMetadataFallback: true,
  },
  {
    tag: 'Outdoor',
    domain: 'Environment',
    priority: 95,
    patterns: [
      /\boutdoor\b/i,
      /\bweather\s*-?\s*proof\b/i,
      /\bexternal\s+(lighting|electrification|feeder|cable)\b/i,
      /\bstreet\s+light(?:ing)?\b/i,
      /\bflood\s*light\b/i,
      /\bhigh\s*mast\b/i,
      /\bbollard\b/i,
      /\bgarden\s+(light|luminaire|post)\b/i,
      /\bpost\s+top\b/i,
      /\bfacade\s+light\b/i,
      /\bpole\s+mount(?:ed)?\b/i,
      /\boctagonal\s+pole\b/i,
      /\btubular\s+pole\b/i,
      /\boverhead\s+line\b/i,
      /\bfeeder\s+pillar\b/i,
      /\bip\s*-?\s*6[5678]\b/i,
      /\bearth\s+pit\b/i,
      /\bunder\s*ground\b/i,
      /\bopen\s+air\b/i,
      /\bsolar\s+(module|panel|street|photovoltaic)\b/i,
    ],
    allowMetadataFallback: true,
  },
  {
    tag: 'Indoor',
    domain: 'Environment',
    priority: 82,
    patterns: [
      /\bindoor\b/i,
      /\binterior\b/i,
      /\brecessed\b/i,
      /\bfalse\s+ceiling\b/i,
      /\bconcealed\b/i,
      /\bceiling\s+(mounted|rose|fan)\b/i,
      /\bsplit\s+(type\s+)?air\s*conditioner\b/i,
      /\bcassette\s+(unit|ac|type)\b/i,
      /\bindoor\s+unit\b/i,
      /\bconference\s+room\b/i,
      /\bauditorium\b/i,
      /\bip\s*-?\s*20\b/i,
    ],
    allowMetadataFallback: false,
  },
  {
    tag: 'Lighting',
    domain: 'System',
    priority: 92,
    patterns: [
      /\blight(?:ing)?\s+(fitting|fixture|point|luminaire|system|pole)\b/i,
      /\bluminaire\b/i,
      /\bled\b/i,
      /\bbatten\b/i,
      /\bdownlight(?:er)?\b/i,
      /\bflood\s*light\b/i,
      /\bstreet\s+light\b/i,
      /\btube\s*light\b/i,
      /\blamp\b/i,
      /\bhigh\s*bay\b/i,
      /\bbollard\b/i,
      /\bemergency\s+light\b/i,
      /\bexit\s+sign\b/i,
      /\blumen\b/i,
      /\bfluorescent\b/i,
      /\bchandelier\b/i,
    ],
    allowMetadataFallback: true,
  },
  {
    tag: 'Earthing',
    domain: 'Safety & Protection',
    priority: 90,
    patterns: [
      /\bearthing\b/i,
      /\bearth\s+(wire|strip|electrode|pit|plate|bus|bar|connection)\b/i,
      /\bloop\s+earthing\b/i,
      /\bchemical\s+earthing\b/i,
      /\bgrounding\b/i,
      /\bfunnel\b/i,
    ],
    allowMetadataFallback: true,
  },
  {
    tag: 'Switchgear',
    domain: 'System',
    priority: 89,
    patterns: [
      /\bmcb\b/i,
      /\bmccb\b/i,
      /\bacb\b/i,
      /\bvcb\b/i,
      /\bsfu\b/i,
      /\bisolator\b/i,
      /\bdistribution\s+board\b/i,
      /\bdb\b/,
      /\bswitch\s*board\b/i,
      /\bmv\s+panel\b/i,
      /\blt\s+panel\b/i,
      /\bht\s+panel\b/i,
      /\bcontrol\s+panel\b/i,
      /\bsub\s*-?\s*distribution\b/i,
      /\bbus\s*bar\b/i,
      /\bchangeover\s+switch\b/i,
      /\bcontactor\b/i,
      /\bmccb\s+enclosure\b/i,
      /\bcircuit\s+breaker\b/i,
    ],
    allowMetadataFallback: true,
  },
  {
    tag: 'Cabling',
    domain: 'System',
    priority: 88,
    patterns: [
      /\barmoured\b/i,
      /\bunarmoured\b/i,
      /\bxlpe\b/i,
      /\bpower\s+cable\b/i,
      /\bcontrol\s+cable\b/i,
      /\bcable\s+(tray|trench|gland|joint(?:ing)?|termination|route|laying)\b/i,
      /\braceway\b/i,
      /\bdrawing\s+following\s+sizes\b/i,
      /\bflexible\s+.*cable\b/i,
      /\bfibre\s+optic\b/i,
      /\bfiber\s+optic\b/i,
      /\bco-?axial\b/i,
      /\bcat-?\s*6\b/i,
    ],
    allowMetadataFallback: true,
  },
  {
    tag: 'Conduit',
    domain: 'Installation',
    priority: 80,
    patterns: [
      /\bconduit\b/i,
      /\bms\s+box\b/i,
      /\bgi\s+box\b/i,
      /\bjunction\s+box\b/i,
      /\bdraw\s+box\b/i,
      /\bcasing\s*(?:&|and)?\s*capping\b/i,
    ],
    allowMetadataFallback: true,
  },
  {
    tag: 'Fire Safety',
    domain: 'Safety & Protection',
    priority: 94,
    patterns: [
      /\bfire\s+(detection|alarm|extinguisher|hydrant|sprinkler|pump|curtain|survival|rated|fighting)\b/i,
      /\bwet\s+riser\b/i,
      /\bhose\s+reel\b/i,
      /\bsmoke\s+detector\b/i,
      /\bheat\s+detector\b/i,
      /\bmanual\s+call\s+point\b/i,
      /\bhooter\b/i,
      /\bjockey\s+pump\b/i,
      /\blanding\s+valve\b/i,
      /\bbranch\s+pipe\b/i,
      /\bresponse\s+indicator\b/i,
    ],
    allowMetadataFallback: true,
  },
  {
    tag: 'HVAC',
    domain: 'System',
    priority: 87,
    patterns: [
      /\bhvac\b/i,
      /\bair\s*-?\s*condition(?:ing|er)\b/i,
      /\bchiller\b/i,
      /\bchilled\s+water\b/i,
      /\bahu\b/i,
      /\bair\s+handling\s+unit\b/i,
      /\bfan\s+coil\s+unit\b/i,
      /\bfcu\b/i,
      /\bvrf\b/i,
      /\bvrv\b/i,
      /\bduct(?:ing|work)?\b/i,
      /\bcooling\s+tower\b/i,
      /\brefrigerant\b/i,
      /\bdiffuser\b/i,
      /\bdamper\b/i,
      /\bsplit\s+(?:type\s+)?ac\b/i,
      /\bcassette\s+(?:type\s+)?(?:ac|unit)\b/i,
      /\bprecision\s+ac\b/i,
      /\bnitrile\s+rubber\b/i,
    ],
    allowMetadataFallback: true,
  },
  {
    tag: 'Ventilation',
    domain: 'System',
    priority: 84,
    patterns: [
      /\bventilation\b/i,
      /\bexhaust\s+fan\b/i,
      /\bceiling\s+fan\b/i,
      /\bwall\s+fan\b/i,
      /\baxial\s+fan\b/i,
      /\bpropeller\s+fan\b/i,
      /\bjet\s+fan\b/i,
      /\bfresh\s+air\b/i,
      /\bblower\b/i,
      /\bsmoke\s+extraction\b/i,
    ],
    allowMetadataFallback: true,
  },
  {
    tag: 'Backup Power',
    domain: 'System',
    priority: 86,
    patterns: [
      /\bdiesel\s+generat(?:ing|or)\b/i,
      /\bdg\s+set\b/i,
      /\bups\b/i,
      /\buninterruptible\s+power\b/i,
      /\binverter\b/i,
      /\bbattery\s*(?:bank|charger)?\b/i,
      /\bamf\s+panel\b/i,
      /\bauto\s+mains\s+failure\b/i,
    ],
    allowMetadataFallback: true,
  },
  {
    tag: 'Solar',
    domain: 'System',
    priority: 85,
    patterns: [
      /\bsolar\b/i,
      /\bphotovoltaic\b/i,
      /\bspv\b/i,
      /\bmppt\b/i,
      /\bnet\s+meter\b/i,
    ],
    allowMetadataFallback: true,
  },
  {
    tag: 'Low Voltage',
    domain: 'System',
    priority: 83,
    patterns: [
      /\blow\s+voltage\b/i,
      /\bextra-?low\s+voltage\b/i,
      /\bepabx\b/i,
      /\bip-?pbx\b/i,
      /\bcctv\b/i,
      /\bcamera\b/i,
      /\bnvr\b/i,
      /\baccess\s+control\b/i,
      /\bbiometric\b/i,
      /\bboom\s+barrier\b/i,
      /\bpublic\s+address\b/i,
      /\bstructured\s+cabling\b/i,
      /\bpatch\s+(?:panel|cord)\b/i,
      /\btelephone\b/i,
      /\bintercom\b/i,
      /\bav\s+system\b/i,
      /\baudio\s+visual\b/i,
    ],
    allowMetadataFallback: true,
  },
  {
    tag: 'Pumping',
    domain: 'System',
    priority: 81,
    patterns: [
      /\bpump(?:ing|set)?\b/i,
      /\bmonoblock\b/i,
      /\bsubmersible\b/i,
      /\bcentrifugal\b/i,
      /\bhydro-?pneumatic\b/i,
      /\bbooster\b/i,
      /\bpressure\s+vessel\b/i,
      /\bsuction\b/i,
    ],
    allowMetadataFallback: false,
  },
  {
    tag: 'High Voltage',
    domain: 'System',
    priority: 81,
    patterns: [
      /\b11\s*kv\b/i,
      /\b22\s*kv\b/i,
      /\b33\s*kv\b/i,
      /\b66\s*kv\b/i,
      /\bht\s+(?:cable|panel|breaker|switchgear|termination|joint)\b/i,
      /\btransformer\b/i,
      /\brmu\b/i,
      /\bring\s+main\s+unit\b/i,
      /\bcompact\s+sub-?station\b/i,
      /\bsub-?station\b/i,
    ],
    allowMetadataFallback: true,
  },
  {
    tag: 'Lifts & Escalators',
    domain: 'System',
    priority: 80,
    patterns: [
      /\bpassenger\s+lift\b/i,
      /\belevator\b/i,
      /\bescalator\b/i,
      /\btravelator\b/i,
      /\blift\s+(?:shaft|car|well|door|machine)\b/i,
      /\bautomatic\s+rescue\s+device\b/i,
    ],
    allowMetadataFallback: true,
  },
  {
    tag: 'Weatherproof',
    domain: 'Environment',
    priority: 79,
    patterns: [
      /\bweather\s*-?\s*proof\b/i,
      /\bwater\s*-?\s*proof\b/i,
      /\bdust\s*-?\s*proof\b/i,
      /\bip\s*-?\s*6[5678]\b/i,
      /\bip\s*-?\s*5[45]\b/i,
      /\brain\s*proof\b/i,
    ],
    aliases: ['IP65', 'IP66', 'IP67', 'IP68'],
    allowMetadataFallback: false,
  },
  {
    tag: 'Energy Efficient',
    domain: 'Function',
    priority: 76,
    patterns: [
      /\benergy\s+efficient\b/i,
      /\bbldc\b/i,
      /\bbee\s+\d?\s*star\b/i,
      /\bstar\s+rated\b/i,
      /\bvfd\b/i,
      /\bvariable\s+frequency\s+drive\b/i,
      /\bapfc\b/i,
      /\bpower\s+factor\b/i,
      /\bcapacitor\s+bank\b/i,
      /\bie-?[234]\s+motor\b/i,
    ],
    aliases: ['Energy efficient', 'BEE star rated'],
    allowMetadataFallback: false,
  },
  {
    tag: 'Automation',
    domain: 'Function',
    priority: 75,
    patterns: [
      /\bautomation\b/i,
      /\bautomatic\b/i,
      /\bauto\s*-?\s*control\b/i,
      /\bbms\b/i,
      /\bscada\b/i,
      /\bplc\b/i,
      /\boccupancy\s+sensor\b/i,
      /\bmotion\s+sensor\b/i,
      /\bdaylight\s+sensor\b/i,
      /\bdimmable\b/i,
      /\baddressable\b/i,
      /\btimer\b/i,
    ],
    aliases: ['Automatic / Auto-control', 'Smart / Networked'],
    allowMetadataFallback: false,
  },
  {
    tag: 'Maintenance',
    domain: 'Function',
    priority: 74,
    patterns: [
      /\brepair(?:ing)?\b/i,
      /\bmaintenance\b/i,
      /\bservicing\b/i,
      /\boverhauling\b/i,
      /\bdismantling\b/i,
      /\brewiring\b/i,
      /\breplacement\b/i,
      /\btesting\s+and\s+commissioning\b/i,
    ],
    aliases: ['Repair / Maintenance'],
    allowMetadataFallback: false,
  },
  {
    tag: 'Copper',
    domain: 'Material',
    priority: 70,
    patterns: [/\bcopper\b/i, /\bcu\s+conductor\b/i],
    allowMetadataFallback: false,
  },
  {
    tag: 'Aluminium',
    domain: 'Material',
    priority: 69,
    patterns: [/\baluminium\b/i, /\baluminum\b/i],
    allowMetadataFallback: false,
  },
  {
    tag: 'PVC',
    domain: 'Material',
    priority: 68,
    patterns: [/\bpvc\b/i, /\bupvc\b/i],
    allowMetadataFallback: false,
  },
  {
    tag: 'GI (Galvanised Iron)',
    domain: 'Material',
    priority: 67,
    patterns: [/\bg\.?\s*i\.?\b/i, /\bgalvanis(?:ed|ed)\s+iron\b/i, /\bhot\s+dip\s+galvanized\b/i],
    aliases: ['GI', 'GI (Galvanised Iron)'],
    allowMetadataFallback: false,
  },
  {
    tag: 'FRLS',
    domain: 'Safety & Protection',
    priority: 66,
    patterns: [/\bfrls\b/i, /\bflame\s+retardant\s+low\s+smoke\b/i],
    allowMetadataFallback: false,
  },
  {
    tag: 'Modular',
    domain: 'Installation',
    priority: 65,
    patterns: [/\bmodular\b/i],
    allowMetadataFallback: false,
  },
];

function extractMatchSnippet(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match ? match[0].trim() : null;
}

function normalizeTagKey(tag: string): string {
  return tag.trim().toLowerCase();
}

/**
 * Analyzes an item's description (and optional metadata such as category, chapter,
 * itemType, footnote, and variant descriptions) to produce detailed tag suggestions.
 */
export function analyzeDescriptionForTags(
  input: string | TagAnalysisInput,
  existingTags: string[] = []
): TagSuggestion[] {
  const normalizedInput: TagAnalysisInput =
    typeof input === 'string' ? { description: input } : input;

  const primaryText = [
    normalizedInput.description || '',
    normalizedInput.variantText || '',
    normalizedInput.footnote || '',
  ]
    .filter(Boolean)
    .join(' ');

  const metadataText = [
    normalizedInput.category || '',
    normalizedInput.chapter || '',
    normalizedInput.itemType || '',
    normalizedInput.groupHeading || '',
  ]
    .filter(Boolean)
    .join(' ');

  if (!primaryText.trim() && !metadataText.trim()) {
    return [];
  }

  const existingNormalized = new Set(existingTags.map(normalizeTagKey));
  const suggestions: TagSuggestion[] = [];

  for (const rule of TAG_RULES) {
    // Skip if tag or any alias already exists on the item
    const ruleKeys = [rule.tag, ...(rule.aliases || [])].map(normalizeTagKey);
    if (ruleKeys.some((k) => existingNormalized.has(k))) {
      continue;
    }

    if (rule.excludePatterns?.some((ex) => ex.test(primaryText))) {
      continue;
    }

    const matchedInPrimary: string[] = [];
    for (const pat of rule.patterns) {
      const hit = extractMatchSnippet(primaryText, pat);
      if (hit && !matchedInPrimary.some((m) => m.toLowerCase() === hit.toLowerCase())) {
        matchedInPrimary.push(hit);
      }
    }

    const matchedInMeta: string[] = [];
    if (rule.allowMetadataFallback) {
      for (const pat of rule.patterns) {
        const hit = extractMatchSnippet(metadataText, pat);
        if (hit && !matchedInMeta.some((m) => m.toLowerCase() === hit.toLowerCase())) {
          matchedInMeta.push(hit);
        }
      }
    }

    if (matchedInPrimary.length === 0 && matchedInMeta.length === 0) {
      continue;
    }

    const allHits = [...matchedInPrimary, ...matchedInMeta].slice(0, 3);
    const score =
      rule.priority +
      matchedInPrimary.length * 12 +
      matchedInMeta.length * 4;

    suggestions.push({
      tag: rule.tag,
      domain: rule.domain,
      reason: `Matched: ${allHits.join(', ')}`,
      score,
    });
  }

  return suggestions.sort((a, b) => b.score - a.score);
}

/**
 * Analyzes an item description (or full item metadata) and automatically suggests
 * relevant tags (e.g., 'Wiring', 'Safety', 'Outdoor') to improve catalog searchability.
 */
export function suggestTagsFromDescription(
  input: string | TagAnalysisInput,
  existingTags: string[] = [],
  maxSuggestions = 10
): string[] {
  return analyzeDescriptionForTags(input, existingTags)
    .slice(0, maxSuggestions)
    .map((s) => s.tag);
}

/**
 * Enriches a single DSRMasterItem with auto-suggested tags derived from its
 * description, metadata, and variants without duplicating existing tags.
 */
export function enrichItemWithSuggestedTags(item: DSRMasterItem): {
  item: DSRMasterItem;
  addedTags: string[];
} {
  const existing = Array.isArray(item.tg) ? item.tg : [];
  const variantText = (item.variants || [])
    .filter((v) => !v.isDeleted)
    .map((v) => `${v.name} ${v.unit}`)
    .join(' ');

  const suggested = suggestTagsFromDescription(
    {
      description: item.d || '',
      category: item.g,
      chapter: item.h,
      itemType: item.t,
      groupHeading: item.gr,
      footnote: item.f,
      unit: item.u,
      variantText,
    },
    existing,
    8
  );

  if (suggested.length === 0) {
    return { item, addedTags: [] };
  }

  return {
    item: {
      ...item,
      tg: [...existing, ...suggested],
    },
    addedTags: suggested,
  };
}

/**
 * Batch-analyzes all catalog items and merges auto-suggested tags into items
 * cleanly without altering modified/review flags.
 */
export function enrichCatalogWithSuggestedTags(items: DSRMasterItem[]): {
  items: DSRMasterItem[];
  updatedItems: number;
  totalTagsAdded: number;
} {
  let updatedItems = 0;
  let totalTagsAdded = 0;

  const nextItems = items.map((item) => {
    const { item: enriched, addedTags } = enrichItemWithSuggestedTags(item);
    if (addedTags.length > 0) {
      updatedItems += 1;
      totalTagsAdded += addedTags.length;
    }
    return enriched;
  });

  return {
    items: nextItems,
    updatedItems,
    totalTagsAdded,
  };
}
