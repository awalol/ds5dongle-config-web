import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { Gamepad2, Keyboard, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ActionsPanel } from "./components/ActionsPanel";
import { AppFooter } from "./components/AppFooter";
import { AppHeader } from "./components/AppHeader";
import { ConfigPanel } from "./components/ConfigPanel";
import { DeviceStrip } from "./components/DeviceStrip";
import { NoticeList } from "./components/NoticeList";
import { RemapPage } from "./components/remap/RemapPage";
import { ShortcutsPage } from "./components/shortcuts/ShortcutsPage";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { useDs5Bridge } from "./hooks/useDs5Bridge";
import { useTheme } from "./hooks/useTheme";

export default function App() {
  const { t } = useTranslation();
  const bridge = useDs5Bridge();
  const theme = useTheme();
  const isBusy = bridge.operation !== null;
  const [activePage, setActivePage] = useState<AppPage>(pageFromHash);

  useEffect(() => {
    if (!bridge.error) {
      return;
    }

    toast.error(bridge.error, { id: "bridge-error" });
    bridge.clearError();
  }, [bridge.error, bridge.clearError]);

  useEffect(() => {
    const handleNavigation = () => setActivePage(pageFromHash());
    window.addEventListener("hashchange", handleNavigation);
    window.addEventListener("popstate", handleNavigation);
    return () => {
      window.removeEventListener("hashchange", handleNavigation);
      window.removeEventListener("popstate", handleNavigation);
    };
  }, []);

  const handlePageChange = (page: string) => {
    const nextPage = isAppPage(page) ? page : "config";
    setActivePage(nextPage);
    if (window.location.hash !== `#${nextPage}`) {
      window.history.pushState(null, "", `#${nextPage}`);
    }
  };

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          className: "app-toast",
          duration: 4200,
          style: {
            background: "var(--card)",
            color: "var(--card-foreground)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "0 16px 42px rgba(16, 24, 40, 0.12)",
          },
          error: {
            iconTheme: {
              primary: "var(--destructive)",
              secondary: "var(--card)",
            },
          },
        }}
      />
      <main className="app-shell">
        <Tabs value={activePage} onValueChange={handlePageChange} className="app-layout">
          <AppHeader
            isConnected={bridge.isConnected}
            statusText={bridge.statusText}
            theme={theme.theme}
            onThemeChange={theme.setTheme}
          />
          <NoticeList supported={bridge.supported} />
          <DeviceStrip
            authorizedDevices={bridge.authorizedDevices}
            client={bridge.client}
            deviceLabel={bridge.deviceLabel}
            firmwareVersion={bridge.firmwareVersion}
            signalStrengthRssi={bridge.signalStrengthRssi}
            audioActivity={bridge.audioActivity}
            isBusy={isBusy}
            supported={bridge.supported}
            onConnect={bridge.connect}
            onConnectAuthorized={bridge.connectAuthorized}
          >
            <nav className="app-page-nav" aria-label="Configuration pages">
              <TabsList className="app-page-tabs">
                <TabsTrigger value="config">
                  <SlidersHorizontal aria-hidden="true" />
                  <span>{t("nav.config")}</span>
                </TabsTrigger>
                <TabsTrigger value="remap">
                  <Gamepad2 aria-hidden="true" />
                  <span>{t("nav.remap")}</span>
                </TabsTrigger>
                <TabsTrigger value="shortcuts">
                  <Keyboard aria-hidden="true" />
                  <span>{t("nav.shortcuts")}</span>
                </TabsTrigger>
              </TabsList>
            </nav>
          </DeviceStrip>

          <TabsContent value="config">
            <div className="content-grid">
              <ConfigPanel bridge={bridge} />
              <ActionsPanel bridge={bridge} isBusy={isBusy} />
            </div>
          </TabsContent>
          <TabsContent value="remap">
            <RemapPage bridge={bridge} />
          </TabsContent>
          <TabsContent value="shortcuts">
            <ShortcutsPage bridge={bridge} />
          </TabsContent>

          <AppFooter />
        </Tabs>
      </main>
    </>
  );
}

type AppPage = "config" | "remap" | "shortcuts";

function pageFromHash(): AppPage {
  const page = window.location.hash.replace(/^#/, "");
  return isAppPage(page) ? page : "config";
}

function isAppPage(page: string): page is AppPage {
  return page === "config" || page === "remap" || page === "shortcuts";
}
