import { useEffect, useState } from "react";
import Lottie from "lottie-react";

interface LoadingScreenProps {
  onComplete: () => void;
}

const animationPath = "/loading.json";

export default function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [animationData, setAnimationData] = useState<any>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    fetch(animationPath)
      .then((response) => response.json())
      .then(setAnimationData)
      .catch(() => setAnimationData(null));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onComplete, 200);
    }, 400);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 backdrop-blur-sm">
      <div className="flex flex-col items-center space-y-3">
        <div className="h-20 w-20">
          {animationData ? (
            <Lottie animationData={animationData} loop autoplay />
          ) : (
            <div className="h-full w-full animate-pulse rounded-full border border-muted" />
          )}
        </div>
        <div className="text-center">
          <h1 className="font-heading text-2xl font-bold text-white">SAM Tracker</h1>
          <p className="text-sm text-gray-300">SDR Workspace</p>
        </div>
      </div>
    </div>
  );
}
