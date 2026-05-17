import { useTranslation } from "react-i18next";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { POLLING_RATE_OPTIONS, PollingRateMode } from "../../protocol/config";

interface PollingRateControlProps {
  value: PollingRateMode;
  onChange: (value: PollingRateMode) => void;
}

export function PollingRateControl({ value, onChange }: PollingRateControlProps) {
  const { t } = useTranslation();
  const optionLabels: Record<PollingRateMode, string> = {
    0: t("config.pollingRate.hz250"),
    1: t("config.pollingRate.hz500"),
    2: t("config.pollingRate.realTime"),
  };

  return (
    <div className="control-row">
      <strong>{t("config.pollingRateMode")}</strong>
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
