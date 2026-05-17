import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const currentLanguage = i18n.resolvedLanguage?.startsWith("zh") ? "zh" : "en";

  return (
    <div className="language-switcher" aria-label={t("language.label")}>
      <Languages size={16} />
      <Tabs value={currentLanguage} onValueChange={(language) => void i18n.changeLanguage(language)}>
        <TabsList className="grid h-9 w-[132px] grid-cols-2">
          <TabsTrigger value="en" className="h-7 text-xs font-bold">
            EN
          </TabsTrigger>
          <TabsTrigger value="zh" className="h-7 text-xs font-bold">
            中文
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
