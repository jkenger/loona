import { createFileRoute, Link } from "@tanstack/react-router"
import { useRef, useState, useEffect } from "react"
import { getLoan } from "@/server/loans"
import { Button } from "@/components/ui/button"
import { SkeletonDetailPage } from "@/components/ui/skeleton"
import { AccessDenied } from "@/components/access-denied"
import { hasRole, ROLES } from "@/lib/constants/roles"
import { ArrowLeft, FilePdf, Spinner } from "@phosphor-icons/react"
import { format } from "date-fns"

type Lang = "en" | "fil"

export const Route = createFileRoute(
  "/_dashboard/loans/$loanId/promissory-note"
)({
  loader: async ({ params, context }) => {
    const { session } = context as {
      session: { user: { role: string | null; name: string | null } }
    }
    if (!hasRole(session.user.role, ROLES.LENDER)) {
      return { loan: null, unauthorized: true, lenderName: null }
    }

    try {
      const loan = await getLoan({ data: params.loanId })
      if (!loan.isLender) {
        return { loan: null, unauthorized: true, lenderName: null }
      }
      return { loan, unauthorized: false, lenderName: session.user.name }
    } catch {
      return { loan: null, unauthorized: false, lenderName: null }
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

function PromissoryNotePage() {
  const { loan, unauthorized, lenderName } = Route.useLoaderData()
  const documentRef = useRef<HTMLDivElement>(null)
  const [generating, setGenerating] = useState(false)
  const [pdfMode, setPdfMode] = useState(false)
  const [lang, setLang] = useState<Lang>("en")
  const c = useDocColors(pdfMode)

  if (unauthorized) {
    return (
      <AccessDenied
        message="Only lenders can access promissory notes."
        homeLink="/agent"
        homeLinkLabel="Go to Agent Portal"
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

  const firstDueDate =
    loan.schedule.length > 0
      ? format(new Date(loan.schedule[0].dueDate), "MMMM d, yyyy")
      : "—"
  const maturityDate = loan.maturityDate
    ? format(new Date(loan.maturityDate), "MMMM d, yyyy")
    : "—"
  const lenderDisplay = lenderName || (lang === "en" ? "the Lender" : "ang Lender")

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Controls Header */}
      <div className="bg-[hsl(215_45%_14%)] text-white py-4 sticky top-0 z-10">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link
              to="/loans/$loanId"
              params={{ loanId: loan.id }}
              className="inline-flex items-center gap-2 text-sm text-blue-200/70 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Loan Details
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 rounded-lg bg-white/10 p-1">
                <button
                  onClick={() => setLang("en")}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    lang === "en"
                      ? "bg-white text-slate-900"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  EN
                </button>
                <button
                  onClick={() => setLang("fil")}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    lang === "fil"
                      ? "bg-white text-slate-900"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  FIL
                </button>
              </div>
              <Button
                onClick={handleGeneratePDF}
                disabled={generating}
                className="gap-2"
              >
                {generating ? (
                  <>
                    <Spinner className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FilePdf className="h-4 w-4" weight="bold" />
                    Download PDF
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* PDF Document Preview */}
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
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
                  {/* 1. Interest Rate */}
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

                  {/* 2. Payment Terms */}
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

                  {/* 3. Default */}
                  <li style={{ marginBottom: "12px", textAlign: "justify" }}>
                    <span style={{ fontWeight: 600 }}>Default.</span>{" "}
                    {lang === "en" ? (
                      <>
                        In the event of default in the payment of any
                        installment when due, the entire outstanding balance of
                        this note, together with accrued interest, shall
                        immediately become due and payable without further demand
                        or notice.
                      </>
                    ) : (
                      <>
                        Sa pagkabigong makabayad ng anumang hulog sa takdang
                        araw, ang buong natitirang balanse ng kasulatan ito,
                        kasama ang naipon na tubo, ay agad na magiging dapat
                        bayaran nang walang karagdagang paalala o abiso.
                      </>
                    )}
                  </li>

                  {/* 4. Acceleration */}
                  <li style={{ marginBottom: "12px", textAlign: "justify" }}>
                    <span style={{ fontWeight: 600 }}>
                      Acceleration Clause.
                    </span>{" "}
                    {lang === "en" ? (
                      <>
                        Upon default, the Lender shall have the right to declare
                        the entire unpaid balance immediately due and payable,
                        and may proceed to collect the same through any legal
                        means available.
                      </>
                    ) : (
                      <>
                        Sa pagkabigo, ang Lender ay may karapatang ideklara ang
                        buong hindi pa nababayarang balanse na agad at buong
                        dapat bayaran, at maaaring magsagawa ng pagsingil sa
                        pamamagitan ng anumang legal na paraan.
                      </>
                    )}
                  </li>

                  {/* 5. Collection Costs */}
                  <li style={{ marginBottom: "12px", textAlign: "justify" }}>
                    <span style={{ fontWeight: 600 }}>
                      Attorney's Fees and Collection Costs.
                    </span>{" "}
                    {lang === "en" ? (
                      <>
                        In the event of judicial or extrajudicial collection,
                        the Borrower agrees to pay attorney's fees equivalent to
                        twenty-five percent (25%) of the total amount due, but
                        in no case less than Five Thousand Pesos (₱5,000.00),
                        plus costs of suit and other litigation expenses.
                      </>
                    ) : (
                      <>
                        Sa pagkakataon ng pagsingil sa hukuman o labas ng
                        hukuman, ang Borrower ay sumasang-ayon na magbayad ng
                        attorney's fees na katumbas ng dalawampu't limang
                        porsiyento (25%) ng kabuuang halagang dapat bayaran,
                        ngunit hindi bababa sa Limang Libong Piso (₱5,000.00),
                        dagdag pa ang mga gastos sa paghahabla at iba pang
                        gastusin sa paglilitis.
                      </>
                    )}
                  </li>

                  {/* 6. Waiver */}
                  <li style={{ marginBottom: "12px", textAlign: "justify" }}>
                    <span style={{ fontWeight: 600 }}>
                      Waiver of Demand and Notice.
                    </span>{" "}
                    {lang === "en" ? (
                      <>
                        The Borrower hereby waives demand, presentment for
                        payment, notice of dishonor, protest, and notice of
                        protest of this note.
                      </>
                    ) : (
                      <>
                        Itinatakwil ng Borrower ang kahilingan, paglalahad para
                        sa pagbabayad, paunawa ng kawalan ng dangal, protesta,
                        at paunawa ng protesta ng kasulatan ito.
                      </>
                    )}
                  </li>

                  {/* 7. Venue */}
                  <li style={{ marginBottom: "12px", textAlign: "justify" }}>
                    <span style={{ fontWeight: 600 }}>Venue.</span>{" "}
                    {lang === "en" ? (
                      <>
                        Any legal action arising from or in connection with this
                        Promissory Note shall be filed exclusively in the proper
                        courts of the city or municipality where the Lender
                        resides, to the exclusion of all other venues.
                      </>
                    ) : (
                      <>
                        Ang anumang legal na aksyon na nagmumula sa o may
                        kaugnayan sa Promissory Note na ito ay ihahain nang
                        eksklusibo sa wastong hukuman ng lungsod o munisipalidad
                        kung saan naninirahan ang Lender, na ibinubukod ang
                        lahat ng iba pang venue.
                      </>
                    )}
                  </li>
                </ol>
              </div>
            </div>

            {/* Collateral Section */}
            {loan.collateralDescription && (
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
            {loan.coMakerName && (
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
              {/* Borrower + Co-maker Signatures */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: loan.coMakerName ? "1fr 1fr" : "1fr",
                  gap: "32px",
                  marginBottom: "40px",
                }}
              >
                {/* Borrower */}
                <div>
                  <div
                    style={{
                      borderBottom: `1px solid ${c.borderSignature}`,
                      height: "40px",
                      marginBottom: "8px",
                    }}
                  ></div>
                  <p style={{ fontSize: "13px", fontWeight: 500 }}>
                    {loan.contact.name}
                  </p>
                  <p style={{ fontSize: "11px", color: c.muted }}>
                    Borrower / Maker
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

                {/* Co-maker */}
                {loan.coMakerName && (
                  <div>
                    <div
                      style={{
                        borderBottom: `1px solid ${c.borderSignature}`,
                        height: "40px",
                        marginBottom: "8px",
                      }}
                    ></div>
                    <p style={{ fontSize: "13px", fontWeight: 500 }}>
                      {loan.coMakerName}
                    </p>
                    <p style={{ fontSize: "11px", color: c.muted }}>
                      Co-maker / Guarantor
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
                )}
              </div>

              {/* Lender Conforme */}
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
                  <div
                    style={{
                      borderBottom: `1px solid ${c.borderSignature}`,
                      height: "40px",
                      marginBottom: "8px",
                    }}
                  ></div>
                  <p style={{ fontSize: "13px", fontWeight: 500 }}>
                    {lenderName || "—"}
                  </p>
                  <p style={{ fontSize: "11px", color: c.muted }}>
                    Lender / Payee
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

              {/* Witnesses */}
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
