import { useMemo } from "react";
import dualSenseEdgeSvg from "@/assets/dualsense-edge.svg?raw";
import dualSenseSvg from "@/assets/dualsense.svg?raw";
import type { ControllerModel } from "@/protocol/ds5BridgeHid";

interface DualSenseArtworkProps {
  model: ControllerModel;
  selectedSource: number;
  highlightedSource: number | null;
  /** Mapped output to mark while the user picks a target on the artwork. */
  targetSource: number | null;
}

const DUALSENSE_SOURCE_PART_IDS: Readonly<Record<number, readonly string[]>> = {
  0: ["dpad-up"],
  1: ["dpad-up", "dpad-right"],
  2: ["dpad-right"],
  3: ["dpad-right", "dpad-down"],
  4: ["dpad-down"],
  5: ["dpad-down", "dpad-left"],
  6: ["dpad-left"],
  7: ["dpad-left", "dpad-up"],
  8: ["square"],
  9: ["cross"],
  10: ["circle"],
  11: ["triangle"],
  12: ["l1"],
  13: ["r1"],
  14: ["l2"],
  15: ["r2"],
  16: ["create", "create-icon"],
  17: ["options", "options-icon"],
  18: ["l3group"],
  19: ["r3group"],
  20: ["ps"],
  21: ["touchpad"],
  22: ["mute"],
};

const DUALSENSE_EDGE_SOURCE_PART_IDS: Readonly<Record<number, readonly string[]>> = {
  0: ["ActiveDPad", "DPadUp"],
  1: ["ActiveDPad", "DPadUp", "ActiveDPad2", "DPadRight"],
  2: ["ActiveDPad2", "DPadRight"],
  3: ["ActiveDPad2", "DPadRight", "ActiveDPad1", "DPadDown"],
  4: ["ActiveDPad1", "DPadDown"],
  5: ["ActiveDPad1", "DPadDown", "ActiveDPad3", "DPadLeft"],
  6: ["ActiveDPad3", "DPadLeft"],
  7: ["ActiveDPad3", "DPadLeft", "ActiveDPad", "DPadUp"],
  8: ["Active_Square", "Square"],
  9: ["Active_Cross", "Cross"],
  10: ["Active_Circle", "Circle"],
  11: ["Active_Triangle", "Triangle"],
  12: ["Active_L1"],
  13: ["Active_L2"],
  14: ["Active_LT", "LT"],
  15: ["Active_RT", "RT"],
  16: ["Active_Create", "Create"],
  17: ["Active_Option", "Option"],
  18: ["LSBorder", "Active_LS"],
  19: ["RSBorder", "Active_RS"],
  20: ["PS"],
  21: ["Touchpad"],
  22: ["Active_Mute", "Mute"],
  23: ["Active_LFn", "LFnPattern"],
  24: ["Active_RFn", "RFnPattern"],
  25: ["Active_LBack", "LBack"],
  26: ["Active_RBack", "RBack"],
};

export function DualSenseArtwork({
  model,
  selectedSource,
  highlightedSource,
  targetSource,
}: DualSenseArtworkProps) {
  const markup = useMemo(() => {
    const partClasses = new Map<string, Set<string>>();
    const sourcePartIds =
      model === "dualsense-edge" ? DUALSENSE_EDGE_SOURCE_PART_IDS : DUALSENSE_SOURCE_PART_IDS;
    const artwork = model === "dualsense-edge" ? dualSenseEdgeSvg : dualSenseSvg;

    addSourceClass(partClasses, sourcePartIds, selectedSource, "controller-part-selected");
    if (highlightedSource !== null) {
      addSourceClass(partClasses, sourcePartIds, highlightedSource, "controller-part-highlighted");
    }
    if (targetSource !== null) {
      addSourceClass(partClasses, sourcePartIds, targetSource, "controller-part-target");
    }

    return Array.from(partClasses.entries()).reduce(
      (svg, [id, classes]) =>
        svg.replace(`id="${id}"`, `id="${id}" class="${Array.from(classes).join(" ")}"`),
      artwork,
    );
  }, [highlightedSource, model, selectedSource, targetSource]);

  return (
    <div
      className={`controller-artwork${model === "dualsense-edge" ? " dualsense-edge-artwork" : ""}`}
      aria-hidden="true"
      // The markup is a bundled, immutable SVG asset rather than user-provided HTML.
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

function addSourceClass(
  partClasses: Map<string, Set<string>>,
  sourcePartIds: Readonly<Record<number, readonly string[]>>,
  source: number,
  className: string,
) {
  sourcePartIds[source]?.forEach((id) => {
    const classes = partClasses.get(id) ?? new Set<string>();
    classes.add("controller-part-active");
    classes.add(className);
    partClasses.set(id, classes);
  });
}
