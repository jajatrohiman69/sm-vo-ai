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
