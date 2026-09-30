/**
 * PRD §6: a lightweight OBS capture path. Instead of a full browser-source
 * render, mirror the canvas into a floating Picture-in-Picture window that
 * OBS can grab with a cheap "window capture" instead.
 *
 * `requestPictureInPicture()` has two strict requirements that don't play
 * well together: it must be called within the click's transient
 * user-activation window, AND the video's metadata must already be loaded
 * (readyState past HAVE_NOTHING). Waiting for metadata inside the click
 * handler reliably loses the activation window first. So the hidden video
 * is created and started eagerly at startup (muted autoplay needs no
 * gesture) via `createPipVideo`, and the click handler just calls
 * `requestPip` synchronously against the already-ready video.
 */
export function createPipVideo(canvas: HTMLCanvasElement): HTMLVideoElement {
  const stream = canvas.captureStream(60);
  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  video.style.position = 'fixed';
  video.style.width = '1px';
  video.style.height = '1px';
  video.style.opacity = '0';
  video.style.pointerEvents = 'none';
  document.body.appendChild(video);
  video.play().catch(() => {
    // Autoplay can still be blocked in some contexts; requestPip() below
    // will surface a clear error at click time if metadata never loads.
  });
  return video;
}

export async function requestPip(video: HTMLVideoElement): Promise<void> {
  if (!document.pictureInPictureEnabled) {
    throw new Error('Picture-in-Picture is not supported in this browser');
  }
  await video.requestPictureInPicture();
}
