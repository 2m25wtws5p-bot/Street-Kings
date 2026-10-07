import React from "react";
import { useI18n } from "../i18n/I18nProvider";

export function HostCrown() {
  const { t } = useI18n();
  return <svg className="host-crown" width="17" height="17" viewBox="0 0 24 24" role="img" aria-label={t("game.host")} data-testid="host-crown">
    <path d="M3 7.5 7.5 11 12 4l4.5 7L21 7.5l-2 11H5z" fill="#f8c54d" stroke="#9d6b12" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M5.4 15.8h13.2M6 21h12" fill="none" stroke="#ffe797" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="12" cy="13" r="1.5" fill="#b84426" />
  </svg>;
}
