export default function BackgroundVideo() {
  return (
    <div className="background-video-container" aria-hidden="true">
      <video
        className="background-video"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      >
        <source
          src="/videos/video_cleanup.mp4"
          type="video/mp4"
        />
      </video>

      <div className="background-video-overlay" />
    </div>
  );
}