import { ImageResponse } from "next/og";

export const contentType = "image/png";

export const size = {
  width: 180,
  height: 180,
};

export default function AppleIcon() {
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
          fontSize: 54,
          fontWeight: 800,
          borderRadius: 42,
        }}
      >
        CF
      </div>
    ),
    size,
  );
}
