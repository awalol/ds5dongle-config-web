import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ArrowRight, Crosshair, Gamepad2, RefreshCw, RotateCcw, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DualSenseArtwork } from "@/components/remap/DualSenseArtwork";
import type { UseDs5BridgeResult } from "@/hooks/useDs5Bridge";
import type { ControllerModel } from "@/protocol/ds5BridgeHid";
import {
  BUTTON_DISABLE_ID,
  BUTTON_SOURCE_COUNT,
  BUTTON_TRANSLATION_KEYS,
  DEFAULT_BUTTON_REMAP,
  DUALSENSE_BUTTON_SOURCE_COUNT,
  buttonRemapsEqual,
} from "@/protocol/buttons";

interface RemapPageProps {
  bridge: UseDs5BridgeResult;
}

type DpadDirection =
  | "up"
  | "up-right"
  | "right"
  | "down-right"
  | "down"
  | "down-left"
  | "left"
  | "up-left";

interface ControllerHotspot {
  source: number;
  x: number;
  y: number;
  compact?: boolean;
  shape?: "wide" | "ps" | "touchpad" | "mute" | "paddle" | "dpad";
  direction?: DpadDirection;
  span?: number;
  arm?: number;
}

const DPAD_DIRECTIONS: readonly DpadDirection[] = [
  "up",
  "up-right",
  "right",
  "down-right",
  "down",
  "down-left",
  "left",
  "up-left",
];

// Sources 0-7 are the eight d-pad directions. Every wedge covers the same square
// centred on the pad and clips itself to the arm or corner it owns, so the pad is
// tiled without gaps or overlap and a click can never land on a neighbour.
// `span` is the square's width in % of the artwork, `arm` the arm strip edge in %
// of that square.
function dpadHotspots(x: number, y: number, span: number, arm: number): ControllerHotspot[] {
  return DPAD_DIRECTIONS.map((direction, source) => ({
    source,
    x,
    y,
    span,
    arm,
    direction,
    shape: "dpad" as const,
  }));
}

const DUALSENSE_HOTSPOTS: readonly ControllerHotspot[] = [
  ...dpadHotspots(16, 40.1, 20.8, 35),
  { source: 8, x: 77.4, y: 40.1 },
  { source: 9, x: 83.6, y: 48 },
  { source: 10, x: 89.9, y: 40.1 },
  { source: 11, x: 83.6, y: 32.3 },
  { source: 12, x: 17.7, y: 17.6, shape: "wide" },
  { source: 13, x: 82.4, y: 17.6, shape: "wide" },
  { source: 14, x: 17.7, y: 7.2, shape: "wide" },
  { source: 15, x: 82.4, y: 7.2, shape: "wide" },
  { source: 16, x: 24.2, y: 25.5, compact: true },
  { source: 17, x: 75.8, y: 25.5, compact: true },
  { source: 18, x: 31.5, y: 59.2, shape: "wide" },
  { source: 19, x: 68.3, y: 59.2, shape: "wide" },
  { source: 20, x: 50, y: 58, shape: "ps" },
  { source: 21, x: 50, y: 30, shape: "touchpad" },
  { source: 22, x: 50, y: 66.2, shape: "mute" },
];

const DUALSENSE_EDGE_HOTSPOTS: readonly ControllerHotspot[] = [
  ...dpadHotspots(21.9, 40.4, 16.6, 34.3),
  { source: 8, x: 71.5, y: 40.5 },
  { source: 9, x: 78.1, y: 48.9 },
  { source: 10, x: 84.8, y: 40.5 },
  { source: 11, x: 78.1, y: 32 },
  { source: 12, x: 21.8, y: 20.8, shape: "wide" },
  { source: 13, x: 78.3, y: 20.8, shape: "wide" },
  { source: 14, x: 22, y: 10.5, shape: "wide" },
  { source: 15, x: 78.1, y: 10.5, shape: "wide" },
  { source: 16, x: 28.6, y: 27.8, compact: true },
  { source: 17, x: 71, y: 27.8, compact: true },
  { source: 18, x: 35.6, y: 56.1, shape: "wide" },
  { source: 19, x: 64.4, y: 56.1, shape: "wide" },
  { source: 20, x: 50, y: 55.5, shape: "ps" },
  { source: 21, x: 50, y: 32.5, shape: "touchpad" },
  { source: 22, x: 50, y: 62.2, shape: "mute" },
  { source: 23, x: 35.6, y: 70.6, shape: "wide" },
  { source: 24, x: 64.4, y: 70.6, shape: "wide" },
  { source: 25, x: 32.5, y: 89, shape: "paddle" },
  { source: 26, x: 67.5, y: 89, shape: "paddle" },
];

export function RemapPage({ bridge }: RemapPageProps) {
  const { t } = useTranslation();
  const [selectedSource, setSelectedSource] = useState(8);
  const [highlightedSource, setHighlightedSource] = useState<number | null>(null);
  const [isPickingTarget, setIsPickingTarget] = useState(false);
  const [controllerModel, setControllerModel] = useState<ControllerModel>("dualsense");
  const isDualSenseEdge = controllerModel === "dualsense-edge";
  const controllerHotspots = isDualSenseEdge ? DUALSENSE_EDGE_HOTSPOTS : DUALSENSE_HOTSPOTS;
  const visibleSourceCount = isDualSenseEdge ? BUTTON_SOURCE_COUNT : DUALSENSE_BUTTON_SOURCE_COUNT;
  const selectedTarget = bridge.buttonRemap[selectedSource] ?? selectedSource;
  const isBusy = bridge.operation !== null;
  const canEdit = bridge.isConnected && !isBusy;
  const isIdentity = buttonRemapsEqual(
    bridge.buttonRemap.slice(0, visibleSourceCount),
    DEFAULT_BUTTON_REMAP.slice(0, visibleSourceCount),
  );
  const targetButtons = useMemo(
    () => [...Array.from({ length: visibleSourceCount }, (_, target) => target), BUTTON_DISABLE_ID],
    [visibleSourceCount],
  );
  const changedMappings = useMemo(
    () =>
      bridge.buttonRemap
        .slice(0, visibleSourceCount)
        .map((target, source) => ({ source, target }))
        .filter(({ source, target }) => source !== target),
    [bridge.buttonRemap, visibleSourceCount],
  );

  useEffect(() => {
    if (bridge.isConnected && bridge.controllerModel) {
      setControllerModel(bridge.controllerModel);
    }
  }, [bridge.controllerModel, bridge.isConnected]);

  useEffect(() => {
    setHighlightedSource(null);
    setIsPickingTarget(false);
    setSelectedSource((current) => (current < visibleSourceCount ? current : 8));
  }, [visibleSourceCount]);

  // Picking writes straight to the device, so a disconnect or a pending
  // operation leaves the mode instead of swallowing clicks on the artwork.
  useEffect(() => {
    if (!canEdit) {
      setIsPickingTarget(false);
    }
  }, [canEdit]);

  useEffect(() => {
    if (!isPickingTarget) {
      return;
    }
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPickingTarget(false);
      }
    };
    window.addEventListener("keydown", cancelOnEscape);
    return () => window.removeEventListener("keydown", cancelOnEscape);
  }, [isPickingTarget]);

  const buttonLabel = (button: number) =>
    t(`buttons.${BUTTON_TRANSLATION_KEYS[button] ?? BUTTON_TRANSLATION_KEYS[0]}`);

  const selectSource = (source: number) => {
    setIsPickingTarget(false);
    setSelectedSource(source);
  };

  // While picking, a hotspot chooses the mapped output for the source being
  // edited rather than switching which source is being edited.
  const handleHotspotClick = (source: number) => {
    if (!isPickingTarget) {
      setSelectedSource(source);
      return;
    }
    bridge.setButtonRemap(selectedSource, source);
    setIsPickingTarget(false);
  };

  return (
    <Card className="panel feature-page remap-page">
      <div className="feature-page-header">
        <div className="feature-page-title">
          <span className="feature-page-icon" aria-hidden="true">
            <Gamepad2 size={20} />
          </span>
          <div>
            <h2>{t("remap.title")}</h2>
            <p>{t("remap.description")}</p>
          </div>
        </div>
        <div className="feature-page-actions">
          <Button
            type="button"
            variant="outline"
            onClick={bridge.readButtonSettings}
            disabled={!bridge.client || isBusy}
          >
            <RefreshCw size={16} />
            {t("common.read")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={bridge.resetButtonRemap}
            disabled={!bridge.isConnected || isBusy || isIdentity}
          >
            <RotateCcw size={16} />
            {t("remap.resetAll")}
          </Button>
          <Button
            type="button"
            onClick={bridge.saveButtonRemap}
            disabled={!bridge.isConnected || isBusy || !bridge.isButtonRemapDirty}
          >
            <Save size={16} />
            {t("common.save")}
          </Button>
        </div>
      </div>

      <CardContent className="feature-page-content p-0">
        <div className="remap-workspace">
          <section className="controller-card" aria-labelledby="controller-visual-title">
            <div className="controller-card-heading">
              <div>
                <h3 id="controller-visual-title">
                  {t(isDualSenseEdge ? "remap.controllerTitleEdge" : "remap.controllerTitle")}
                </h3>
                <p>
                  {isPickingTarget
                    ? t("remap.pickTargetPrompt", { button: buttonLabel(selectedSource) })
                    : t("remap.controllerHint")}
                </p>
              </div>
              <div className="controller-card-tools">
                <Tabs
                  className="controller-model-switch"
                  value={controllerModel}
                  onValueChange={(value) => setControllerModel(value as ControllerModel)}
                >
                  <TabsList className="controller-model-tabs" aria-label={t("remap.controllerModel")}>
                    <TabsTrigger value="dualsense">DualSense</TabsTrigger>
                    <TabsTrigger value="dualsense-edge">DualSense Edge</TabsTrigger>
                  </TabsList>
                </Tabs>
                <span className="mapping-count">
                  {t("remap.changedCount", { count: changedMappings.length })}
                </span>
              </div>
            </div>

            <div
              className={`controller-visual${isDualSenseEdge ? " dualsense-edge" : ""}${isPickingTarget ? " picking" : ""}`}
            >
              <DualSenseArtwork
                model={controllerModel}
                selectedSource={selectedSource}
                highlightedSource={highlightedSource}
                targetSource={isPickingTarget ? selectedTarget : null}
              />
              {controllerHotspots.map(({ source, x, y, compact, shape, direction, span, arm }) => {
                const changed = bridge.buttonRemap[source] !== source;
                const isEdgeTouchpad = isDualSenseEdge && source === 21;
                const hasHitArea = isEdgeTouchpad || shape === "dpad";
                return (
                  <button
                    key={source}
                    type="button"
                    className={`controller-hotspot${compact ? " compact" : ""}${shape ? ` ${shape}` : ""}${direction ? ` dpad-${direction}` : ""}${isEdgeTouchpad ? " edge-touchpad" : ""}${changed ? " modified" : ""}`}
                    style={
                      {
                        left: `${x}%`,
                        top: `${y}%`,
                        ...(span === undefined
                          ? null
                          : { "--dpad-span": `${span}%`, "--dpad-arm": `${arm}%` }),
                      } as CSSProperties
                    }
                    data-source={source}
                    aria-label={t(
                      isPickingTarget ? "remap.pickTargetButton" : "remap.selectButton",
                      { button: buttonLabel(source) },
                    )}
                    aria-pressed={
                      isPickingTarget ? selectedTarget === source : selectedSource === source
                    }
                    title={buttonLabel(source)}
                    onClick={() => handleHotspotClick(source)}
                    onPointerEnter={() => setHighlightedSource(source)}
                    onPointerLeave={() => setHighlightedSource(null)}
                    onFocus={() => setHighlightedSource(source)}
                    onBlur={() => setHighlightedSource(null)}
                  >
                    {hasHitArea ? (
                      <span className="controller-hotspot-hit-area" aria-hidden="true" />
                    ) : null}
                  </button>
                );
              })}
            </div>
            <p className="controller-artwork-credit">
              {t("remap.modelCredit")}{" "}
              <a
                href="https://github.com/daidr/dualsense-tester"
                target="_blank"
                rel="noopener noreferrer"
              >
                dualsense-tester
              </a>
            </p>
          </section>

          <aside
            className="remap-editor"
            aria-label={`${t("remap.sourceButton")}: ${buttonLabel(selectedSource)}`}
          >
            <div className="mapping-flow" aria-label={t("remap.mappingPreview")}>
              <strong>{buttonLabel(selectedSource)}</strong>
              <ArrowRight size={18} aria-hidden="true" />
              <strong>{buttonLabel(selectedTarget)}</strong>
            </div>

            <label className="field-label" htmlFor="remap-target">
              {t("remap.targetButton")}
            </label>
            <div className="remap-target-field">
              <div className="select-shell">
                <select
                  id="remap-target"
                  value={selectedTarget}
                  disabled={!canEdit}
                  onChange={(event) =>
                    bridge.setButtonRemap(selectedSource, Number(event.target.value))
                  }
                >
                  {targetButtons.map((target) => (
                    <option key={target} value={target}>
                      {buttonLabel(target)}{target === selectedSource ? ` · ${t("remap.default")}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                variant={isPickingTarget ? "default" : "outline"}
                aria-pressed={isPickingTarget}
                disabled={!canEdit}
                onClick={() => setIsPickingTarget((current) => !current)}
              >
                <Crosshair size={16} />
                {t(isPickingTarget ? "remap.pickTargetCancel" : "remap.pickTarget")}
              </Button>
            </div>
            {isPickingTarget ? (
              <p className="remap-pick-hint">
                {t("remap.pickTargetHint", { button: buttonLabel(selectedSource) })}
              </p>
            ) : null}

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={!canEdit || selectedTarget === selectedSource}
              onClick={() => bridge.setButtonRemap(selectedSource, selectedSource)}
            >
              <RotateCcw size={16} />
              {t("remap.restoreButton")}
            </Button>

            <div className="mapping-list-section">
              <div className="mapping-list-heading">
                <h3>{t("remap.modifiedTitle")}</h3>
                <span>{changedMappings.length}</span>
              </div>
              {changedMappings.length === 0 ? (
                <p className="empty-copy">{t("remap.noChanges")}</p>
              ) : (
                <div className="mapping-list">
                  {changedMappings.map(({ source, target }) => (
                    <button key={source} type="button" onClick={() => selectSource(source)}>
                      <span>{buttonLabel(source)}</span>
                      <ArrowRight size={14} aria-hidden="true" />
                      <strong>{buttonLabel(target)}</strong>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </CardContent>
    </Card>
  );
}
