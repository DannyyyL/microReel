window.addEventListener("message", (event) => {
  const iframe = document.getElementById("player");
  if (event.data?.type === "microreel-load-video") {
    iframe.src = `https://www.youtube.com/embed/${event.data.youtubeId}?autoplay=1&mute=1&loop=1&controls=1&modestbranding=1&playsinline=1&rel=0`;
  }
  if (event.data?.type === "microreel-stop-video") {
    iframe.src = "";
  }
});
