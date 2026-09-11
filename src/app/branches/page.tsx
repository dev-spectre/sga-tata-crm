"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import BranchModal from "./BranchModal";

export interface Branch {
  id: number;
  name: string;
  code: string;
  address: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  radiusKm: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [deactivateBranch, setDeactivateBranch] = useState<Branch | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Fetch current user and verify admin privileges
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          const isAdmin =
            data.user.role === "ADMIN" ||
            data.user.role === "SUPERADMIN" ||
            Boolean(data.user.isSuperAdmin);
          if (!isAdmin) {
            setAccessDenied(true);
          }
        } else {
          setAccessDenied(true);
        }
      })
      .catch(() => setAccessDenied(true));
  }, []);

  // Fetch branches on mount
  useEffect(() => {
    let ignore = false;
    fetch("/api/branches?includeInactive=true")
      .then((res) => res.json())
      .then((data) => {
        if (!ignore) {
          if (Array.isArray(data.branches)) {
            setBranches(data.branches);
          } else if (data.error) {
            showToast(data.error, "error");
          }
          setLoading(false);
        }
      })
      .catch(() => {
        if (!ignore) {
          showToast("Network error fetching branches", "error");
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [showToast]);

  // Metric counts
  const totalCount = branches.length;
  const activeCount = useMemo(() => branches.filter((b) => b.isActive).length, [branches]);
  const inactiveCount = totalCount - activeCount;
  const coordinatedCount = useMemo(
    () => branches.filter((b) => b.latitude !== null && b.longitude !== null).length,
    [branches]
  );

  // Filter branches
  const filteredBranches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return branches.filter((b) => {
      // Status filter
      if (statusFilter === "active" && !b.isActive) return false;
      if (statusFilter === "inactive" && b.isActive) return false;

      // Text search
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        b.code.toLowerCase().includes(q) ||
        b.city.toLowerCase().includes(q) ||
        (b.address && b.address.toLowerCase().includes(q))
      );
    });
  }, [branches, search, statusFilter]);

  // Quick toggle active status
  const handleQuickToggleActive = async (branch: Branch) => {
    try {
      const nextActive = !branch.isActive;
      const res = await fetch(`/api/branches/${branch.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBranches((prev) =>
          prev.map((b) => (b.id === branch.id ? { ...b, isActive: nextActive } : b))
        );
        showToast(
          `Branch "${branch.name}" ${nextActive ? "activated" : "deactivated"} successfully`
        );
      } else {
        showToast(data.error || "Failed to update branch status", "error");
      }
    } catch {
      showToast("Error updating branch status", "error");
    }
  };

  // Confirm soft-delete deactivation
  const handleConfirmDeactivate = async () => {
    if (!deactivateBranch) return;
    setDeactivating(true);
    try {
      const res = await fetch(`/api/branches/${deactivateBranch.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBranches((prev) =>
          prev.map((b) => (b.id === deactivateBranch.id ? { ...b, isActive: false } : b))
        );
        showToast(`Branch "${deactivateBranch.name}" deactivated`);
        setDeactivateBranch(null);
      } else {
        showToast(data.error || "Failed to deactivate branch", "error");
      }
    } catch {
      showToast("Error deactivating branch", "error");
    } finally {
      setDeactivating(false);
    }
  };

  // Branch saved handler (Create or Edit)
  const handleBranchSaved = (savedBranch: Branch) => {
    setBranches((prev) => {
      const exists = prev.some((b) => b.id === savedBranch.id);
      if (exists) {
        return prev.map((b) => (b.id === savedBranch.id ? savedBranch : b));
      }
      return [savedBranch, ...prev];
    });
    showToast(`Branch "${savedBranch.name}" saved successfully`);
  };

  if (accessDenied) {
    return (
      <div className="settings-page" style={{ maxWidth: 800, margin: "60px auto", textAlign: "center" }}>
        <div
          className="glass-card"
          style={{
            padding: 40,
            borderRadius: "var(--radius)",
            background: "#ffffff",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow)",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "rgba(239, 68, 68, 0.1)",
              color: "var(--danger)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 28, height: 28 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: "var(--text-primary)" }}>
            Access Denied
          </h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: 24, fontSize: 14 }}>
            Administrator privileges are required to manage dealership branches and GPS coordinates.
          </p>
          <Link
            href="/dashboard"
            className="btn btn-primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 20px",
              background: "var(--primary)",
              color: "#ffffff",
              borderRadius: "var(--radius-sm)",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page" style={{ maxWidth: 1280, margin: "0 auto", paddingBottom: 60 }}>
      {/* Toast Notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 24,
            right: 24,
            zIndex: 9999,
            padding: "12px 20px",
            borderRadius: 8,
            color: "#ffffff",
            fontWeight: 600,
            fontSize: 14,
            boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            background: toast.type === "success" ? "#059669" : "#dc2626",
            display: "flex",
            alignItems: "center",
            gap: 10,
            animation: "fadeIn 0.2s ease-in-out",
          }}
        >
          {toast.type === "success" ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 18, height: 18 }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 18, height: 18 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
          {toast.message}
        </div>
      )}

      {/* Header Section */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "var(--radius-sm)",
                background: "rgba(0, 114, 188, 0.1)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18 }}>
                <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v2M12 14v2M16 14v2" />
              </svg>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Dealership Branches
            </h1>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Manage showroom & service center locations, coordinates, and catchment radii for automated nearest-branch routing.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditBranch(null);
            setCreateModalOpen(true);
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "var(--primary)",
            color: "#ffffff",
            border: "none",
            borderRadius: "var(--radius-sm)",
            padding: "10px 18px",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
            boxShadow: "0 4px 14px rgba(0, 114, 188, 0.3)",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 16, height: 16 }}>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Branch
        </button>
      </div>

      {/* Metric Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {/* Total Branches */}
        <div
          className="glass-card"
          style={{
            padding: "18px 20px",
            borderRadius: "var(--radius)",
            background: "#ffffff",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Total Branches
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text-primary)", marginTop: 6 }}>
            {totalCount}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
            Configured showroom nodes
          </div>
        </div>

        {/* Active Branches */}
        <div
          className="glass-card"
          style={{
            padding: "18px 20px",
            borderRadius: "var(--radius)",
            background: "#ffffff",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: "#059669", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Active Branches
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#059669", marginTop: 6 }}>
            {activeCount}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
            Eligible for lead auto-routing
          </div>
        </div>

        {/* Inactive Branches */}
        <div
          className="glass-card"
          style={{
            padding: "18px 20px",
            borderRadius: "var(--radius)",
            background: "#ffffff",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Inactive Branches
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text-muted)", marginTop: 6 }}>
            {inactiveCount}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
            Historical records preserved
          </div>
        </div>

        {/* GPS Coordinated */}
        <div
          className="glass-card"
          style={{
            padding: "18px 20px",
            borderRadius: "var(--radius)",
            background: "#ffffff",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--primary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            GPS Coordinated
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--primary)", marginTop: 6 }}>
            {coordinatedCount}
            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-muted)", marginLeft: 6 }}>
              / {totalCount}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
            {totalCount - coordinatedCount > 0 ? (
              <span style={{ color: "#d97706" }}>⚠️ {totalCount - coordinatedCount} branch needs GPS coords</span>
            ) : (
              "All branches mapped"
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        {/* Search Input */}
        <div style={{ position: "relative", flex: 1, minWidth: 280 }}>
          <input
            type="text"
            placeholder="Search branches by name, code, city, or address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px 10px 38px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "#ffffff",
              fontSize: 14,
              outline: "none",
            }}
          />
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="2"
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              width: 16,
              height: 16,
              pointerEvents: "none",
            }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>

        {/* Status Filter Tabs */}
        <div
          style={{
            display: "inline-flex",
            background: "rgba(148, 163, 184, 0.15)",
            padding: 3,
            borderRadius: "var(--radius-sm)",
            gap: 2,
          }}
        >
          {(["all", "active", "inactive"] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              style={{
                border: "none",
                padding: "6px 14px",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: statusFilter === filter ? 700 : 500,
                background: statusFilter === filter ? "#ffffff" : "transparent",
                color: statusFilter === filter ? "var(--primary)" : "var(--text-secondary)",
                boxShadow: statusFilter === filter ? "0 2px 6px rgba(0,0,0,0.06)" : "none",
                cursor: "pointer",
                textTransform: "capitalize",
                transition: "all 0.15s ease",
              }}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Branches Table */}
      <div
        className="glass-card"
        style={{
          background: "#ffffff",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow)",
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "rgba(0, 114, 188, 0.03)", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)", textTransform: "uppercase" }}>
                  Status
                </th>
                <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)", textTransform: "uppercase" }}>
                  Branch Details
                </th>
                <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)", textTransform: "uppercase" }}>
                  City & Address
                </th>
                <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)", textTransform: "uppercase" }}>
                  GPS Coordinates
                </th>
                <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)", textTransform: "uppercase" }}>
                  Radius
                </th>
                <th style={{ padding: "14px 18px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)", textTransform: "uppercase", textAlign: "right" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "48px 20px", color: "var(--text-muted)" }}>
                    <div style={{ display: "inline-block", width: 24, height: 24, border: "2px solid var(--primary)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginBottom: 8 }} />
                    <div>Loading dealership branches...</div>
                  </td>
                </tr>
              ) : filteredBranches.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "60px 20px" }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        background: "rgba(0, 114, 188, 0.08)",
                        color: "var(--primary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 12px",
                      }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 24, height: 24 }}>
                        <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11" />
                      </svg>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary)", marginBottom: 4 }}>
                      {search ? "No matching branches found" : "No branches configured yet"}
                    </div>
                    <p style={{ color: "var(--text-secondary)", fontSize: 13, maxWidth: 460, margin: "0 auto 16px" }}>
                      {search
                        ? "Try refining your search keyword or clearing the status filter."
                        : "Add your dealership branches and their physical GPS coordinates to enable intelligent nearest-branch lead auto-routing."}
                    </p>
                    {!search && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditBranch(null);
                          setCreateModalOpen(true);
                        }}
                        style={{
                          background: "var(--primary)",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "var(--radius-sm)",
                          padding: "8px 16px",
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: "pointer",
                        }}
                      >
                        + Add First Branch
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredBranches.map((branch) => {
                  const hasCoordinates = branch.latitude !== null && branch.longitude !== null;
                  return (
                    <tr
                      key={branch.id}
                      style={{
                        borderBottom: "1px solid rgba(148, 163, 184, 0.15)",
                        background: branch.isActive ? "#ffffff" : "rgba(241, 245, 249, 0.6)",
                        transition: "background 0.15s ease",
                      }}
                    >
                      {/* Status */}
                      <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "3px 9px",
                            borderRadius: 9999,
                            fontSize: 11,
                            fontWeight: 700,
                            background: branch.isActive ? "rgba(5, 150, 105, 0.1)" : "rgba(100, 116, 139, 0.12)",
                            color: branch.isActive ? "#059669" : "#64748b",
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: branch.isActive ? "#059669" : "#64748b",
                            }}
                          />
                          {branch.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* Branch Details */}
                      <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>
                            {branch.name}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              fontFamily: "monospace",
                              padding: "2px 7px",
                              borderRadius: 4,
                              background: "rgba(0, 114, 188, 0.1)",
                              color: "var(--primary)",
                              letterSpacing: "0.04em",
                            }}
                          >
                            {branch.code}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                          ID: #{branch.id}
                        </div>
                      </td>

                      {/* City & Address */}
                      <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>
                          {branch.city || "—"}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--text-secondary)",
                            marginTop: 2,
                            maxWidth: 320,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={branch.address}
                        >
                          {branch.address || "No address provided"}
                        </div>
                      </td>

                      {/* GPS Coordinates */}
                      <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                        {hasCoordinates ? (
                          <div>
                            <div style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                              {branch.latitude?.toFixed(5)}°, {branch.longitude?.toFixed(5)}°
                            </div>
                            <a
                              href={`https://www.google.com/maps?q=${branch.latitude},${branch.longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                fontSize: 11,
                                color: "var(--primary)",
                                textDecoration: "none",
                                fontWeight: 600,
                                marginTop: 3,
                              }}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 11, height: 11 }}>
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                              </svg>
                              View on Map
                            </a>
                          </div>
                        ) : (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "2px 8px",
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 600,
                              background: "rgba(217, 119, 6, 0.1)",
                              color: "#d97706",
                            }}
                          >
                            <span>⚠️</span> No GPS Coords
                          </span>
                        )}
                      </td>

                      {/* Radius */}
                      <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
                          {branch.radiusKm} km
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "16px 18px", verticalAlign: "middle", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {/* Quick Active Toggle */}
                          <button
                            type="button"
                            onClick={() => handleQuickToggleActive(branch)}
                            title={branch.isActive ? "Deactivate Branch" : "Activate Branch"}
                            style={{
                              padding: "6px 10px",
                              borderRadius: "var(--radius-sm)",
                              border: "1px solid var(--border)",
                              background: "#ffffff",
                              color: branch.isActive ? "#64748b" : "#059669",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            {branch.isActive ? "Pause" : "Activate"}
                          </button>

                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditBranch(branch);
                              setCreateModalOpen(true);
                            }}
                            style={{
                              padding: "6px 12px",
                              borderRadius: "var(--radius-sm)",
                              border: "1px solid var(--border)",
                              background: "#ffffff",
                              color: "var(--primary)",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Edit
                          </button>

                          {/* Deactivate Modal Trigger (for soft-delete) */}
                          {branch.isActive && (
                            <button
                              type="button"
                              onClick={() => setDeactivateBranch(branch)}
                              title="Deactivate branch with guidance"
                              style={{
                                padding: "6px 8px",
                                borderRadius: "var(--radius-sm)",
                                border: "1px solid rgba(239, 68, 68, 0.2)",
                                background: "rgba(239, 68, 68, 0.05)",
                                color: "var(--danger)",
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deactivation Confirmation Modal */}
      {deactivateBranch && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
            padding: 16,
          }}
        >
          <div
            className="glass-card"
            style={{
              background: "#ffffff",
              borderRadius: "var(--radius)",
              padding: 24,
              maxWidth: 480,
              width: "100%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              border: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "rgba(239, 68, 68, 0.1)",
                  color: "var(--danger)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 22, height: 22 }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
                  Deactivate Branch?
                </h3>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  {deactivateBranch.name} ({deactivateBranch.code})
                </div>
              </div>
            </div>

            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 16 }}>
              Deactivating this branch will exclude it from <strong>nearest-branch auto-routing</strong> and hide it from new consultant assignment pickers.
            </p>

            <div
              style={{
                background: "rgba(0, 114, 188, 0.05)",
                border: "1px solid rgba(0, 114, 188, 0.15)",
                borderRadius: "var(--radius-sm)",
                padding: "12px 14px",
                fontSize: 13,
                color: "var(--text-secondary)",
                marginBottom: 20,
              }}
            >
              ℹ️ <strong>Historical Protection:</strong> Existing leads and consultants previously linked to this branch will retain their association and will not lose data.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                disabled={deactivating}
                onClick={() => setDeactivateBranch(null)}
                style={{
                  padding: "9px 16px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  background: "#ffffff",
                  color: "var(--text-secondary)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deactivating}
                onClick={handleConfirmDeactivate}
                style={{
                  padding: "9px 18px",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  background: "var(--danger)",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {deactivating ? "Deactivating..." : "Confirm Deactivation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Branch Modal */}
      <BranchModal
        isOpen={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setEditBranch(null);
        }}
        onSaved={handleBranchSaved}
        initialData={editBranch}
      />
    </div>
  );
}
