import { createRoot } from "react-dom/client";
import {
  setBaseUrl,
  setAuthTokenGetter,
} from "@workspace/api-client-react";
import { getLocalStorageItem } from "@/lib/storage";

import App from "./App";
import "./index.css";

const apiBase =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") ||
  import.meta.env.BASE_URL?.replace(/\/+$/, "") ||
  "";

setBaseUrl(apiBase);
setAuthTokenGetter(() => getLocalStorageItem("authToken"));

if (typeof window !== "undefined") {
  const setVh = () => {
    document.documentElement.style.setProperty(
      "--vh",
      `${window.innerHeight * 0.01}px`
    );
  };
  setVh();
  window.addEventListener("resize", setVh);
}

createRoot(document.getElementById("root")!).render(<App />);