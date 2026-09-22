import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Login — SGA Tata CRM",
};

export default function LoginPage() {
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo-wrap">
          <div className="login-logo-icon" style={{ background: "transparent", boxShadow: "none" }}>
            <img src="/logo.jpg" alt="Tata Logo" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "16px" }} />
          </div>
          <h1>SGA Tata CRM</h1>
          <p className="subtitle">Sign in to manage your leads</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
