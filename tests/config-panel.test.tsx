import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";
import { ConfigPanel } from "../src/components/ConfigPanel";
import { resources } from "../src/i18n/locales";
import type { UseDs5BridgeResult } from "../src/hooks/useDs5Bridge";
import { DEFAULT_CONFIG, type ConfigBody } from "../src/protocol/config";

async function renderConfigPanel(language: string, overrides: Partial<ConfigBody> = {}) {
  const i18n = createInstance();
  await i18n.init({ resources, lng: language, fallbackLng: "en" });
  const bridge = {
    draft: { ...DEFAULT_CONFIG, ...overrides },
    issues: [],
    isConnected: true,
    setDraftField: () => undefined,
  } as unknown as UseDs5BridgeResult;

  const html = renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <ConfigPanel bridge={bridge} />
    </I18nextProvider>,
  );

  return { html, t: i18n.t.bind(i18n) };
}

for (const language of ["en", "zh"]) {
  test(`${language}: warns below 32 frames and offers single packet mode`, async () => {
    const { html, t } = await renderConfigPanel(language, { audioBufferLength: 31, packetMode: 0 });

    expect(html).toContain("config-inline-hint");
    expect(html).toContain(t("config.singlePacketHint"));
    expect(html).toContain(t("config.enableSinglePacket"));
  });
}

test("hides the hint at 32 frames and when single packet mode is already on", async () => {
  const atThreshold = await renderConfigPanel("en", { audioBufferLength: 32, packetMode: 0 });
  const alreadySingle = await renderConfigPanel("en", { audioBufferLength: 16, packetMode: 1 });

  expect(atThreshold.html).not.toContain("config-inline-hint");
  expect(alreadySingle.html).not.toContain("config-inline-hint");
});

test("offers 250, 500, 1000 Hz and real-time polling modes", async () => {
  const { html } = await renderConfigPanel("en");

  for (const label of ["250 Hz", "500 Hz", "1000 Hz", "Real-time"]) {
    expect(html).toContain(label);
  }
});

test("renders the new dock and packet toggles", async () => {
  const { html, t } = await renderConfigPanel("en", { packetMode: 1, disconnectOnDock: true });

  expect(html).toContain(t("config.packetMode"));
  expect(html).toContain(t("config.disconnectOnDock"));
});
