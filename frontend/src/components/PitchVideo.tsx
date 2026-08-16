// Renders an uploaded pitch video inline. Files we host on Cloudinary play in
// a real player; anything else (a YouTube/Loom/Vimeo link a founder pasted)
// stays a link, since those hosts block direct <video> playback.
export default function PitchVideo({ url, className = '' }: { url: string; className?: string }) {
  if (!url) return null;
  const isHosted = /^https?:\/\/res\.cloudinary\.com\//.test(url);

  if (isHosted) {
    return (
      <video
        src={url}
        controls
        preload="metadata"
        className={`w-full rounded-lg bg-black max-h-[420px] ${className}`}
      />
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 hover:underline break-all ${className}`}
    >
      ▶ Watch the pitch video
    </a>
  );
}
