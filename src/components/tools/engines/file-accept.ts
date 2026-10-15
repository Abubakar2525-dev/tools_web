type FileIdentity = Pick<File, "name" | "type">;

const MIME_EXTENSIONS: Record<string, readonly string[]> = {
  "application/json": ["json"],
  "application/pdf": ["pdf"],
  "application/zip": ["zip"],
  "image/avif": ["avif"],
  "image/bmp": ["bmp"],
  "image/gif": ["gif"],
  "image/heic": ["heic"],
  "image/heif": ["heif"],
  "image/jpeg": ["jpg", "jpeg", "jfif"],
  "image/png": ["png"],
  "image/svg+xml": ["svg"],
  "image/tiff": ["tif", "tiff"],
  "image/webp": ["webp"],
  "text/csv": ["csv"],
  "text/plain": ["txt", "md", "csv", "log"],
};

const WILDCARD_EXTENSIONS: Record<string, readonly string[]> = {
  "audio/": ["aac", "aiff", "flac", "m4a", "mp3", "ogg", "opus", "wav", "webm"],
  "image/": ["avif", "bmp", "gif", "heic", "heif", "jfif", "jpg", "jpeg", "png", "svg", "tif", "tiff", "webp"],
  "video/": ["avi", "m4v", "mkv", "mov", "mp4", "mpeg", "webm"],
};

const extensionOf = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";

/** Compiles HTML accept syntax once so large file/folder batches stay fast. */
export function createFileAcceptMatcher(accept?: string) {
  const parts = accept?.split(",").map((part) => part.trim().toLowerCase()).filter(Boolean) ?? [];
  if (!parts.length) return () => true;

  return (file: FileIdentity) => {
    const name = file.name.toLowerCase();
    const type = (file.type || "").toLowerCase();
    const extension = extensionOf(name);

    return parts.some((part) => {
      if (part.startsWith(".")) return name.endsWith(part);
      if (part.endsWith("/*")) {
        const prefix = part.slice(0, -1);
        return type.startsWith(prefix) || WILDCARD_EXTENSIONS[prefix]?.includes(extension) === true;
      }
      return type === part || MIME_EXTENSIONS[part]?.includes(extension) === true;
    });
  };
}

/** Matches HTML accept syntax, with an extension fallback for blank or generic MIME types. */
export function fileMatchesAccept(file: FileIdentity, accept?: string) {
  return createFileAcceptMatcher(accept)(file);
}
