import { useEffect, useState } from "react";
import Lottie from "lottie-react";

interface LoadingScreenProps {
  onComplete: () => void;
}

function RocketAnimation() {
  const [animationData, setAnimationData] = useState(null);

  useEffect(() => {
    // Load the Lottie animation file
    fetch("/loading.json")
      .then((response) => response.json())
      .then((data) => {
        setAnimationData(data);
      })
      .catch((error) =>
        console.error("Error loading Lottie animation:", error)
      );
  }, []);

  if (!animationData) {
    // Fallback while loading
    return (
      <div className="w-20 h-20 bg-transparent rounded-full animate-pulse"></div>
    );
  }

  return (
    <div className="relative w-20 h-20">
      <Lottie
        animationData={animationData}
        loop={true}
        autoplay={true}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}

export default function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onComplete, 200);
    }, 400);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 backdrop-blur-sm">
      <div className="flex flex-col items-center space-y-2">
        <RocketAnimation />

        <div className="text-center">
          <h1 className="text-2xl font-bold font-heading text-white mb-1">
            SAM Tracker
          </h1>
          <p className="text-sm text-gray-300">AI Analysis Tool</p>
        </div>
      </div>
    </div>
  );
}
