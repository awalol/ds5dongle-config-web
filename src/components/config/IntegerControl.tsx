import { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ConfigValidationIssue } from "../../protocol/config";

interface IntegerControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  issue?: ConfigValidationIssue;
  onChange: (value: number) => void;
}

export function IntegerControl({ label, value, min, max, issue, onChange }: IntegerControlProps) {
  const { t } = useTranslation();

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.currentTarget.value);
    if (Number.isFinite(next)) {
      onChange(Math.round(next));
    }
  };

  const handleSliderChange = ([next]: number[]) => {
    if (Number.isFinite(next)) {
      onChange(Math.round(next));
    }
  };

  return (
    <label className={`control-row ${issue ? "invalid" : ""}`}>
      <span>
        <strong>{label}</strong>
        {issue && <small>{t(`validation.${issue.field}`)}</small>}
      </span>
      <div className="range-inputs">
        <Slider min={min} max={max} step={1} value={[value]} onValueChange={handleSliderChange} />
        <Input
          type="number"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={handleChange}
          aria-invalid={Boolean(issue)}
          className="font-bold"
        />
      </div>
    </label>
  );
}
