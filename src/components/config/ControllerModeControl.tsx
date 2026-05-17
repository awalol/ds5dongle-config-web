import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CONTROLLER_MODE_OPTIONS, ControllerMode } from "../../protocol/config";

interface ControllerModeControlProps {
  value: ControllerMode;
  onChange: (value: ControllerMode) => void;
}

export function ControllerModeControl({ value, onChange }: ControllerModeControlProps) {
  const { t } = useTranslation();
  const optionLabels: Record<ControllerMode, string> = {
    0: t("config.controllerModeOptions.ds5"),
    1: t("config.controllerModeOptions.dse"),
    2: t("config.controllerModeOptions.auto"),
  };

  return (
    <div className="control-row">
      <strong>{t("config.controllerMode")}</strong>
      <Tabs
        value={String(value)}
        onValueChange={(next) => onChange(Number(next) as ControllerMode)}
        className="w-full"
      >
        <TabsList className="grid h-10 w-full grid-cols-3">
          {CONTROLLER_MODE_OPTIONS.map((option) => (
            <TabsTrigger key={option.value} value={String(option.value)} className="h-8 text-sm font-bold">
              {optionLabels[option.value]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
