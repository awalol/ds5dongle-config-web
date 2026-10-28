import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { ShortcutsPage } from "../src/components/shortcuts/ShortcutsPage";
import { resources } from "../src/i18n/locales";
import { createDefaultShortcutSlots } from "../src/protocol/buttons";
import type { UseDs5BridgeResult } from "../src/hooks/useDs5Bridge";

for (const language of ["en", "zh", "fr"]) {
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
}
