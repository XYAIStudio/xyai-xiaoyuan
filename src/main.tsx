import React from "react";
import ReactDOM from "react-dom/client";

import "./styles/base.css";
import "./styles/pet.css";
import "./styles/chat.css";
import "./styles/settings.css";
import { installBrowserActivityListeners } from "./lib/activity";
import { getWindowLabel } from "./lib/tauriWindowApi";
import ChatWindow from "./windows/ChatWindow";
import PetWindow from "./windows/PetWindow";
import SettingsWindow from "./windows/SettingsWindow";

const label = getWindowLabel();
document.documentElement.dataset.windowLabel = label;
installBrowserActivityListeners();

if (label === "pet") {
  const root = document.documentElement;
  root.style.background = "transparent";
  root.style.backgroundColor = "transparent";
  root.style.colorScheme = "normal";
  document.body.style.background = "transparent";
  document.body.style.backgroundColor = "transparent";
}

const tree =
  label === "chat" ? (
    <ChatWindow />
  ) : label === "settings" ? (
    <SettingsWindow />
  ) : (
    <PetWindow />
  );

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{tree}</React.StrictMode>,
);
