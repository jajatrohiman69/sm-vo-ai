export const API_URL = "/api/backend";

export type UploadedAttachment = {
  file_id: string;
  filename: string;
  kind: "excel" | "csv" | "image";
  extracted_text: string;
  size_bytes: number;
};

export async function uploadAttachment(
  file: File,
): Promise<UploadedAttachment> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_URL}/ai/files/upload`, {
    method: "POST",
    body: formData,
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || `Gagal mengunggah ${file.name}.`);
  }
  if (
    typeof data.file_id !== "string" ||
    typeof data.filename !== "string" ||
    typeof data.extracted_text !== "string"
  ) {
    throw new Error(`Respons upload untuk ${file.name} tidak valid.`);
  }

  return data as UploadedAttachment;
}

export type WorkspaceSettings = {
  id?: number;
  office_name: string;
  office_subtitle: string;
  office_badge: string;
  logo_url: string;
  brand_color: string;
  led_line_1: string;
  led_line_2: string;
  chalk_line_1: string;
  chalk_line_2: string;
  chalk_line_3: string;
  updated_at?: string | null;
};

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  office_name: "Solusi Macro",
  office_subtitle: "Excel · Dashboard · Otomasi",
  office_badge: "Virtual Office · AI Team",
  logo_url: "/solusi-macro-logo.png",
  brand_color: "#4f46e5",
  led_line_1: "DREAM IT",
  led_line_2: "MAKE IT REAL",
  chalk_line_1: "Good",
  chalk_line_2: "Vibes",
  chalk_line_3: "Only",
};

export function resolveLogoUrl(logoUrl?: string | null): string {
  if (!logoUrl) return "/solusi-macro-logo.png";
  if (logoUrl.startsWith("/workspace/")) {
    return `${API_URL}${logoUrl}`;
  }
  return logoUrl;
}

