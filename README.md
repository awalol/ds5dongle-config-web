# DS5Dongle-Config-Web

## 致谢

- [daidr/dualsense-tester](https://github.com/daidr/dualsense-tester)

All code were written by GPT-5.5 xhigh

Web Config for DS5Dongle v0.8.1


## Development

```sh
bun install --frozen-lockfile
bun run dev
bun test
bun run build
```

## Keyboard hold mappings

The shortcut editor supports **Hold to press** and **Hold chord to press**.
These modes follow physical button state instead of emitting a timed pulse.
They support keyboard keys/modifiers only, and controller capture preserves
hold mode when switching between one-button and two-button triggers.

Enable the keyboard interface (or wake) and reconnect USB first. Firmware must
include `ENABLE_WAKE_HID` and support `SHORTCUT_FLAG_HOLD` (`0x02` in report
`0xFB`). Older firmware disables hold slots; read-back verification reports
that mismatch. Existing tap/double-tap shortcuts and the 63-byte layout are
unchanged. Gamepad output remains active unless its source is disabled on the
remapping page.

Tests cover protocol round-trips, invalid combinations, gesture/capture
transitions and English/Chinese/French page rendering. Physical WebHID device
validation remains a separate hardware check.

## Keep modifiers held / 修饰键保持

Select **Hold chord to press** (中文：**组合键跟随**) in the shortcut editor,
then turn on **Keep modifiers held** (中文：**保持修饰键**).
Turning it off restores the standard two-button hold behavior.

1. Assign **A: Hold modifiers** and **B: Control the key**, e.g. L1 and R1.
2. Select at least one modifier and one regular key, e.g. Alt + Tab.
3. Save to the device. Holding both buttons in either order activates the mapping.
   Keep A held and tap B repeatedly; release A to finish.

Neither button alone triggers this mapping. B follows press/release state, including
holding the ordinary key down. The A and B selectors determine their roles.
For controller capture, press A first and then B before releasing
both. Capturing only one button keeps the original configuration.

This mode uses flag `0x04` in the existing 7-byte shortcut slot and requires updated
firmware. It cannot be combined with double-tap or other hold flags, media output,
or modifier-only/key-only output. Read-back verification detects unsupported firmware
before saving to Flash. Other explicitly configured hold mappings remain independent,
and the original gamepad output remains active.

Run `bun test` for protocol, capture, read-back verification and four-language
(English, Chinese, French and Russian) rendering checks. Use `bun run dev` for
interactive debugging and `bun run build` for the production build.
