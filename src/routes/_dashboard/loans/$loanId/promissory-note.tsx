import { createFileRoute, Link, useRouter } from "@tanstack/react-router"
import { useRef, useState, useEffect, useMemo } from "react"
import { getLoan, updateLoanClauses } from "@/server/loans"
import {
  getDocumentSignatures,
  saveLenderSignature,
  generateSigningLink,
  deleteSignature,
} from "@/server/signatures"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { SkeletonDetailPage } from "@/components/ui/skeleton"
import { AccessDenied } from "@/components/access-denied"
import { SignaturePad } from "@/components/ui/signature-pad"
import { SignatureBlock } from "@/components/documents/signature-block"
import { hasRole, ROLES } from "@/lib/constants/roles"
import {
  ArrowLeft,
  FilePdf,
  Spinner,
  PencilSimple,
  ArrowCounterClockwise,
  X,
  CaretDown,
  Check,
  PenNib,
  LinkSimple,
  Trash,
} from "@phosphor-icons/react"
import { toast } from "sonner"
import { format } from "date-fns"
import {
  type ClauseKey,
  type ClauseText,
  type CustomClauses,
  CLAUSE_KEYS,
  CLAUSE_LABELS,
  DEFAULT_CLAUSES,
  parseCustomClauses,
  resolveClause,
} from "@/lib/constants/promissory-clauses"

type Lang = "en" | "fil"

export const Route = createFileRoute(
  "/_dashboard/loans/$loanId/promissory-note"
)({
  loader: async ({ params, context }) => {
    const { session } = context as {
      session: { user: { role: string | null; name: string | null } }
    }
    if (!hasRole(session.user.role, ROLES.LENDER)) {
      return { loan: null, unauthorized: true, lenderName: null, signatures: [] }
    }

    try {
      const loan = await getLoan({ data: params.loanId })
      if (!loan.isLender) {
        return { loan: null, unauthorized: true, lenderName: null, signatures: [] }
      }

      let signatures: Awaited<ReturnType<typeof getDocumentSignatures>> = []
      try {
        signatures = await getDocumentSignatures({
          data: { loanId: params.loanId, documentType: "promissory_note" },
        })
      } catch {
        // Signatures not available yet
      }

      return { loan, unauthorized: false, lenderName: session.user.name, signatures }
    } catch {
      return { loan: null, unauthorized: false, lenderName: null, signatures: [] }
    }
  },
  pendingComponent: SkeletonDetailPage,
  component: PromissoryNotePage,
})

function useDocColors(pdfMode: boolean) {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const check = () =>
      setIsDark(document.documentElement.classList.contains("dark"))
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })
    return () => observer.disconnect()
  }, [])

  const dark = isDark && !pdfMode

  return {
    bg: dark ? "#1e293b" : "white",
    text: dark ? "#e2e8f0" : "#374151",
    textStrong: dark ? "#f1f5f9" : "#111827",
    muted: dark ? "#94a3b8" : "#6b7280",
    border: dark ? "#334155" : "#e5e7eb",
    borderSignature: dark ? "#94a3b8" : "#374151",
    mutedBg: dark ? "#334155" : "#f3f4f6",
    principalBg: dark ? "#172554" : "#f0f7ff",
    principalBorder: dark ? "#3b82f6" : "#1e3a5f",
    principalHighlight: dark ? "#1e3a5f" : "#dbeafe",
  }
}

const frequencyLabels: Record<string, { en: string; fil: string }> = {
  daily: { en: "daily", fil: "araw-araw" },
  weekly: { en: "weekly", fil: "lingguhan" },
  biweekly: { en: "bi-weekly", fil: "tuwing dalawang linggo" },
  semimonthly: { en: "semi-monthly", fil: "dalawang beses sa isang buwan" },
  monthly: { en: "monthly", fil: "buwanan" },
}

const CLAUSE_DOC_LABELS: Record<ClauseKey, string> = {
  default: "Default.",
  acceleration: "Acceleration Clause.",
  attorneysFees: "Attorney's Fees and Collection Costs.",
  waiver: "Waiver of Demand and Notice.",
  venue: "Venue.",
}

// Clause numbering in the document (3-7)
const CLAUSE_NUMBERS: Record<ClauseKey, number> = {
  default: 3,
  acceleration: 4,
  attorneysFees: 5,
  waiver: 6,
  venue: 7,
}

function PromissoryNotePage() {
  const { loan, unauthorized, lenderName, signatures } = Route.useLoaderData()
  const router = useRouter()
  const documentRef = useRef<HTMLDivElement>(null)
  const [generating, setGenerating] = useState(false)
  const [pdfMode, setPdfMode] = useState(false)
  const [lang, setLang] = useState<Lang>("en")
  const [docStyle, setDocStyle] = useState<"full" | "simple">("full")
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showSignPad, setShowSignPad] = useState(false)
  const [signingLoading, setSigningLoading] = useState(false)

  const sigs = signatures ?? []
  const lenderSig = sigs.find((s) => s.signerRole === "lender")
  const borrowerSig = sigs.find((s) => s.signerRole === "borrower")
  const coMakerSig = sigs.find((s) => s.signerRole === "co_maker")
  const [editingClauses, setEditingClauses] = useState<Record<ClauseKey, ClauseText>>(() => {
    const initial: Record<string, ClauseText> = {}
    for (const key of CLAUSE_KEYS) {
      initial[key] = { ...DEFAULT_CLAUSES[key] }
    }
    return initial as Record<ClauseKey, ClauseText>
  })
  const [expandedClause, setExpandedClause] = useState<ClauseKey | null>(null)
  const [editorLang, setEditorLang] = useState<Lang>("en")
  const c = useDocColors(pdfMode)

  const parsedCustomClauses = useMemo(
    () => parseCustomClauses(loan?.customClauses ?? null),
    [loan?.customClauses]
  )

  if (unauthorized) {
    return (
      <AccessDenied
        message="Only lenders can access promissory notes."
        homeLink="/dashboard"
        homeLinkLabel="Go to Dashboard"
      />
    )
  }

  if (!loan) {
    return (
      <AccessDenied
        title="Loan Not Found"
        message="This loan doesn't exist or you don't have access to it."
        homeLink="/loans"
        homeLinkLabel="Back to Loans"
      />
    )
  }

  const principal = parseFloat(loan.principal)
  const interestPerAnnum = parseFloat(loan.interestRate) * 12
  const freqLabel =
    frequencyLabels[loan.paymentFrequency]?.[lang] || loan.paymentFrequency

  const handleGeneratePDF = async () => {
    if (!documentRef.current) return

    setGenerating(true)
    setPdfMode(true)
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r))
    )

    try {
      const html2pdf = (await import("html2pdf.js")).default

      const element = documentRef.current
      const filename = `promissory-note-${loan.contact.name.replace(/\s+/g, "-").toLowerCase()}-${format(new Date(), "yyyy-MM-dd")}.pdf`

      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
        },
        jsPDF: {
          unit: "mm" as const,
          format: "a4" as const,
          orientation: "portrait" as const,
        },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] as const },
      }

      await html2pdf().set(opt).from(element).save()
    } catch (error) {
      console.error("Failed to generate PDF:", error)
    } finally {
      setPdfMode(false)
      setGenerating(false)
    }
  }

  const handleEnterEditMode = () => {
    const resolved: Record<string, ClauseText> = {}
    for (const key of CLAUSE_KEYS) {
      const r = resolveClause(key, parsedCustomClauses)
      resolved[key] = { en: r.en, fil: r.fil }
    }
    setEditingClauses(resolved as Record<ClauseKey, ClauseText>)
    setExpandedClause("default")
    setEditorLang(lang)
    setEditMode(true)
  }

  const handleCancelEdit = () => {
    setEditMode(false)
    setExpandedClause(null)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const customClauses: CustomClauses = {}
      for (const key of CLAUSE_KEYS) {
        customClauses[key] = editingClauses[key]
      }

      await updateLoanClauses({
        data: {
          loanId: loan.id,
          customClauses: customClauses as Record<string, { en: string; fil: string }>,
        },
      })

      setEditMode(false)
      setExpandedClause(null)
      router.invalidate()
    } catch (error) {
      console.error("Failed to save clauses:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleResetClause = (key: ClauseKey) => {
    setEditingClauses((prev) => ({
      ...prev,
      [key]: { ...DEFAULT_CLAUSES[key] },
    }))
  }

  const handleSaveLenderSignature = async (dataUrl: string) => {
    setSigningLoading(true)
    try {
      await saveLenderSignature({
        data: {
          loanId: loan.id,
          documentType: "promissory_note",
          signatureData: dataUrl,
        },
      })
      toast.success("Signature saved")
      setShowSignPad(false)
      router.invalidate()
    } catch {
      toast.error("Failed to save signature")
    } finally {
      setSigningLoading(false)
    }
  }

  const handleGenerateLink = async () => {
    setSigningLoading(true)
    try {
      const result = await generateSigningLink({
        data: {
          loanId: loan.id,
          documentType: "promissory_note",
          signerRole: "borrower",
          docStyle,
        },
      })
      const url = `${window.location.origin}/share/sign/${result.token}`
      await navigator.clipboard.writeText(url)
      toast.success("Signing link copied to clipboard")
    } catch {
      toast.error("Failed to generate signing link")
    } finally {
      setSigningLoading(false)
    }
  }

  const handleDeleteSignature = async (signatureId: string) => {
    try {
      await deleteSignature({ data: { signatureId } })
      toast.success("Signature removed")
      router.invalidate()
    } catch {
      toast.error("Failed to remove signature")
    }
  }

  const handleClauseTextChange = (key: ClauseKey, langKey: Lang, value: string) => {
    setEditingClauses((prev) => ({
      ...prev,
      [key]: { ...prev[key], [langKey]: value },
    }))
  }

  const hasUnsavedChanges = useMemo(() => {
    for (const key of CLAUSE_KEYS) {
      const saved = resolveClause(key, parsedCustomClauses)
      const edited = editingClauses[key]
      if (edited.en.trim() !== saved.en.trim() || edited.fil.trim() !== saved.fil.trim()) {
        return true
      }
    }
    return false
  }, [editingClauses, parsedCustomClauses])

  const isClauseEdited = (key: ClauseKey) => {
    const edited = editingClauses[key]
    const def = DEFAULT_CLAUSES[key]
    return edited.en.trim() !== def.en.trim() || edited.fil.trim() !== def.fil.trim()
  }

  const firstDueDate =
    loan.schedule.length > 0
      ? format(new Date(loan.schedule[0].dueDate), "MMMM d, yyyy")
      : "—"
  const maturityDate = loan.maturityDate
    ? format(new Date(loan.maturityDate), "MMMM d, yyyy")
    : "—"
  const lenderDisplay = lenderName || (lang === "en" ? "the Lender" : "ang Lender")

  const SIMPLE_CLAUSE_KEYS: ClauseKey[] = ["default"]
  const activeClauses = docStyle === "simple" ? SIMPLE_CLAUSE_KEYS : CLAUSE_KEYS

  const getClauseText = (key: ClauseKey): string => {
    if (editMode) {
      return editingClauses[key][lang]
    }
    return resolveClause(key, parsedCustomClauses)[lang]
  }

  // ─── Document Preview ────────────────────────────────────────────────
  const documentPreview = (
    <div
      ref={documentRef}
      className="shadow-lg rounded-lg overflow-hidden"
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        backgroundColor: c.bg,
        color: c.text,
      }}
    >
      <div className="p-8">
        {/* Header */}
        <div
          className="text-center pb-6 mb-6"
          style={{ borderBottom: `2px solid ${c.border}` }}
        >
          <h1
            className="font-bold uppercase tracking-wide"
            style={{
              fontSize: "22px",
              marginBottom: "4px",
              color: c.textStrong,
            }}
          >
            Promissory Note
          </h1>
          {lang === "fil" && (
            <p style={{ fontSize: "13px", color: c.muted }}>
              (Kasulatan ng Pagbabayad-Utang)
            </p>
          )}
        </div>

        {/* Reference Row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "13px",
            marginBottom: "24px",
          }}
        >
          <div>
            <span style={{ color: c.muted }}>
              {lang === "en" ? "Date: " : "Petsa: "}
            </span>
            <span style={{ fontWeight: 500 }}>
              {loan.startDate
                ? format(new Date(loan.startDate), "MMMM d, yyyy")
                : format(new Date(), "MMMM d, yyyy")}
            </span>
          </div>
          <div>
            <span style={{ color: c.muted }}>
              {lang === "en" ? "Place: " : "Lugar: "}
            </span>
            <span style={{ fontWeight: 500 }}>
              {lang === "en" ? "Philippines" : "Pilipinas"}
            </span>
          </div>
          <div>
            <span style={{ color: c.muted }}>
              {lang === "en" ? "PN Ref: " : "Sanggunian: "}
            </span>
            <span style={{ fontWeight: 500 }}>
              {loan.id.slice(0, 8).toUpperCase()}
            </span>
          </div>
        </div>

        {/* Principal Amount Box */}
        <div
          style={{
            border: `2px solid ${c.principalBorder}`,
            borderRadius: "8px",
            padding: "16px 20px",
            marginBottom: "24px",
            backgroundColor: c.principalBg,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
            }}
          >
            <span
              style={{
                fontSize: "13px",
                color: c.muted,
                fontWeight: 500,
              }}
            >
              {lang === "en" ? "Principal Amount" : "Halaga ng Pautang"}
            </span>
            <span style={{ fontSize: "20px", fontWeight: 700 }}>
              {formatCurrency(principal)}
            </span>
          </div>
          <div
            style={{
              backgroundColor: c.principalHighlight,
              borderRadius: "4px",
              padding: "8px 12px",
              textAlign: "center",
              fontSize: "14px",
              fontWeight: 600,
              letterSpacing: "0.5px",
            }}
          >
            {numberToWords(principal)} PESOS ONLY
          </div>
        </div>

        {/* Promise to Pay Clause */}
        <div style={{ marginBottom: "24px" }}>
          <p
            style={{
              fontSize: "13px",
              lineHeight: "1.8",
              color: c.text,
              textAlign: "justify",
            }}
          >
            {lang === "en" ? (
              <>
                I/We,{" "}
                <span style={{ fontWeight: 600 }}>
                  {loan.contact.name}
                </span>
                , (hereinafter referred to as the "Borrower/Maker"), for
                value received, hereby promise to pay{" "}
                <span style={{ fontWeight: 600 }}>{lenderDisplay}</span>{" "}
                (hereinafter referred to as the "Lender/Payee"), the sum of{" "}
                <span style={{ fontWeight: 600 }}>
                  {formatCurrency(principal)} ({numberToWords(principal)}{" "}
                  PESOS)
                </span>
                , Philippine Currency, under the following terms and
                conditions:
              </>
            ) : (
              <>
                Ako/Kami,{" "}
                <span style={{ fontWeight: 600 }}>
                  {loan.contact.name}
                </span>
                , (tinatawag dito na "Borrower/Maker"), sa halagang
                natanggap, ay nangangakong magbabayad kay{" "}
                <span style={{ fontWeight: 600 }}>{lenderDisplay}</span>{" "}
                (tinatawag dito na "Lender/Payee"), ng halagang{" "}
                <span style={{ fontWeight: 600 }}>
                  {formatCurrency(principal)} ({numberToWords(principal)}{" "}
                  PESOS)
                </span>
                , salaping Pilipino, sa ilalim ng mga sumusunod na tuntunin
                at kundisyon:
              </>
            )}
          </p>
        </div>

        {/* Terms and Conditions */}
        <div style={{ marginBottom: "24px" }}>
          <h2
            className="font-semibold mb-4"
            style={{ fontSize: "16px", color: c.textStrong }}
          >
            Terms and Conditions
          </h2>
          <div
            style={{
              fontSize: "13px",
              lineHeight: "1.8",
              color: c.text,
            }}
          >
            <ol
              style={{
                paddingLeft: "20px",
                margin: 0,
                listStyleType: "decimal",
              }}
            >
              {/* 1. Interest Rate (read-only) */}
              <li style={{ marginBottom: "12px", textAlign: "justify" }}>
                <span style={{ fontWeight: 600 }}>Interest Rate.</span>{" "}
                {lang === "en" ? (
                  <>
                    This note shall bear interest at the rate of{" "}
                    <span style={{ fontWeight: 600 }}>
                      {loan.interestRate}% per month
                    </span>{" "}
                    ({interestPerAnnum}% per annum), computed on the
                    outstanding principal balance.
                  </>
                ) : (
                  <>
                    Ang kasulatan ito ay magkakaroon ng tubo na{" "}
                    <span style={{ fontWeight: 600 }}>
                      {loan.interestRate}% bawat buwan
                    </span>{" "}
                    ({interestPerAnnum}% bawat taon), na kukuwentahin batay
                    sa natitirang halaga ng pautang.
                  </>
                )}
              </li>

              {/* 2. Payment Terms (read-only) */}
              <li style={{ marginBottom: "12px", textAlign: "justify" }}>
                <span style={{ fontWeight: 600 }}>Payment Terms.</span>{" "}
                {lang === "en" ? (
                  <>
                    The total amount due of{" "}
                    <span style={{ fontWeight: 600 }}>
                      {formatCurrency(loan.totalToRepay)}
                    </span>{" "}
                    (principal plus interest) shall be paid in{" "}
                    <span style={{ fontWeight: 600 }}>
                      {loan.schedule.length} {freqLabel} installments
                    </span>{" "}
                    of{" "}
                    <span style={{ fontWeight: 600 }}>
                      {formatCurrency(loan.paymentAmount)} each
                    </span>
                    , commencing on{" "}
                    <span style={{ fontWeight: 600 }}>{firstDueDate}</span>{" "}
                    and every {freqLabel} period thereafter until fully
                    paid, with the final payment due on{" "}
                    <span style={{ fontWeight: 600 }}>{maturityDate}</span>.
                  </>
                ) : (
                  <>
                    Ang kabuuang halagang dapat bayaran na{" "}
                    <span style={{ fontWeight: 600 }}>
                      {formatCurrency(loan.totalToRepay)}
                    </span>{" "}
                    (puhunan at tubo) ay babayaran sa{" "}
                    <span style={{ fontWeight: 600 }}>
                      {loan.schedule.length} {freqLabel} na hulog
                    </span>{" "}
                    na tig-
                    <span style={{ fontWeight: 600 }}>
                      {formatCurrency(loan.paymentAmount)}
                    </span>{" "}
                    bawat isa, simula sa{" "}
                    <span style={{ fontWeight: 600 }}>{firstDueDate}</span>{" "}
                    at sa bawat {freqLabel} na panahon matapos nito
                    hanggang sa mabayarang lahat, na ang huling bayad ay sa{" "}
                    <span style={{ fontWeight: 600 }}>{maturityDate}</span>.
                  </>
                )}
              </li>

              {/* 3-7: Editable clauses (rendered from resolved text) */}
              {activeClauses.map((key) => (
                <li
                  key={key}
                  style={{
                    marginBottom: "12px",
                    textAlign: "justify",
                    transition: "background-color 0.2s",
                    ...(editMode && expandedClause === key
                      ? {
                          backgroundColor: "rgba(59, 130, 246, 0.06)",
                          borderRadius: "4px",
                          margin: "0 -8px 12px -8px",
                          padding: "4px 8px",
                        }
                      : {}),
                  }}
                >
                  <span style={{ fontWeight: 600 }}>
                    {CLAUSE_DOC_LABELS[key]}
                  </span>{" "}
                  {getClauseText(key)}
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Collateral Section */}
        {docStyle === "full" && loan.collateralDescription && (
          <div style={{ marginBottom: "24px" }}>
            <h2
              className="font-semibold mb-3"
              style={{ fontSize: "16px", color: c.textStrong }}
            >
              Collateral / Security
            </h2>
            <p
              style={{
                fontSize: "13px",
                lineHeight: "1.8",
                color: c.text,
                textAlign: "justify",
              }}
            >
              {lang === "en" ? (
                <>
                  As security for the faithful compliance of the obligations
                  under this Promissory Note, the Borrower hereby offers the
                  following collateral:
                </>
              ) : (
                <>
                  Bilang seguridad para sa matapat na pagsunod sa mga
                  obligasyon sa ilalim ng Promissory Note na ito, ang
                  Borrower ay nag-aalok ng sumusunod na collateral:
                </>
              )}
            </p>
            <div
              style={{
                padding: "12px 16px",
                backgroundColor: c.mutedBg,
                borderRadius: "6px",
                fontSize: "13px",
                marginTop: "8px",
                fontWeight: 500,
              }}
            >
              {loan.collateralDescription}
            </div>
          </div>
        )}

        {/* Co-maker Undertaking */}
        {docStyle === "full" && loan.coMakerName && (
          <div style={{ marginBottom: "24px" }}>
            <h2
              className="font-semibold mb-3"
              style={{ fontSize: "16px", color: c.textStrong }}
            >
              Co-maker's Undertaking
            </h2>
            <p
              style={{
                fontSize: "13px",
                lineHeight: "1.8",
                color: c.text,
                textAlign: "justify",
              }}
            >
              {lang === "en" ? (
                <>
                  I,{" "}
                  <span style={{ fontWeight: 600 }}>
                    {loan.coMakerName}
                  </span>
                  {loan.coMakerRelationship && (
                    <> ({loan.coMakerRelationship} of the Borrower)</>
                  )}
                  , hereby bind myself jointly and severally with the
                  Borrower for the full and faithful payment of the
                  obligations stated in this Promissory Note. I understand
                  that in the event of default by the Borrower, I shall be
                  equally liable for the payment of the entire outstanding
                  balance, including interest, penalties, attorney's fees,
                  and collection costs.
                </>
              ) : (
                <>
                  Ako,{" "}
                  <span style={{ fontWeight: 600 }}>
                    {loan.coMakerName}
                  </span>
                  {loan.coMakerRelationship && (
                    <> ({loan.coMakerRelationship} ng Borrower)</>
                  )}
                  , ay kusang-loob na nagbubuklod ng aking sarili nang
                  magkasanib at magkahiwalay kasama ng Borrower para sa buo
                  at matapat na pagbabayad ng mga obligasyong nakasaad sa
                  Promissory Note na ito. Nauunawaan ko na sa pagkabigo ng
                  Borrower, ako ay pantay na mananagot sa pagbabayad ng
                  buong natitirang balanse, kabilang ang tubo, multa,
                  attorney's fees, at gastos sa pagsingil.
                </>
              )}
            </p>
          </div>
        )}

        {/* Signature Blocks */}
        <div
          style={{
            borderTop: `2px solid ${c.border}`,
            paddingTop: "24px",
            marginTop: "32px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: loan.coMakerName && docStyle === "full" ? "1fr 1fr" : "1fr",
              gap: "32px",
              marginBottom: "40px",
            }}
          >
            <SignatureBlock
              name={loan.contact.name}
              label="Borrower / Maker"
              signatureData={borrowerSig?.signatureData}
              signedAt={borrowerSig?.signedAt}
              borderColor={c.borderSignature}
              mutedColor={c.muted}
              lang={lang}
            />

            {docStyle === "full" && loan.coMakerName && (
              <SignatureBlock
                name={loan.coMakerName}
                label="Co-maker / Guarantor"
                signatureData={coMakerSig?.signatureData}
                signedAt={coMakerSig?.signedAt}
                borderColor={c.borderSignature}
                mutedColor={c.muted}
                lang={lang}
              />
            )}
          </div>

          <div style={{ marginBottom: "40px" }}>
            <p
              style={{
                fontSize: "11px",
                color: c.muted,
                fontWeight: 600,
                textTransform: "uppercase",
                marginBottom: "16px",
              }}
            >
              Conforme:
            </p>
            <div style={{ maxWidth: "300px" }}>
              <SignatureBlock
                name={lenderName || "—"}
                label="Lender / Payee"
                signatureData={lenderSig?.signatureData}
                signedAt={lenderSig?.signedAt}
                borderColor={c.borderSignature}
                mutedColor={c.muted}
                lang={lang}
              />
            </div>
          </div>

          {/* Facilitating Agent */}
          {docStyle === "full" && loan.assignedAgent && (
            <div style={{ marginBottom: "40px" }}>
              <p
                style={{
                  fontSize: "11px",
                  color: c.muted,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  marginBottom: "16px",
                }}
              >
                {lang === "en"
                  ? "Facilitating Agent:"
                  : "Facilitating Agent:"}
              </p>
              <div style={{ maxWidth: "300px" }}>
                <div
                  style={{
                    borderBottom: `1px solid ${c.borderSignature}`,
                    height: "40px",
                    marginBottom: "8px",
                  }}
                ></div>
                <p style={{ fontSize: "13px", fontWeight: 500 }}>
                  {loan.assignedAgent.name}
                </p>
                <p style={{ fontSize: "11px", color: c.muted }}>
                  {lang === "en"
                    ? "Agent / Loan Facilitator"
                    : "Ahente / Tagapagpadali ng Pautang"}
                </p>
                <div style={{ marginTop: "16px" }}>
                  <div
                    style={{
                      borderBottom: `1px solid ${c.borderSignature}`,
                      width: "150px",
                      marginBottom: "8px",
                    }}
                  ></div>
                  <p style={{ fontSize: "11px", color: c.muted }}>
                    {lang === "en" ? "Date" : "Petsa"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {docStyle === "full" && (
          <div>
            <p
              style={{
                fontSize: "11px",
                color: c.muted,
                fontWeight: 600,
                textTransform: "uppercase",
                marginBottom: "16px",
              }}
            >
              {lang === "en"
                ? "Signed in the presence of:"
                : "Nilagdaan sa harap ng:"}
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "32px",
              }}
            >
              <div>
                <div
                  style={{
                    borderBottom: `1px solid ${c.borderSignature}`,
                    height: "40px",
                    marginBottom: "8px",
                  }}
                ></div>
                <p style={{ fontSize: "11px", color: c.muted }}>
                  {lang === "en" ? "Witness 1" : "Saksi 1"}
                </p>
              </div>
              <div>
                <div
                  style={{
                    borderBottom: `1px solid ${c.borderSignature}`,
                    height: "40px",
                    marginBottom: "8px",
                  }}
                ></div>
                <p style={{ fontSize: "11px", color: c.muted }}>
                  {lang === "en" ? "Witness 2" : "Saksi 2"}
                </p>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: `1px solid ${c.border}`,
            marginTop: "48px",
            paddingTop: "16px",
            textAlign: "center",
            fontSize: "11px",
            color: c.muted,
          }}
        >
          <p>
            {lang === "en"
              ? `Document generated on ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}`
              : `Dokumentong nabuo noong ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}`}
          </p>
        </div>
      </div>
    </div>
  )

  // ─── Sidebar Panel ──────────────────────────────────────────────────
  const sidebarPanel = (
    <div className="flex flex-col h-full bg-background border-l">
      {/* Sidebar Header */}
      <div className="p-4 border-b">
        {editMode ? (
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">Edit Clauses</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Clauses 3-7 &middot; Changes update the preview live
              </p>
            </div>
            <button
              onClick={handleCancelEdit}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div>
            <h3 className="font-semibold text-sm">Document Options</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Language, export &amp; editing
            </p>
          </div>
        )}
      </div>

      {/* Actions Section */}
      <div className="px-4 pt-3 pb-3 space-y-3 border-b">
        {/* Document Style Toggle */}
        {!editMode && (
        <div>
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
            Document Style
          </label>
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            <button
              onClick={() => setDocStyle("simple")}
              className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                docStyle === "simple"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Simple
            </button>
            <button
              onClick={() => setDocStyle("full")}
              className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                docStyle === "full"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Full
            </button>
          </div>
        </div>
        )}

        {/* Document Language Toggle */}
        <div>
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
            {editMode ? "Editor Language" : "Document Language"}
          </label>
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            <button
              onClick={() => {
                setLang("en")
                if (editMode) setEditorLang("en")
              }}
              className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                lang === "en"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              English
            </button>
            <button
              onClick={() => {
                setLang("fil")
                if (editMode) setEditorLang("fil")
              }}
              className={`flex-1 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                lang === "fil"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Filipino
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          {loan.isLender && !editMode && docStyle === "full" && (
            <Button
              onClick={handleEnterEditMode}
              variant="outline"
              className="gap-2 w-full justify-center"
              size="sm"
            >
              <PencilSimple className="h-3.5 w-3.5" />
              Edit Clauses
            </Button>
          )}
          <Button
            onClick={handleGeneratePDF}
            disabled={generating || editMode}
            className="gap-2 w-full justify-center"
            size="sm"
          >
            {generating ? (
              <>
                <Spinner className="h-3.5 w-3.5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FilePdf className="h-3.5 w-3.5" weight="bold" />
                Download PDF
              </>
            )}
          </Button>
        </div>
      </div>

      {/* E-Signing Section */}
      {!editMode && (
        <div className="px-4 pt-3 pb-4 border-t space-y-3">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2 block">
              E-Signatures
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Lender</span>
                {lenderSig?.signatureData ? (
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px] h-5 text-green-600 border-green-200">
                      <Check className="h-3 w-3 mr-0.5" />
                      Signed
                    </Badge>
                    <button
                      onClick={() => handleDeleteSignature(lenderSig.id)}
                      className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                      title="Remove signature"
                    >
                      <Trash size={12} />
                    </button>
                  </div>
                ) : (
                  <Badge variant="outline" className="text-[10px] h-5 text-muted-foreground">
                    Unsigned
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {loan.coMakerName ? "Borrower & Co-maker" : "Borrower"}
                </span>
                {borrowerSig?.signatureData ? (
                  <Badge variant="outline" className="text-[10px] h-5 text-green-600 border-green-200">
                    <Check className="h-3 w-3 mr-0.5" />
                    Signed
                  </Badge>
                ) : borrowerSig?.signingToken && !borrowerSig?.tokenUsedAt ? (
                  <Badge variant="outline" className="text-[10px] h-5 text-amber-600 border-amber-200">
                    Pending
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] h-5 text-muted-foreground">
                    Unsigned
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {!lenderSig?.signatureData && !showSignPad && (
            <Button
              onClick={() => setShowSignPad(true)}
              variant="outline"
              className="gap-2 w-full justify-center"
              size="sm"
            >
              <PenNib className="h-3.5 w-3.5" />
              Sign as Lender
            </Button>
          )}

          {showSignPad && (
            <div className="space-y-2">
              <SignaturePad
                onSave={handleSaveLenderSignature}
                disabled={signingLoading}
                height={120}
                label="Your Signature"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSignPad(false)}
                className="w-full text-xs"
              >
                Cancel
              </Button>
            </div>
          )}

          {lenderSig?.signatureData && (
            <Button
              onClick={handleGenerateLink}
              disabled={signingLoading}
              variant="outline"
              className="gap-2 w-full justify-center"
              size="sm"
            >
              {signingLoading ? (
                <Spinner className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <LinkSimple className="h-3.5 w-3.5" />
              )}
              Send to Borrower for Signing
            </Button>
          )}
        </div>
      )}

      {/* Clause Editor (edit mode only) */}
      {editMode && (
        <>
          {/* Clause Accordion */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="space-y-2 pt-3">
              {CLAUSE_KEYS.map((key) => {
                const isExpanded = expandedClause === key
                const isCustomized = isClauseEdited(key)

                return (
                  <div
                    key={key}
                    className={`rounded-lg border transition-colors ${
                      isExpanded ? "border-blue-500/30 bg-blue-500/5" : "border-border"
                    }`}
                  >
                    {/* Clause Header */}
                    <button
                      onClick={() => setExpandedClause(isExpanded ? null : key)}
                      className="w-full flex items-center gap-2 p-3 text-left hover:bg-muted/50 transition-colors rounded-lg"
                    >
                      <CaretDown
                        size={14}
                        className={`text-muted-foreground shrink-0 transition-transform ${
                          isExpanded ? "" : "-rotate-90"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">
                            {CLAUSE_NUMBERS[key]}.
                          </span>
                          <span className="text-xs font-medium truncate">
                            {CLAUSE_LABELS[key]}
                          </span>
                        </div>
                      </div>
                      {isCustomized ? (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5 shrink-0">
                          Edited
                        </Badge>
                      ) : (
                        <Check size={14} className="text-muted-foreground/40 shrink-0" />
                      )}
                    </button>

                    {/* Clause Editor (expanded) */}
                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-2">
                        <Textarea
                          value={editingClauses[key][editorLang]}
                          onChange={(e) => handleClauseTextChange(key, editorLang, e.target.value)}
                          className="text-xs leading-relaxed min-h-[120px] rounded-md"
                        />
                        {isCustomized && (
                          <button
                            onClick={() => handleResetClause(key)}
                            className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <ArrowCounterClockwise size={12} />
                            Reset to default
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Panel Footer — Save/Cancel */}
          <div className="border-t p-4 flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleCancelEdit}
              disabled={saving}
              className="flex-1"
              size="sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !hasUnsavedChanges}
              className="flex-1"
              size="sm"
            >
              {saving ? (
                <>
                  <Spinner className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  )

  // ─── Page Layout ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header — back link only */}
      <div className="bg-[hsl(215_45%_14%)] text-white py-4 sticky top-0 z-10">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <Link
            to="/loans/$loanId"
            params={{ loanId: loan.id }}
            className="inline-flex items-center gap-2 text-sm text-blue-200/70 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Loan Details
          </Link>
        </div>
      </div>

      {/* Content Area — always sidebar + document */}
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-8">
        <div className={`grid grid-cols-1 gap-6 items-start ${editMode ? "lg:grid-cols-[1fr_380px]" : "lg:grid-cols-[1fr_280px]"}`}>
          {/* Document Preview — second on mobile, first on desktop */}
          <div className="min-w-0 order-2 lg:order-1">
            {documentPreview}
          </div>

          {/* Sidebar Panel — first on mobile, sticky side panel on desktop */}
          <div className="order-1 lg:order-2 lg:sticky lg:top-[72px] lg:max-h-[calc(100vh-104px)] rounded-lg border bg-background shadow-lg overflow-hidden flex flex-col">
            {sidebarPanel}
          </div>
        </div>
      </div>
    </div>
  )
}

function numberToWords(amount: number): string {
  const ones = [
    "",
    "ONE",
    "TWO",
    "THREE",
    "FOUR",
    "FIVE",
    "SIX",
    "SEVEN",
    "EIGHT",
    "NINE",
    "TEN",
    "ELEVEN",
    "TWELVE",
    "THIRTEEN",
    "FOURTEEN",
    "FIFTEEN",
    "SIXTEEN",
    "SEVENTEEN",
    "EIGHTEEN",
    "NINETEEN",
  ]
  const tens = [
    "",
    "",
    "TWENTY",
    "THIRTY",
    "FORTY",
    "FIFTY",
    "SIXTY",
    "SEVENTY",
    "EIGHTY",
    "NINETY",
  ]

  if (amount === 0) return "ZERO"

  const num = Math.floor(amount)

  function convertChunk(n: number): string {
    if (n === 0) return ""
    if (n < 20) return ones[n]
    if (n < 100) {
      const remainder = n % 10
      return (
        tens[Math.floor(n / 10)] + (remainder ? "-" + ones[remainder] : "")
      )
    }
    if (n < 1000) {
      const remainder = n % 100
      return (
        ones[Math.floor(n / 100)] +
        " HUNDRED" +
        (remainder ? " " + convertChunk(remainder) : "")
      )
    }
    return ""
  }

  const parts: string[] = []

  if (num >= 1_000_000_000) {
    parts.push(convertChunk(Math.floor(num / 1_000_000_000)) + " BILLION")
  }
  const millions = Math.floor((num % 1_000_000_000) / 1_000_000)
  if (millions) {
    parts.push(convertChunk(millions) + " MILLION")
  }
  const thousands = Math.floor((num % 1_000_000) / 1_000)
  if (thousands) {
    parts.push(convertChunk(thousands) + " THOUSAND")
  }
  const remainder = num % 1_000
  if (remainder) {
    parts.push(convertChunk(remainder))
  }

  return parts.join(" ")
}

function formatCurrency(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}
