import Link from "next/link";
import { X } from "lucide-react";
import { LoginContent } from "@/app/(auth)/_components/LoginContent";

export default function LoginPage() {
  return (
    <div style={{ position: "relative", minHeight: "100dvh" }}>
      <Link
        href="/"
        style={{
          position: "absolute", top: 16, right: 16, zIndex: 10,
          width: 32, height: 32, borderRadius: "50%",
          background: "rgba(255,255,255,0.07)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "rgba(255,255,255,0.45)",
        }}
      >
        <X size={15} />
      </Link>
      <LoginContent />
    </div>
  );
}
