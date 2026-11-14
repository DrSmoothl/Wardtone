import { createRoot } from "react-dom/client";
import { Application } from "./Application";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/ibm-plex-mono/latin-600.css";
import "./tokens.css";
import "./style.css";
import "./themes/fonts.css";
import "./themes/chrome.css";
import "./themes/profiles/arcade.css";
import "./themes/profiles/tactical.css";
import "./themes/profiles/industrial.css";

const container = document.getElementById("root");
if (!container) throw new Error("界面启动失败：缺少 root 容器");
createRoot(container).render(<Application />);
