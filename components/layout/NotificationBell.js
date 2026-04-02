"use client";

import { FaBell, FaBellSlash } from "react-icons/fa";
import { FaSpinner } from "react-icons/fa";
import { useTranslations } from "next-intl";
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

  const t = useTranslations("notifications");

  if (!isSupported) return null;

  const handleClick = async () => {
    if (isLoading) return;

    if (isDenied) {
      toast.error(t("blocked"));
      return;
    }

    if (isSubscribed) {
      const success = await unsubscribe();
      if (success) {
        toast.success(t("disabled"));
      } else {
        toast.error(t("disableFailed"));
      }
    } else {
      const success = await subscribe();
      if (success) {
        toast.success(t("enabled"));
      } else if (!isDenied) {
        toast.error(t("enableFailed"));
      }
    }
  };

  const getIcon = () => {
    if (isLoading) return <FaSpinner className="w-4 h-4 animate-spin" />;
    if (isDenied || !isSubscribed) return <FaBellSlash className="w-4 h-4" />;
    return <FaBell className="w-4 h-4" />;
  };

  const getLabel = () => {
    if (isDenied) return t("blockedLabel");
    if (isSubscribed) return t("disableLabel");
    return t("enableLabel");
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
