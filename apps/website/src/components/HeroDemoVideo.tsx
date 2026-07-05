import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

const POSTER_SRC = "/videos/hero-campaign-demo-poster.png";
const WEBM_SRC = "/videos/hero-campaign-demo.webm";
const MP4_SRC = "/videos/hero-campaign-demo.mp4";

type HeroDemoVideoProps = {
  title: string;
  fallback: ReactNode;
};

function isInViewport(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight;
  const visible = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
  return visible > 0 && visible / rect.height >= 0.15;
}

export function HeroDemoVideo({ title, fallback }: HeroDemoVideoProps) {
  const ref = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  const [ready, setReady] = useState(false);
  const [preferStatic, setPreferStatic] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [videoError, setVideoError] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && isInViewport(el)) setInView(true);
  }, []);

  useEffect(() => {
    if (preferStatic || videoError) return;

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry?.isIntersecting ?? false),
      { threshold: [0, 0.15, 0.35] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [preferStatic, videoError]);

  const tryPlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || !inView) return;
    void video.play().catch(() => {
      /* Not ready yet — canplay handler will retry */
    });
  }, [inView]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || preferStatic || videoError) return;

    if (inView) {
      tryPlay();
    } else {
      video.pause();
    }
  }, [inView, preferStatic, videoError, tryPlay, ready]);

  if (preferStatic || videoError) {
    return <>{fallback}</>;
  }

  return (
    <div ref={ref} className="hero__demo-video">
      <video
        ref={videoRef}
        className="hero__demo-video-el"
        poster={POSTER_SRC}
        muted
        playsInline
        loop
        autoPlay={inView}
        preload="auto"
        aria-label={title}
        onError={() => setVideoError(true)}
        onCanPlay={() => {
          setReady(true);
          if (inView) tryPlay();
        }}
        onLoadedData={() => {
          if (inView) tryPlay();
        }}
      >
        <source src={MP4_SRC} type="video/mp4" />
        <source src={WEBM_SRC} type="video/webm" />
      </video>
    </div>
  );
}
