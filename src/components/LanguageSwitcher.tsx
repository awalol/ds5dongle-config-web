import { ChevronDown, Languages } from "lucide-react";
import { useTranslation } from "react-i18next";

type SupportedLanguage = "en" | "zh" | "fr";

const languageOptions: Array<{
  value: SupportedLanguage;
  labelKey: "language.english" | "language.chinese" | "language.french";
}> = [
  { value: "en", labelKey: "language.english" },
  { value: "zh", labelKey: "language.chinese" },
  { value: "fr", labelKey: "language.french" },
];

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const currentLanguage = getSupportedLanguage(i18n.resolvedLanguage ?? i18n.language);

  return (
    <div className="language-switcher" aria-label={t("language.label")}>
      <Languages size={16} />
      <div className="language-select-wrapper">
        <select
          className="language-select"
          value={currentLanguage}
          aria-label={t("language.label")}
          onChange={(event) => void i18n.changeLanguage(event.target.value)}
        >
          {languageOptions.map(({ value, labelKey }) => (
            <option key={value} value={value}>
              {t(labelKey)}
            </option>
          ))}
        </select>
        <ChevronDown className="language-select-chevron" size={14} aria-hidden="true" />
      </div>
    </div>
  );
}

function getSupportedLanguage(language: string | undefined): SupportedLanguage {
  if (language?.startsWith("zh")) {
    return "zh";
  }

  if (language?.startsWith("fr")) {
    return "fr";
  }

  return "en";
}
