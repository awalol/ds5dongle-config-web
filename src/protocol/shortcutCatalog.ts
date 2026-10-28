export interface ShortcutOption {
  value: number;
  label: string;
}

export const MODIFIER_OPTIONS: readonly ShortcutOption[] = [
  { value: 0x01, label: "Ctrl" },
  { value: 0x02, label: "Shift" },
  { value: 0x04, label: "Alt" },
  { value: 0x08, label: "Win / Cmd" },
  { value: 0x10, label: "Right Ctrl" },
  { value: 0x20, label: "Right Shift" },
  { value: 0x40, label: "Right Alt" },
  { value: 0x80, label: "Right Win / Cmd" },
];

export const KEY_OPTIONS: readonly ShortcutOption[] = [
  { value: 0, label: "—" },
  ...Array.from({ length: 26 }, (_, index) => ({
    value: 0x04 + index,
    label: String.fromCharCode(65 + index),
  })),
  ...Array.from({ length: 9 }, (_, index) => ({ value: 0x1e + index, label: String(index + 1) })),
  { value: 0x27, label: "0" },
  { value: 0x28, label: "Enter" },
  { value: 0x29, label: "Esc" },
  { value: 0x2a, label: "Backspace" },
  { value: 0x2b, label: "Tab" },
  { value: 0x2c, label: "Space" },
  { value: 0x2d, label: "-" },
  { value: 0x2e, label: "=" },
  { value: 0x2f, label: "[" },
  { value: 0x30, label: "]" },
  { value: 0x31, label: "\\" },
  { value: 0x33, label: ";" },
  { value: 0x34, label: "'" },
  { value: 0x35, label: "`" },
  { value: 0x36, label: "," },
  { value: 0x37, label: "." },
  { value: 0x38, label: "/" },
  { value: 0x39, label: "Caps Lock" },
  ...Array.from({ length: 12 }, (_, index) => ({ value: 0x3a + index, label: `F${index + 1}` })),
  { value: 0x46, label: "Print Screen" },
  { value: 0x47, label: "Scroll Lock" },
  { value: 0x48, label: "Pause" },
  { value: 0x49, label: "Insert" },
  { value: 0x4a, label: "Home" },
  { value: 0x4b, label: "Page Up" },
  { value: 0x4c, label: "Delete" },
  { value: 0x4d, label: "End" },
  { value: 0x4e, label: "Page Down" },
  { value: 0x4f, label: "Right" },
  { value: 0x50, label: "Left" },
  { value: 0x51, label: "Down" },
  { value: 0x52, label: "Up" },
  { value: 0x53, label: "Num Lock" },
  { value: 0x65, label: "Menu" },
  ...Array.from({ length: 12 }, (_, index) => ({ value: 0x68 + index, label: `F${index + 13}` })),
];

export const CONSUMER_OPTIONS: readonly ShortcutOption[] = [
  { value: 0x00e2, label: "Mute" },
  { value: 0x00e9, label: "Volume Up" },
  { value: 0x00ea, label: "Volume Down" },
  { value: 0x00cd, label: "Play / Pause" },
  { value: 0x00b5, label: "Next Track" },
  { value: 0x00b6, label: "Previous Track" },
  { value: 0x00b7, label: "Stop" },
  { value: 0x006f, label: "Brightness Up" },
  { value: 0x0070, label: "Brightness Down" },
];

export function keyLabel(usage: number): string {
  return KEY_OPTIONS.find((option) => option.value === usage)?.label ?? `0x${usage.toString(16).toUpperCase()}`;
}

export function consumerLabel(usage: number): string {
  return (
    CONSUMER_OPTIONS.find((option) => option.value === usage)?.label ??
    `Consumer 0x${usage.toString(16).toUpperCase()}`
  );
}
