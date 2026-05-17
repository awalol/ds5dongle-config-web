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
  displayMin?: number;
  displayMax?: number;
  displayStep?: number;
  valueToDisplay?: (value: number) => number;
  displayToValue?: (value: number) => number;
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
  displayMin,
  displayMax,
  displayStep,
  valueToDisplay,
  displayToValue,
  fractionDigits = 2,
  issue,
  onChange,
}: FloatControlProps) {
  const { t } = useTranslation();
  const toDisplay = valueToDisplay ?? ((next: number) => (next + displayOffset) * displayScale);
  const toValue = displayToValue ?? ((next: number) => next / displayScale - displayOffset);
  const inputValue = toDisplay(value);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.currentTarget.value);
    if (Number.isFinite(next)) {
      onChange(toValue(next));
    }
  };

  const handleSliderChange = ([next]: number[]) => {
    if (Number.isFinite(next)) {
      onChange(toValue(next));
    }
  };

  return (
    <label className={`control-row ${issue ? "invalid" : ""}`}>
      <span>
        <strong>{label}</strong>
        {issue && <small>{t(`validation.${issue.field}`)}</small>}
      </span>
      <div className="range-inputs">
        <Slider
          min={displayMin ?? toDisplay(min)}
          max={displayMax ?? toDisplay(max)}
          step={displayStep ?? step * displayScale}
          value={[inputValue]}
          onValueChange={handleSliderChange}
        />
        <Input
          type="number"
          min={displayMin ?? toDisplay(min)}
          max={displayMax ?? toDisplay(max)}
          step={displayStep ?? step * displayScale}
          value={inputValue.toFixed(fractionDigits)}
          onChange={handleChange}
          aria-invalid={Boolean(issue)}
          className="font-bold"
        />
      </div>
    </label>
  );
}
