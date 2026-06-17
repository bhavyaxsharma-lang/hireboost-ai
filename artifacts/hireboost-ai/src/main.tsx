import { createRoot } from "react-dom/client";
import {
  setBaseUrl,
  setAuthTokenGetter,
} from "@workspace/api-client-react";

import App from "./App";
import "./index.css";

setBaseUrl("https://workspaceapi-server-production-7836.up.railway.app");

setAuthTokenGetter(() => {
  return localStorage.getItem("authToken");
});

createRoot(document.getElementById("root")!).render(<App />);