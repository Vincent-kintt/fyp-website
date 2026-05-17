import { FaClock, FaPlay, FaCheck, FaPause } from "react-icons/fa";
import { getStatusConfig } from "@/lib/utils";

// STATUS_CONFIG.icon holds the canonical string key per status
// ("clock"/"play"/"check"/"pause"). This module is the single place
// that maps those keys to react-icons components, so callers never
// re-declare the mapping inline.
const ICON_BY_NAME = {
  clock: FaClock,
  play: FaPlay,
  check: FaCheck,
  pause: FaPause,
};

export function getStatusIconComponent(status) {
  const config = getStatusConfig(status);
  return ICON_BY_NAME[config.icon] || FaClock;
}
