"use client";

import { FaBell, FaBellSlash } from "react-icons/fa";
import { FaSpinner } from "react-icons/fa";
import { usePushNotification } from "@/hooks/usePushNotification";
import { toast } from "sonner";

export default function NotificationBell() {
  const {
    isSupported,
    isSubscribed,
    isDenied,
    isLoading,
    subscribe,
    unsubscribe,
  } = usePushNotification();

  if (!isSupported) return null;

  const handleClick = async () => {
    if (isLoading) return;

    if (isDenied) {
      toast.error(
        "Notifications are blocked. Please enable them in browser settings."
      );
      return;
    }

    if (isSubscribed) {
      const success = await unsubscribe();
      if (success) {
        toast.success("Notifications disabled");
      } else {
        toast.error("Failed to disable notifications");
      }
    } else {
      const success = await subscribe();
      if (success) {
        toast.success("Notifications enabled!");
      } else if (!isDenied) {
        toast.error("Failed to enable notifications");
      }
    }
  };

  const getIcon = () => {
    if (isLoading) return <FaSpinner className="w-4 h-4 animate-spin" />;
    if (isDenied || !isSubscribed) return <FaBellSlash className="w-4 h-4" />;
    return <FaBell className="w-4 h-4" />;
  };

  const getLabel = () => {
    if (isDenied) return "Notifications blocked";
    if (isSubscribed) return "Disable notifications";
    return "Enable notifications";
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`p-2 rounded-lg transition-colors ${
        isSubscribed
          ? "text-primary bg-primary-light hover:bg-primary/20"
          : "text-text-secondary hover:text-primary hover:bg-background-tertiary"
      } ${isDenied ? "opacity-50 cursor-not-allowed" : ""}`}
      aria-label={getLabel()}
      title={getLabel()}
    >
      {getIcon()}
    </button>
  );
}
