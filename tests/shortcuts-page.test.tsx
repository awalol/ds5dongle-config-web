import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { ShortcutsPage } from "../src/components/shortcuts/ShortcutsPage";
import { resources } from "../src/i18n/locales";
import { createDefaultShortcutSlots } from "../src/protocol/buttons";
import type { UseDs5BridgeResult } from "../src/hooks/useDs5Bridge";

for (const language of ["en", "zh", "fr", "ru"]) {
  test(`${language}: displays hold mode, help and restricts output actions`, async () => {
    const i18n = createInstance();
    await i18n.init({ resources, lng: language, fallbackLng: "en" });
    const shortcuts = createDefaultShortcutSlots();
    shortcuts[0] = { triggerA: 9, triggerB: 253, action: 0, payload: [1, 6, 0], flags: 2 };
    const bridge = {
      shortcuts, operation: null, draft: { enableKeyboard: true, enableWake: false },
      isConnected: true, areShortcutsDirty: true, client: {},
    } as UseDs5BridgeResult;
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={i18n}><ShortcutsPage bridge={bridge} /></I18nextProvider>,
    );
    expect(html).toContain(i18n.t("shortcuts.gestures.hold"));
    expect(html).toContain(i18n.t("shortcuts.gestures.holdChord"));
    expect(html).toContain(i18n.t("shortcuts.gestureHints.hold"));
    expect(html).toContain(i18n.t("shortcuts.usageHelp"));
    expect(html).toContain('<details class="shortcut-help-details">');
    expect(html).not.toMatch(/<details[^>]*\bopen/);
    const hintId = html.match(/<p id="([^"]+)" class="shortcut-gesture-hint"/)?.[1];
    expect(hintId).toBeDefined();
    expect(html).toContain(`aria-describedby="${hintId}"`);
    // The two non-keyboard action buttons are disabled while holding.
    const disabledActions = html.match(/<button[^>]*disabled=""[^>]*aria-pressed="false"/g) ?? [];
    expect(disabledActions.length).toBe(2);
  });

  for (const payload of [[4, 43, 0], [0, 43, 0], [4, 0, 0], [0, 0, 0]]) {
    test(`${language}: modifier hold labels and validation ${payload}`, async () => {
      const i18n = createInstance();
      await i18n.init({ resources, lng: language, fallbackLng: false });
      const shortcuts = createDefaultShortcutSlots();
      shortcuts[0] = { triggerA: 12, triggerB: 13, action: 0, payload, flags: 4 };
      const bridge = {
        shortcuts, operation: null, draft: { enableKeyboard: true, enableWake: false },
        isConnected: true, areShortcutsDirty: true, client: {},
      } as UseDs5BridgeResult;
      const html = renderToStaticMarkup(
        <I18nextProvider i18n={i18n}><ShortcutsPage bridge={bridge} /></I18nextProvider>,
      );
      for (const key of ["modifierHoldTriggerA", "modifierHoldTriggerB",
        "modifierHoldListenHint", "modifierHoldToggle", "gestureHints.modifierHold"]) {
        expect(html).toContain(i18n.t(`shortcuts.${key}`));
        expect(html).not.toContain(`shortcuts.${key}`);
      }
      expect(html).toMatch(/role="switch"[^>]*aria-checked="true"/);
      const togglePosition = html.indexOf('class="shortcut-modifier-hold"');
      expect(togglePosition).toBeGreaterThan(html.indexOf('class="shortcut-listen"'));
      expect(togglePosition).toBeLessThan(html.indexOf('class="shortcut-field-grid"'));
      expect(html).not.toContain("lucide-arrow-left-right");
      expect(html).toMatch(new RegExp(`aria-pressed="true"[^>]*>${i18n.t("shortcuts.gestures.holdChord")}<`));
      const missing = !payload[0] || !payload[1];
      const validation = !payload[0] && !payload[1] ? "modifierHoldMissingBoth"
        : !payload[0] ? "modifierHoldMissingModifiers" : "modifierHoldMissingKey";
      if (missing) {
        expect(html).toContain(i18n.t(`shortcuts.${validation}`));
        expect(html).toContain('aria-invalid="true"');
        expect(html).toMatch(/<button[^>]*disabled=""[^>]*><svg[^>]*class="[^"]*lucide-save/);
      } else {
        expect(html).not.toContain('role="alert"');
        expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*><svg[^>]*class="[^"]*lucide-save/);
      }
      expect(html.match(/<button[^>]*disabled=""[^>]*aria-pressed="false"/g)?.length).toBe(2);
    });
  }

  test(`${language}: normal chord hold shows an unchecked modifier switch`, async () => {
    const i18n = createInstance();
    await i18n.init({ resources, lng: language, fallbackLng: false });
    const shortcuts = createDefaultShortcutSlots();
    shortcuts[0] = { triggerA: 12, triggerB: 13, action: 0, payload: [4, 43, 0], flags: 2 };
    const bridge = {
      shortcuts, operation: null, draft: { enableKeyboard: true, enableWake: false },
      isConnected: true, areShortcutsDirty: true, client: {},
    } as UseDs5BridgeResult;
    const html = renderToStaticMarkup(
      <I18nextProvider i18n={i18n}><ShortcutsPage bridge={bridge} /></I18nextProvider>,
    );
    expect(html).toMatch(/role="switch"[^>]*aria-checked="false"/);
    expect(html).toContain(i18n.t("shortcuts.modifierHoldToggle"));
    expect(html).toContain(i18n.t("shortcuts.gestureHints.holdChord"));
    expect(html).not.toContain(i18n.t("shortcuts.modifierHoldTriggerA"));
  });
}
