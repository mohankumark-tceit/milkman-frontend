import { useEffect, useRef } from "react";
import lottie from "lottie-web";
import "../styles/LogoIntro.css";

export default function LogoIntro({ path = "/logoIntro.json", visible = true }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!visible) return;
    const anim = lottie.loadAnimation({
      container: ref.current,
      renderer: "svg",
      loop: true,
      autoplay: true,
      path,
    });

    return () => anim.destroy();
  }, [path, visible]);

  if (!visible) return null;

  return (
    <div className="logo-intro-overlay" role="status" aria-hidden={!visible}>
      <div className="logo-intro-box">
        <div ref={ref} className="logo-intro-lottie" />
      </div>
    </div>
  );
}
