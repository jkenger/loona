export type ClauseKey = "default" | "acceleration" | "attorneysFees" | "waiver" | "venue"
export type ClauseText = { en: string; fil: string }
export type CustomClauses = Partial<Record<ClauseKey, ClauseText>>

export const CLAUSE_KEYS: ClauseKey[] = [
  "default",
  "acceleration",
  "attorneysFees",
  "waiver",
  "venue",
]

export const CLAUSE_LABELS: Record<ClauseKey, string> = {
  default: "Default",
  acceleration: "Acceleration Clause",
  attorneysFees: "Attorney's Fees and Collection Costs",
  waiver: "Waiver of Demand and Notice",
  venue: "Venue",
}

export const DEFAULT_CLAUSES: Record<ClauseKey, ClauseText> = {
  default: {
    en: "In the event of default in the payment of any installment when due, the entire outstanding balance of this note, together with accrued interest, shall immediately become due and payable without further demand or notice.",
    fil: "Sa pagkabigong makabayad ng anumang hulog sa takdang araw, ang buong natitirang balanse ng kasulatan ito, kasama ang naipon na tubo, ay agad na magiging dapat bayaran nang walang karagdagang paalala o abiso.",
  },
  acceleration: {
    en: "Upon default, the Lender shall have the right to declare the entire unpaid balance immediately due and payable, and may proceed to collect the same through any legal means available.",
    fil: "Sa pagkabigo, ang Lender ay may karapatang ideklara ang buong hindi pa nababayarang balanse na agad at buong dapat bayaran, at maaaring magsagawa ng pagsingil sa pamamagitan ng anumang legal na paraan.",
  },
  attorneysFees: {
    en: "In the event of judicial or extrajudicial collection, the Borrower agrees to pay attorney's fees equivalent to ten percent (10%) of the total amount due, but in no case less than Two Thousand Pesos (₱2,000.00), plus costs of suit and other litigation expenses.",
    fil: "Sa pagkakataon ng pagsingil sa hukuman o labas ng hukuman, ang Borrower ay sumasang-ayon na magbayad ng attorney's fees na katumbas ng sampung porsiyento (10%) ng kabuuang halagang dapat bayaran, ngunit hindi bababa sa Dalawang Libong Piso (₱2,000.00), dagdag pa ang mga gastos sa paghahabla at iba pang gastusin sa paglilitis.",
  },
  waiver: {
    en: "The Borrower hereby waives demand, presentment for payment, notice of dishonor, protest, and notice of protest of this note.",
    fil: "Itinatakwil ng Borrower ang kahilingan, paglalahad para sa pagbabayad, paunawa ng kawalan ng dangal, protesta, at paunawa ng protesta ng kasulatan ito.",
  },
  venue: {
    en: "Any legal action arising from or in connection with this Promissory Note shall be filed exclusively in the proper courts of the city or municipality where the Lender resides, to the exclusion of all other venues.",
    fil: "Ang anumang legal na aksyon na nagmumula sa o may kaugnayan sa Promissory Note na ito ay ihahain nang eksklusibo sa wastong hukuman ng lungsod o munisipalidad kung saan naninirahan ang Lender, na ibinubukod ang lahat ng iba pang venue.",
  },
}

export function parseCustomClauses(json: string | null): CustomClauses {
  if (!json) return {}
  try {
    return JSON.parse(json) as CustomClauses
  } catch {
    return {}
  }
}

export function resolveClause(key: ClauseKey, customClauses: CustomClauses): ClauseText {
  return customClauses[key] ?? DEFAULT_CLAUSES[key]
}

export function isClauseCustomized(key: ClauseKey, customClauses: CustomClauses): boolean {
  return key in customClauses
}
