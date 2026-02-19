/**
 * Renders a signature line with an optional embedded signature image.
 * Used in both dashboard document pages and public signing page.
 */
interface SignatureBlockProps {
  name: string
  label: string
  signatureData?: string | null
  signedAt?: string | null
  borderColor: string
  mutedColor: string
  showDate?: boolean
  lang?: "en" | "fil"
}

export function SignatureBlock({
  name,
  label,
  signatureData,
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
          height: "40px",
          marginBottom: "8px",
          position: "relative",
        }}
      >
        {signatureData && (
          <img
            src={signatureData}
            alt={`${name}'s signature`}
            style={{
              position: "absolute",
              bottom: "0",
              left: "0",
              height: "38px",
              width: "auto",
              maxWidth: "100%",
              objectFit: "contain",
            }}
          />
        )}
      </div>
      <p style={{ fontSize: "13px", fontWeight: 500 }}>{name}</p>
      <p style={{ fontSize: "11px", color: mutedColor }}>{label}</p>
      {showDate && (
        <div style={{ marginTop: "16px" }}>
          {signedAt ? (
            <p style={{ fontSize: "11px", color: mutedColor }}>
              Signed: {new Date(signedAt).toLocaleDateString("en-PH", {
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
