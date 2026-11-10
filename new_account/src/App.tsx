import { BrowserRouter } from "react-router";
import { APP_ROUTER_BASENAME } from "./config/appConfig";
import AppRoutes from "./Routes.tsx";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { getDesignTokens } from "./theme.ts";
import { SnackbarProvider } from "notistack";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import { enGB } from "date-fns/locale";
import { QueryClientProvider } from "@tanstack/react-query";
import { OrganizationHeadSetter } from "../src/utils/index.html";
import queryClient from "./state/queryClient.ts";
import { AuthProvider } from "./context/AuthContext";
import { MessageDialogProvider } from "./context/MessageDialogContext";
import NotificationBridge from "./components/NotificationBridge";
import { snackbarComponents } from "./components/AppSnackbarContent";
import { ThemeContextProvider, useThemeContext } from "./context/ThemeContext";
import React, { useEffect } from "react";
import { checkForUpdate } from "./offline/updater";
import { syncUserDirectory } from "./offline/userSync";
import { syncPendingStockDamages, syncPendingCreditPayments } from "./offline/sync";

const InnerApp = () => {
  const { mode } = useThemeContext();
  const theme = getDesignTokens(mode);

  useEffect(() => {
    document.body.setAttribute('data-theme', mode);
  }, [mode]);

  // Desktop app only, and a no-op until an update manifest is actually
  // hosted at the endpoint in tauri.conf.json — see offline/updater.ts.
  useEffect(() => {
    checkForUpdate();
  }, []);

  // Desktop app only: keep the local user directory fresh whenever online —
  // on launch, and again the moment the connection comes back — same
  // pattern as the product/customer sync on the checkout page.
  useEffect(() => {
    syncUserDirectory();
    window.addEventListener("online", syncUserDirectory);
    return () => window.removeEventListener("online", syncUserDirectory);
  }, []);

  // Desktop app only: flush any stock damage entries recorded offline the
  // moment the connection comes back, regardless of which page is open —
  // the Stock page might not even be mounted when that happens.
  useEffect(() => {
    syncPendingStockDamages();
    window.addEventListener("online", syncPendingStockDamages);
    return () => window.removeEventListener("online", syncPendingStockDamages);
  }, []);

  // Same for old-bill payments taken at the till while offline — they are
  // matched to the customer's real bills at this point, not before.
  useEffect(() => {
    syncPendingCreditPayments();
    window.addEventListener("online", syncPendingCreditPayments);
    return () => window.removeEventListener("online", syncPendingCreditPayments);
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter basename={APP_ROUTER_BASENAME}>
        <AuthProvider>
          <MessageDialogProvider>
            <SnackbarProvider
              maxSnack={5}
              autoHideDuration={4000}
              anchorOrigin={{ vertical: "top", horizontal: "right" }}
              preventDuplicate
              Components={snackbarComponents}
              style={{ zIndex: 9999 }}
            >
              <NotificationBridge />
              <OrganizationHeadSetter />
              <AppRoutes />
            </SnackbarProvider>
          </MessageDialogProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enGB}>
        <ThemeContextProvider>
          <InnerApp />
        </ThemeContextProvider>
      </LocalizationProvider>
    </QueryClientProvider>
  );
}

export default App;
