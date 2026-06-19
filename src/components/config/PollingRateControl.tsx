import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { POLLING_RATE_OPTIONS, PollingRateMode } from "../../protocol/config";
import { ConfigHelpButton } from "./ConfigHelpButton";

interface PollingRateControlProps {
  value: PollingRateMode;
  helpContent?: string;
  onChange: (value: PollingRateMode) => void;
}

export function PollingRateControl({ value, helpContent, onChange }: PollingRateControlProps) {
  const { t } = useTranslation();
  const label = t("config.pollingRateMode");
  const optionLabels: Record<PollingRateMode, string> = {
    0: t("config.pollingRate.hz250"),
    1: t("config.pollingRate.hz500"),
    2: t("config.pollingRate.realTime"),
  };

  return (
    <div className="control-row">
      <span className="control-label">
        <strong>{label}</strong>
        {helpContent && <ConfigHelpButton title={label} content={helpContent} />}
      </span>
      <Tabs
        value={String(value)}
        onValueChange={(next) => onChange(Number(next) as PollingRateMode)}
        className="w-full"
      >
        <TabsList className="grid h-10 w-full grid-cols-3">
          {POLLING_RATE_OPTIONS.map((option) => (
            <TabsTrigger key={option.value} value={String(option.value)} className="h-8 text-sm font-bold">
              {optionLabels[option.value]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
