import { sb, q } from "./supabase.js";
import { BUCKET } from "./config.js";
import { state } from "./ui.js";

const urlCache = new Map();

export async function signedUrl(path, { download = false } = {}) {
  const key = path + (download ? "|dl" : "");
  const c = urlCache.get(key);
  if (c && c.exp > Date.now()) return c.url;
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 3600, download ? { download: true } : undefined);
  if (error) throw error;
  urlCache.set(key, { url: data.signedUrl, exp: Date.now() + 55 * 60 * 1000 });
  return data.signedUrl;
}

function safeName(name) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-]+/g, "_").slice(-120) || "soubor";
}

/** Nahraje soubor do storage a založí řádek ve files. */
export async function uploadFile(file, folderId, description = null) {
  const path = `files/${crypto.randomUUID()}/${safeName(file.name)}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (error) throw new Error(error.message?.includes("exceeded") ? `${file.name} je moc velký (max 50 MB).` : error.message);
  const rows = await q(sb.from("files").insert({
    folder_id: folderId || null, name: file.name, storage_path: path, size: file.size,
    mime: file.type || null, description, uploaded_by: state.me.id,
  }).select());
  return rows[0];
}

export async function deleteFile(f) {
  await sb.storage.from(BUCKET).remove([f.storage_path]);
  await q(sb.from("files").delete().eq("id", f.id));
}

export async function folderByName(name, icon = "▸") {
  const found = await q(sb.from("folders").select("*").eq("name", name).is("parent_id", null).limit(1));
  if (found[0]) return found[0];
  return (await q(sb.from("folders").insert({ name, icon, sort: 50, created_by: state.me.id }).select()))[0];
}

export const isImage = (f) => /^image\//.test(f.mime || "") || /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(f.name);
export const isPdf = (f) => f.mime === "application/pdf" || /\.pdf$/i.test(f.name);
export const isVideo = (f) => /^video\//.test(f.mime || "");

export function fileIcon(f) {
  if (isImage(f)) return "IMG";
  if (isPdf(f)) return "PDF";
  if (isVideo(f)) return "VID";
  const ext = (f.name.split(".").pop() || "").toUpperCase();
  return ext.length <= 4 ? ext : "FILE";
}
