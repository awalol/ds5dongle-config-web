import { Laptop, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ThemeMode } from "@/hooks/useTheme";

interface ThemeSwitcherProps {
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
}

const themeOptions: Array<{ value: ThemeMode; icon: typeof Sun }> = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Laptop },
];

export function ThemeSwitcher({ theme, onThemeChange }: ThemeSwitcherProps) {
  const { t } = useTranslation();

  return (
    <div className="theme-switcher" aria-label={t("theme.label")}>
      <Tabs value={theme} onValueChange={(value) => onThemeChange(value as ThemeMode)}>
        <TabsList className="grid h-9 w-[132px] grid-cols-3">
          {themeOptions.map(({ value, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              title={t(`theme.${value}`)}
              aria-label={t(`theme.${value}`)}
              className="h-7 text-xs font-bold"
            >
              <Icon size={14} />
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
