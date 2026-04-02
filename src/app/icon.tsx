import { ImageResponse } from "next/og";

export const contentType = "image/png";

export const size = {
  width: 512,
  height: 512,
};

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #173b34 0%, #264b43 52%, #146c63 100%)",
          color: "#fffaf3",
          fontSize: 108,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 28,
            borderRadius: 72,
            border: "6px solid rgba(255, 250, 243, 0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          CF
        </div>
      </div>
    ),
    size,
  );
}
