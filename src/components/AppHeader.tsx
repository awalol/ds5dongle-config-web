import { CheckCircle2, Usb } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ThemeSwitcher } from "./ThemeSwitcher";
import type { ThemeMode } from "@/hooks/useTheme";

interface AppHeaderProps {
  isConnected: boolean;
  statusText: string;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
}

export function AppHeader({ isConnected, statusText, theme, onThemeChange }: AppHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="app-header">
      <div>
        <div className="eyebrow">{t("app.eyebrow")}</div>
        <h1>{t("app.title")}</h1>
      </div>
      <div className="header-actions">
        <LanguageSwitcher />
        <ThemeSwitcher theme={theme} onThemeChange={onThemeChange} />
        <div className={`status-pill ${isConnected ? "connected" : ""}`}>
          {isConnected ? <CheckCircle2 size={16} /> : <Usb size={16} />}
          <span>{statusText}</span>
        </div>
      </div>
    </header>
  );
}
