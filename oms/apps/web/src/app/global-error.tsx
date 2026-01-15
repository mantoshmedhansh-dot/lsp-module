"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error
    console.error("Global error:", error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          padding: "20px",
          fontFamily: "system-ui, -apple-system, sans-serif"
        }}>
          <div style={{ textAlign: "center", maxWidth: "400px" }}>
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
              style={{ margin: "0 auto 16px" }}
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "8px" }}>
              Application Error
            </h2>
            <p style={{ color: "#666", marginBottom: "16px" }}>
              {error.message || "Something went wrong"}
            </p>
            {error.digest && (
              <p style={{ fontSize: "12px", color: "#999", marginBottom: "16px" }}>
                Error ID: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{
                backgroundColor: "#3b82f6",
                color: "white",
                border: "none",
                padding: "10px 20px",
                borderRadius: "6px",
                cursor: "pointer",
                marginRight: "8px"
              }}
            >
              Try again
            </button>
            <button
              onClick={() => window.location.href = "/login"}
              style={{
                backgroundColor: "transparent",
                color: "#3b82f6",
                border: "1px solid #3b82f6",
                padding: "10px 20px",
                borderRadius: "6px",
                cursor: "pointer"
              }}
            >
              Go to Login
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
