/**
 * Renders a signature line showing OTP verification status.
 * Used in dashboard document pages.
 */
interface SignatureBlockProps {
  name: string
  label: string
  signedAt?: string | null
  borderColor: string
  mutedColor: string
  showDate?: boolean
  lang?: "en" | "fil"
}

export function SignatureBlock({
  name,
  label,
  signedAt,
  borderColor,
  mutedColor,
  showDate = true,
  lang = "en",
}: SignatureBlockProps) {
  return (
    <div>
      <div
        style={{
          borderBottom: `1px solid ${borderColor}`,
          minHeight: "40px",
          marginBottom: "8px",
          display: "flex",
          alignItems: "flex-end",
          paddingBottom: "4px",
        }}
      >
        {signedAt && (
          <p style={{ fontSize: "11px", color: "#16a34a" }}>
            ✓ {lang === "en" ? "Digitally signed via email" : "Nilagdaan sa pamamagitan ng email"}
          </p>
        )}
      </div>
      <p style={{ fontSize: "13px", fontWeight: 500 }}>{name}</p>
      <p style={{ fontSize: "11px", color: mutedColor }}>{label}</p>
      {showDate && (
        <div style={{ marginTop: "16px" }}>
          {signedAt ? (
            <p style={{ fontSize: "11px", color: mutedColor }}>
              {lang === "en" ? "Signed" : "Nilagdaan"}:{" "}
              {new Date(signedAt).toLocaleDateString("en-PH", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          ) : (
            <>
              <div
                style={{
                  borderBottom: `1px solid ${borderColor}`,
                  width: "150px",
                  marginBottom: "8px",
                }}
              />
              <p style={{ fontSize: "11px", color: mutedColor }}>
                {lang === "en" ? "Date" : "Petsa"}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
