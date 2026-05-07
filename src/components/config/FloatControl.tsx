import { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ConfigValidationIssue } from "../../protocol/config";

interface FloatControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayScale?: number;
  displayOffset?: number;
  fractionDigits?: number;
  issue?: ConfigValidationIssue;
  onChange: (value: number) => void;
}

export function FloatControl({
  label,
  value,
  min,
  max,
  step,
  displayScale = 1,
  displayOffset = 0,
  fractionDigits = 2,
  issue,
  onChange,
}: FloatControlProps) {
  const { t } = useTranslation();
  const inputValue = (value + displayOffset) * displayScale;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.currentTarget.value);
    if (Number.isFinite(next)) {
      onChange(next / displayScale - displayOffset);
    }
  };

  const handleSliderChange = ([next]: number[]) => {
    if (Number.isFinite(next)) {
      onChange(next);
    }
  };

  return (
    <label className={`control-row ${issue ? "invalid" : ""}`}>
      <span>
        <strong>{label}</strong>
        {issue && <small>{t(`validation.${issue.field}`)}</small>}
      </span>
      <div className="range-inputs">
        <Slider min={min} max={max} step={step} value={[value]} onValueChange={handleSliderChange} />
        <Input
          type="number"
          min={(min + displayOffset) * displayScale}
          max={(max + displayOffset) * displayScale}
          step={step * displayScale}
          value={inputValue.toFixed(fractionDigits)}
          onChange={handleChange}
          aria-invalid={Boolean(issue)}
          className="font-bold"
        />
      </div>
    </label>
  );
}
