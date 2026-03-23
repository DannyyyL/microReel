/** Only accept YouTube video IDs: 11 alphanumeric/dash/underscore characters. */
const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

window.addEventListener("message", (event) => {
  // Only accept messages from the extension's own origin.
  if (event.origin !== location.origin) return;

  const iframe = document.getElementById("player");
  if (!iframe) return;

  if (event.data?.type === "microreel-load-video") {
    const youtubeId = String(event.data.youtubeId ?? "");
    if (!YOUTUBE_ID_RE.test(youtubeId)) return; // reject invalid IDs
    iframe.src = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&mute=1&loop=1&controls=1&modestbranding=1&playsinline=1&rel=0`;
  }

  if (event.data?.type === "microreel-stop-video") {
    iframe.src = "";
  }
});
