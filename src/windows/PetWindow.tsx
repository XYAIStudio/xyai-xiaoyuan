import { useEffect, useRef, useState } from "react";

import {
  isPetPoseId,
  PET_POSE_LIST,
  poseForLifecycle,
  type PetLifecycle,
  type PetPoseId,
} from "../lib/mascots";
import { tauriApi } from "../lib/tauriApi";
import { startCurrentWindowDrag } from "../lib/tauriWindowApi";

export default function PetWindow() {
  const [poseId, setPoseId] = useState<PetPoseId>("wave");
  const [menuOpen, setMenuOpen] = useState(false);
  const idleRef = useRef<PetPoseId>("wave");
  const autoRef = useRef(true);
  const moved = useRef(false);

  useEffect(() => {
    let disposed = false;
    const unlisteners: Array<() => void> = [];
    void tauriApi.loadConfig().then((cfg) => {
      if (disposed) return;
      idleRef.current = cfg.mascotId;
      autoRef.current = cfg.autoExpression;
      setPoseId(cfg.mascotId);
    });
    void tauriApi.listenMascotChanged((id) => {
      idleRef.current = id;
      setPoseId(id);
    }).then((fn) => unlisteners.push(fn));
    void tauriApi.listenPetLifecycle((life) => {
      const next = poseForLifecycle(life as PetLifecycle, {
        idlePose: idleRef.current,
        hour: new Date().getHours(),
        autoExpression: autoRef.current,
      });
      setPoseId(isPetPoseId(next) ? next : "wave");
    }).then((fn) => unlisteners.push(fn));
    return () => {
      disposed = true;
      unlisteners.forEach((fn) => fn());
    };
  }, []);

  const pose = PET_POSE_LIST.find((item) => item.id === poseId) ?? PET_POSE_LIST[0];

  return (
    <div
      className="pet-root"
      onContextMenu={(event) => {
        event.preventDefault();
        setMenuOpen(true);
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        moved.current = false;
      }}
      onPointerMove={(event) => {
        if (event.buttons !== 1) return;
        moved.current = true;
        void startCurrentWindowDrag();
      }}
      onClick={() => {
        if (moved.current) return;
        setMenuOpen(false);
        void tauriApi.showChatNearPet();
      }}
    >
      <img className="pet-sprite" src={pose.src} alt={pose.labelZh} draggable={false} />
      {menuOpen ? (
        <div className="pet-menu" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              void tauriApi.showChatNearPet();
            }}
          >
            打开对话
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              void tauriApi.showSettings();
            }}
          >
            设置…
          </button>
          <div className="pet-menu-poses">
            {PET_POSE_LIST.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === poseId ? "is-active" : ""}
                title={item.labelZh}
                onClick={() => {
                  setPoseId(item.id);
                  idleRef.current = item.id;
                  void tauriApi.patchConfig({ mascotId: item.id });
                  void tauriApi.emitMascotChanged(item.id);
                }}
              >
                <img src={item.src} alt={item.labelZh} />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              void tauriApi.quitApp();
            }}
          >
            退出
          </button>
        </div>
      ) : null}
    </div>
  );
}
