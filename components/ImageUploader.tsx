"use client";

import { ImageIcon, Loader2, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

const ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

export type ImageUploaderProps = {
  /** Current proof URL (https), shown as preview when set. */
  value: string;
  /** Called with Cloudinary `secure_url` after a successful upload, or `""` when cleared. */
  onChange: (secureUrl: string) => void;
  /** Label for the file picker button (default English). */
  selectButtonLabel?: string;
  disabled?: boolean;
  className?: string;
};

export function ImageUploader({
  value,
  onChange,
  selectButtonLabel = "Select Receipt Image",
  disabled = false,
  className,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const fd = new FormData();
        fd.set("file", file);
        const res = await fetch("/api/upload", {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        const data = (await res.json().catch(() => ({}))) as { secure_url?: string; message?: string };
        if (!res.ok) {
          toast.error(String(data.message || "Upload failed"));
          return;
        }
        const url = data.secure_url;
        if (!url || typeof url !== "string") {
          toast.error("Invalid response from server");
          return;
        }
        onChange(String(url).trim());
      } catch {
        toast.error("Network error during upload");
      } finally {
        setUploading(false);
      }
    },
    [onChange]
  );

  const onInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await uploadFile(file);
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        disabled={disabled || uploading}
        onChange={onInputChange}
      />

      <div className="flex flex-col gap-3">
        <button
          type="button"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white/90 transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-cyan-300" aria-hidden />
              <span>Uploading…</span>
            </>
          ) : (
            <>
              <ImageIcon className="h-5 w-5 shrink-0 text-white/50" aria-hidden />
              <span>{selectButtonLabel}</span>
            </>
          )}
        </button>

        {value ? (
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="Receipt preview" className="mx-auto max-h-56 w-full object-contain" />
            <div className="flex items-center justify-end gap-2 border-t border-white/10 bg-white/[0.04] px-3 py-2">
              <button
                type="button"
                disabled={disabled || uploading}
                onClick={() => inputRef.current?.click()}
                className="text-xs font-medium text-cyan-300 hover:underline disabled:opacity-50"
              >
                Replace
              </button>
              <button
                type="button"
                disabled={disabled || uploading}
                onClick={() => onChange("")}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
                Remove
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
