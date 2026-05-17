import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";

interface ToggleControlProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

export function ToggleControl({ label, value, onChange }: ToggleControlProps) {
  const { t } = useTranslation();

  return (
    <div className="control-row toggle-row">
      <strong>{label}</strong>
      <Switch
        checked={value}
        onCheckedChange={onChange}
        className="justify-self-end"
        title={value ? t("toggle.enabled") : t("toggle.disabled")}
      />
    </div>
  );
}
