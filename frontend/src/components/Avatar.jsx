import React from "react";
import streetFaces from "../assets/avatars/street-faces.webp";

const MAP = {
  boss: "0% 0%",
  dealer: "100% 0%",
  driver: "0% 50%",
  smuggler: "100% 50%",
  hacker: "0% 100%",
  lawyer: "100% 100%",
};

export function Avatar({ avatar, size = 40, active = false, className = "" }) {
  const color = avatar?.color || "#94A3B8";
  return (
    <div
      role="img"
      aria-label={`${avatar?.label || "Street"}-Porträt`}
      data-avatar-key={avatar?.key || "boss"}
      className={`street-avatar shrink-0 overflow-hidden transition-all ${active ? "scale-110" : ""} ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: "#171a21",
        border: `1.5px solid ${color}aa`,
        boxShadow: active ? `0 0 0 2px ${color}, 2px 3px 0 #0005` : `2px 2px 0 #0004`,
        borderRadius: "42% 48% 40% 46%",
      }}
    >
      <span aria-hidden="true" style={{ display: "block", width: "100%", height: "100%", backgroundImage: `url(${streetFaces})`, backgroundSize: "200% 300%", backgroundPosition: MAP[avatar?.key] || MAP.boss, borderRadius: "inherit" }} />
    </div>
  );
}
