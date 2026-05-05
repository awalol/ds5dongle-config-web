import { useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";
import { ActionsPanel } from "./components/ActionsPanel";
import { AppHeader } from "./components/AppHeader";
import { ConfigPanel } from "./components/ConfigPanel";
import { DeviceStrip } from "./components/DeviceStrip";
import { NoticeList } from "./components/NoticeList";
import { useDs5Bridge } from "./hooks/useDs5Bridge";
import { useTheme } from "./hooks/useTheme";

export default function App() {
  const bridge = useDs5Bridge();
  const theme = useTheme();
  const isBusy = bridge.operation !== null;
  const hasIssues = bridge.issues.length > 0;

  useEffect(() => {
    if (!bridge.error) {
      return;
    }

    toast.error(bridge.error, { id: "bridge-error" });
    bridge.clearError();
  }, [bridge.error, bridge.clearError]);

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
          isBusy={isBusy}
          supported={bridge.supported}
          onConnect={bridge.connect}
          onConnectAuthorized={bridge.connectAuthorized}
        />

        <div className="content-grid">
          <ConfigPanel bridge={bridge} />
          <ActionsPanel bridge={bridge} hasIssues={hasIssues} isBusy={isBusy} />
        </div>
      </main>
    </>
  );
}
