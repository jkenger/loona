import type { Icon } from "@phosphor-icons/react"
import {
  UsersFour,
  CheckSquare,
  CurrencyCircleDollar,
  WarningOctagon,
  Megaphone,
  ThumbsUp,
} from "@phosphor-icons/react"

export interface PlaybookSectionDef {
  key: string
  title: string
  description: string
  icon: Icon
}

export const PLAYBOOK_SECTIONS: PlaybookSectionDef[] = [
  {
    key: "borrower_tiers",
    title: "Borrower Tiers",
    description: "Who qualifies for what loan amount",
    icon: UsersFour,
  },
  {
    key: "qualification_checklist",
    title: "Qualification Checklist",
    description: "What to verify before approving any loan",
    icon: CheckSquare,
  },
  {
    key: "pricing_guide",
    title: "Pricing Guide",
    description: "How to determine interest rate and terms",
    icon: CurrencyCircleDollar,
  },
  {
    key: "red_flags",
    title: "Red Flags",
    description: "When to walk away from a borrower",
    icon: WarningOctagon,
  },
  {
    key: "collection_rules",
    title: "Collection Rules",
    description: "How to follow up on late payments",
    icon: Megaphone,
  },
  {
    key: "dos_and_donts",
    title: "Do's and Don'ts",
    description: "General conduct expectations",
    icon: ThumbsUp,
  },
]

export const PLAYBOOK_SECTION_KEYS = PLAYBOOK_SECTIONS.map((s) => s.key)
