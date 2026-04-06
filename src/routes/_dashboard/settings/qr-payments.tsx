import { createFileRoute } from "@tanstack/react-router"
import { useState, useRef } from "react"
import { toast } from "sonner"
import { getQrCodes, saveQrCode, updateQrCode, deleteQrCode, reorderQrCodes } from "@/server/qr-codes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Stagger, StaggerItem } from "@/components/ui/stagger"
import { cn } from "@/lib/utils"
import {
  QrCode,
  Plus,
  Trash,
  ArrowUp,
  ArrowDown,
  EnvelopeSimple,
  Globe,
  Spinner,
  CheckCircle,
  Eye,
} from "@phosphor-icons/react"
import type { LenderQrCode } from "@/lib/db/schema"

export const Route = createFileRoute("/_dashboard/settings/qr-payments")({
  loader: async () => {
    const codes = await getQrCodes()
    return { codes }
  },
  component: QrPaymentsPage,
})

function QrPaymentsPage() {
  const { codes: initial } = Route.useLoaderData()
  const [codes, setCodes] = useState<LenderQrCode[]>(initial)

  // Add form state
  const [label, setLabel] = useState("")
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [imageData, setImageData] = useState<string | null>(null)
  const [showInEmails, setShowInEmails] = useState(true)
  const [showInProfile, setShowInProfile] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState("")
  const [editShowInEmails, setEditShowInEmails] = useState(true)
  const [editShowInProfile, setEditShowInProfile] = useState(true)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isReordering, setIsReordering] = useState(false)

  // Preview tab
  const [previewTab, setPreviewTab] = useState<"email" | "profile">("email")

  // Compute effective codes for preview (reflects in-progress edits + pending add)
  const effectiveCodes = codes.map((c) =>
    c.id === editingId
      ? { ...c, label: editLabel || c.label, showInEmails: editShowInEmails, showInProfile: editShowInProfile }
      : c
  )
  if (imageData) {
    effectiveCodes.push({
      id: "__pending__",
      lenderId: "",
      label: label.trim() || "New QR Code",
      imageData,
      showInEmails,
      showInProfile,
      sortOrder: effectiveCodes.length,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }
  const emailQrCodes = effectiveCodes.filter((c) => c.showInEmails)
  const profileQrCodes = effectiveCodes.filter((c) => c.showInProfile)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return }
    if (file.size > 500 * 1024) { toast.error("Image must be under 500KB"); return }

    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result as string
      setImageData(result)
      setPreviewUrl(result)
    }
    reader.readAsDataURL(file)
  }

  async function handleAdd() {
    if (!label.trim()) { toast.error("Enter a label"); return }
    if (!imageData) { toast.error("Upload a QR image"); return }
    setIsSaving(true)
    try {
      const created = await saveQrCode({ data: { label: label.trim(), imageData, showInEmails, showInProfile } })
      setCodes((prev) => [...prev, created])
      setLabel("")
      setImageData(null)
      setPreviewUrl(null)
      setShowInEmails(true)
      setShowInProfile(true)
      if (fileRef.current) fileRef.current.value = ""
      toast.success("QR code added")
    } catch {
      toast.error("Failed to add QR code")
    } finally {
      setIsSaving(false)
    }
  }

  function startEdit(code: LenderQrCode) {
    setEditingId(code.id)
    setEditLabel(code.label)
    setEditShowInEmails(code.showInEmails)
    setEditShowInProfile(code.showInProfile)
  }

  async function handleSaveEdit(id: string) {
    setIsSavingEdit(true)
    try {
      await updateQrCode({ data: { id, label: editLabel.trim(), showInEmails: editShowInEmails, showInProfile: editShowInProfile } })
      setCodes((prev) => prev.map((c) => c.id === id ? { ...c, label: editLabel.trim(), showInEmails: editShowInEmails, showInProfile: editShowInProfile } : c))
      setEditingId(null)
      toast.success("Saved")
    } catch {
      toast.error("Failed to save")
    } finally {
      setIsSavingEdit(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    try {
      await deleteQrCode({ data: id })
      setCodes((prev) => prev.filter((c) => c.id !== id))
      toast.success("QR code removed")
    } catch {
      toast.error("Failed to delete")
    } finally {
      setDeletingId(null)
    }
  }

  async function handleMove(index: number, dir: -1 | 1) {
    const newCodes = [...codes]
    const swapIndex = index + dir
    if (swapIndex < 0 || swapIndex >= newCodes.length) return
    ;[newCodes[index], newCodes[swapIndex]] = [newCodes[swapIndex], newCodes[index]]
    setCodes(newCodes)
    setIsReordering(true)
    try {
      await reorderQrCodes({ data: newCodes.map((c) => c.id) })
    } catch {
      toast.error("Failed to reorder")
      setCodes(codes)
    } finally {
      setIsReordering(false)
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-2xl mx-auto">
      <Stagger className="space-y-6">
        {/* Header */}
        <StaggerItem>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <QrCode className="h-5 w-5 text-primary" weight="duotone" />
            </div>
            <div>
              <h1 className="text-xl font-bold">QR Payment Codes</h1>
              <p className="text-sm text-muted-foreground">Add GCash, Maya, or other QR codes for your borrowers.</p>
            </div>
          </div>
        </StaggerItem>

        {/* Existing codes */}
        {codes.length > 0 && (
          <StaggerItem className="space-y-3">
            {codes.map((code, i) => (
              <div key={code.id} className="rounded-xl border bg-card p-4 flex gap-4 items-start">
                <img
                  src={code.imageData}
                  alt={code.label}
                  className="h-20 w-20 object-contain rounded-lg border bg-white shrink-0"
                />
                <div className="flex-1 min-w-0">
                  {editingId === code.id ? (
                    <div className="space-y-3">
                      <Input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        placeholder="Label"
                        className="h-8 text-sm"
                      />
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                          <Switch checked={editShowInEmails} onCheckedChange={setEditShowInEmails} />
                          <EnvelopeSimple className="h-3.5 w-3.5" /> Emails
                        </label>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                          <Switch checked={editShowInProfile} onCheckedChange={setEditShowInProfile} />
                          <Globe className="h-3.5 w-3.5" /> Profile
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-xs" onClick={() => handleSaveEdit(code.id)} disabled={isSavingEdit}>
                          {isSavingEdit ? <Spinner className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="font-semibold text-sm">{code.label}</p>
                      <div className="flex items-center gap-3 mt-1">
                        {code.showInEmails && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <EnvelopeSimple className="h-3 w-3" /> Emails
                          </span>
                        )}
                        {code.showInProfile && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Globe className="h-3 w-3" /> Profile
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-2">
                        <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => startEdit(code)}>Edit</Button>
                        <Button
                          size="sm" variant="ghost" className="h-7 text-xs px-2 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(code.id)}
                          disabled={deletingId === code.id}
                        >
                          {deletingId === code.id ? <Spinner className="h-3 w-3 animate-spin" /> : <Trash className="h-3 w-3" />}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button
                    size="icon" variant="ghost" className="h-7 w-7"
                    disabled={i === 0 || isReordering}
                    onClick={() => handleMove(i, -1)}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon" variant="ghost" className="h-7 w-7"
                    disabled={i === codes.length - 1 || isReordering}
                    onClick={() => handleMove(i, 1)}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </StaggerItem>
        )}

        {/* Add new */}
        <StaggerItem className="rounded-xl border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold">Add QR Code</h3>

          <div className="space-y-1.5">
            <Label className="text-xs">Label</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. GCash, Maya, BDO"
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">QR Image</Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <div
              className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center gap-2 cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {previewUrl ? (
                <img src={previewUrl} alt="preview" className="h-28 w-28 object-contain" />
              ) : (
                <>
                  <QrCode className="h-8 w-8 text-muted-foreground" weight="duotone" />
                  <p className="text-xs text-muted-foreground">Click to upload (PNG/JPG, max 500KB)</p>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Switch checked={showInEmails} onCheckedChange={setShowInEmails} />
              <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <EnvelopeSimple className="h-3.5 w-3.5" /> Show in payment reminder emails
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Switch checked={showInProfile} onCheckedChange={setShowInProfile} />
              <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <Globe className="h-3.5 w-3.5" /> Show on loan profile page
              </span>
            </label>
          </div>

          <Button onClick={handleAdd} disabled={isSaving} className="w-full">
            {isSaving ? <Spinner className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Add QR Code
          </Button>
        </StaggerItem>

      </Stagger>

      {/* Preview — always rendered, outside Stagger */}
      <div className="rounded-xl border bg-card overflow-hidden mt-6">
            {/* Tab bar */}
            <div className="flex items-center gap-1 px-4 pt-4 pb-0">
              <div className="flex items-center gap-1.5 mr-auto">
                <Eye className="h-4 w-4 text-muted-foreground" weight="duotone" />
                <span className="text-sm font-semibold">Preview</span>
              </div>
              <div className="flex rounded-lg bg-muted p-0.5 text-xs font-medium">
                <button
                  onClick={() => setPreviewTab("email")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors",
                    previewTab === "email" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <EnvelopeSimple className="h-3.5 w-3.5" /> Email
                </button>
                <button
                  onClick={() => setPreviewTab("profile")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors",
                    previewTab === "profile" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Globe className="h-3.5 w-3.5" /> Profile
                </button>
              </div>
            </div>

            {/* Email preview */}
            {previewTab === "email" && (
              <div className="p-4">
                <div className="rounded-lg border bg-white text-[#1a1a1a] overflow-hidden shadow-sm text-[13px] leading-relaxed max-w-md mx-auto">
                  {/* Email chrome */}
                  <div className="bg-[#f3f4f6] px-3 py-2 border-b flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                      <div className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                      <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                    </div>
                    <div className="flex-1 bg-white rounded text-[10px] text-[#999] px-2 py-0.5 text-center truncate">
                      Reminder: Payment due in 3 days — A1B2C3D4
                    </div>
                  </div>
                  {/* Email body */}
                  <div className="px-5 py-4 space-y-3">
                    <p className="text-[#1a8cff] font-bold text-lg text-center">Loona</p>
                    <div className="border-l-4 border-[#f59e0b] pl-3">
                      <p className="font-bold text-[#f59e0b] text-sm">Payment Reminder</p>
                      <p className="text-[#555] text-xs">Your payment is due in <strong>3 days</strong>.</p>
                    </div>
                    <p className="text-[#1a1a1a] text-xs">Hi <strong>Juan dela Cruz</strong>,</p>
                    <div className="bg-[#f9fafb] rounded-lg p-3 space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[#555]">Amount Due</span>
                        <span className="font-bold text-sm">₱2,500.00</span>
                      </div>
                      <div className="flex justify-between border-t border-[#e5e7eb] pt-1.5">
                        <span className="text-[#555]">Due Date</span>
                        <span className="font-medium text-[#f59e0b]">April 9, 2026</span>
                      </div>
                      <div className="flex justify-between border-t border-[#e5e7eb] pt-1.5">
                        <span className="text-[#555]">Loan Reference</span>
                        <span className="font-medium">A1B2C3D4</span>
                      </div>
                    </div>
                    {emailQrCodes.length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold text-[#1a1a1a] mb-2">Pay via QR Code</p>
                        <div className="flex flex-wrap gap-3">
                          {emailQrCodes.map((qr) => (
                            <div key={qr.id} className="text-center">
                              <img src={qr.imageData} alt={qr.label} className="h-20 w-20 object-contain border rounded bg-white" />
                              <p className="text-[11px] font-semibold mt-1">{qr.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-[#999] italic text-center py-2">
                        {codes.length === 0 ? "Add a QR code above to preview it here." : "No QR codes set to show in emails."}
                      </p>
                    )}
                    <p className="text-[10px] text-[#999] text-center border-t border-[#eee] pt-3">
                      This reminder was sent via Loona on behalf of your lender.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Profile preview */}
            {previewTab === "profile" && (
              <div className="p-4">
                <div className="rounded-lg border bg-white overflow-hidden shadow-sm max-w-md mx-auto">
                  {/* Fake portal header */}
                  <div className="bg-gradient-to-r from-primary to-primary/80 px-4 py-3 text-center">
                    <p className="text-white font-bold text-sm">Loona</p>
                    <p className="text-white/70 text-[10px]">Your loan with John Gervacio</p>
                  </div>
                  <div className="p-4 space-y-3">
                    {/* Fake next payment */}
                    <div className="rounded-xl bg-primary/5 border border-primary/20 p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Next Payment</p>
                      <p className="text-lg font-bold mt-0.5">₱2,500.00</p>
                      <p className="text-xs text-muted-foreground mt-0.5">April 9, 2026</p>
                    </div>
                    {/* QR section */}
                    {profileQrCodes.length > 0 ? (
                      <div className="rounded-xl border p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <QrCode className="h-4 w-4 text-muted-foreground" weight="duotone" />
                          <p className="text-sm font-semibold">Pay via QR Code</p>
                        </div>
                        <div className="flex flex-wrap gap-4">
                          {profileQrCodes.map((qr) => (
                            <div key={qr.id} className="flex flex-col items-center gap-1.5">
                              <img src={qr.imageData} alt={qr.label} className="h-24 w-24 object-contain border rounded-lg bg-white" />
                              <p className="text-xs font-semibold">{qr.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed p-4 text-center">
                        <p className="text-xs text-muted-foreground italic">
                          {codes.length === 0 ? "Add a QR code above to preview it here." : "No QR codes set to show on profile."}
                        </p>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground text-center">Powered by Loona · This page is private to you.</p>
                  </div>
                </div>
              </div>
            )}
      </div>
    </div>
  )
}
