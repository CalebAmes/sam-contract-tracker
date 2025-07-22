import { useEffect, useState } from "react";
import Lottie from "lottie-react";

interface LoadingOverlayProps {
  message?: string;
  fullScreen?: boolean;
  className?: string;
}

export default function LoadingOverlay({ 
  message = "Loading...", 
  fullScreen = false,
  className = ""
}: LoadingOverlayProps) {
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

  const containerClasses = fullScreen
    ? "fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30 backdrop-blur-sm"
    : `flex items-center justify-center ${className}`;

  if (!animationData) {
    // Fallback while loading animation
    return (
      <div className={containerClasses}>
        <div className="flex flex-col items-center space-y-2">
          <div className="w-12 h-12 bg-transparent rounded-full animate-pulse"></div>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      <div className="flex flex-col items-center space-y-2">
        <div className="relative w-16 h-16">
          <Lottie
            animationData={animationData}
            loop={true}
            autoplay={true}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}