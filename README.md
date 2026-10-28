# DS5Dongle-Config-Web

## 致谢

- [daidr/dualsense-tester](https://github.com/daidr/dualsense-tester)

All code were written by GPT-5.5 xhigh

Web Config for DS5Dongle v0.8.0


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
