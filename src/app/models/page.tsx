"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";

export interface CarModelItem {
  id: number;
  name: string;
  code: string;
  isActive: boolean;
  leadsCount?: number;
  createdAt: string;
  updatedAt: string;
}

export default function ModelsPage() {
  const [models, setModels] = useState<CarModelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<CarModelItem | null>(null);
  const [modelNameInput, setModelNameInput] = useState("");
  const [modelCodeInput, setModelCodeInput] = useState("");
  const [modelActiveInput, setModelActiveInput] = useState(true);
  const [savingModel, setSavingModel] = useState(false);

  // Delete modal state
  const [deleteModalModel, setDeleteModalModel] = useState<CarModelItem | null>(null);
  const [deletingModel, setDeletingModel] = useState(false);

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

  // Fetch car models
  const fetchModels = useCallback(() => {
    fetch("/api/models?includeInactive=true")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.models)) {
          setModels(data.models);
        } else if (data.error) {
          showToast(data.error, "error");
        }
        setLoading(false);
      })
      .catch(() => {
        showToast("Network error fetching car models", "error");
        setLoading(false);
      });
  }, [showToast]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // Metric counts
  const totalCount = models.length;
  const activeCount = useMemo(() => models.filter((m) => m.isActive).length, [models]);
  const inactiveCount = totalCount - activeCount;
  const totalTaggedLeads = useMemo(
    () => models.reduce((acc, m) => acc + (m.leadsCount || 0), 0),
    [models]
  );

  // Filter models
  const filteredModels = useMemo(() => {
    const q = search.trim().toLowerCase();
    return models.filter((m) => {
      if (statusFilter === "active" && !m.isActive) return false;
      if (statusFilter === "inactive" && m.isActive) return false;

      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        (m.code && m.code.toLowerCase().includes(q))
      );
    });
  }, [models, search, statusFilter]);

  // Quick toggle active status
  const handleQuickToggleActive = async (model: CarModelItem) => {
    try {
      const nextActive = !model.isActive;
      const res = await fetch(`/api/models/${model.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setModels((prev) =>
          prev.map((m) => (m.id === model.id ? { ...m, isActive: nextActive } : m))
        );
        showToast(
          `Model "${model.name}" ${nextActive ? "activated" : "deactivated"} successfully`
        );
      } else {
        showToast(data.error || "Failed to update model status", "error");
      }
    } catch {
      showToast("Error updating model status", "error");
    }
  };

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingModel(null);
    setModelNameInput("");
    setModelCodeInput("");
    setModelActiveInput(true);
    setModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (model: CarModelItem) => {
    setEditingModel(model);
    setModelNameInput(model.name);
    setModelCodeInput(model.code || "");
    setModelActiveInput(model.isActive);
    setModalOpen(true);
  };

  // Save (Create or Update)
  const handleSaveModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelNameInput.trim()) {
      showToast("Model name is required", "error");
      return;
    }

    setSavingModel(true);
    try {
      const url = editingModel ? `/api/models/${editingModel.id}` : "/api/models";
      const method = editingModel ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: modelNameInput.trim(),
          code: modelCodeInput.trim().toUpperCase(),
          isActive: modelActiveInput,
        }),
      });

      const data = await res.json();
      if (res.ok && data.model) {
        if (editingModel) {
          setModels((prev) =>
            prev.map((m) =>
              m.id === editingModel.id
                ? { ...data.model, leadsCount: m.leadsCount }
                : m
            )
          );
          showToast(`Car model "${data.model.name}" updated successfully`);
        } else {
          setModels((prev) => [...prev, { ...data.model, leadsCount: 0 }].sort((a, b) => a.name.localeCompare(b.name)));
          showToast(`Car model "${data.model.name}" created successfully`);
        }
        setModalOpen(false);
      } else {
        showToast(data.error || "Failed to save car model", "error");
      }
    } catch {
      showToast("Network error saving car model", "error");
    } finally {
      setSavingModel(false);
    }
  };

  // Confirm delete model
  const handleConfirmDelete = async () => {
    if (!deleteModalModel) return;
    setDeletingModel(true);
    try {
      const res = await fetch(`/api/models/${deleteModalModel.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setModels((prev) => prev.filter((m) => m.id !== deleteModalModel.id));
        showToast(`Car model "${deleteModalModel.name}" deleted successfully`);
        setDeleteModalModel(null);
      } else {
        showToast(data.error || "Failed to delete car model", "error");
      }
    } catch {
      showToast("Error deleting car model", "error");
    } finally {
      setDeletingModel(false);
    }
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
            Administrator privileges are required to manage vehicle car models.
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
                <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 10.8 2 11 2 11.2V16c0 .6.4 1 1 1h2" />
                <circle cx="7" cy="17" r="2" />
                <path d="M9 17h6" />
                <circle cx="17" cy="17" r="2" />
              </svg>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
              Car Models
            </h1>
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Manage Tata vehicle models for lead tracking, assignments, and reporting across all dealership branches.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleOpenCreate}
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
              boxShadow: "0 2px 8px rgba(0, 114, 188, 0.25)",
              transition: "all 0.15s ease",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 16, height: 16 }}>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Car Model
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div
          className="glass-card"
          style={{
            padding: "16px 20px",
            borderRadius: "var(--radius)",
            background: "#ffffff",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "var(--radius-sm)",
              background: "rgba(0, 114, 188, 0.08)",
              color: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 22, height: 22 }}>
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 10.8 2 11 2 11.2V16c0 .6.4 1 1 1h2" />
              <circle cx="7" cy="17" r="2" />
              <path d="M9 17h6" />
              <circle cx="17" cy="17" r="2" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Total Models
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1.2 }}>
              {totalCount}
            </div>
          </div>
        </div>

        <div
          className="glass-card"
          style={{
            padding: "16px 20px",
            borderRadius: "var(--radius)",
            background: "#ffffff",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "var(--radius-sm)",
              background: "rgba(16, 185, 129, 0.08)",
              color: "var(--success)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 22, height: 22 }}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Active Models
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--success)", lineHeight: 1.2 }}>
              {activeCount}
            </div>
          </div>
        </div>

        <div
          className="glass-card"
          style={{
            padding: "16px 20px",
            borderRadius: "var(--radius)",
            background: "#ffffff",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "var(--radius-sm)",
              background: "rgba(100, 116, 139, 0.08)",
              color: "#64748b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 22, height: 22 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Inactive Models
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#64748b", lineHeight: 1.2 }}>
              {inactiveCount}
            </div>
          </div>
        </div>

        <div
          className="glass-card"
          style={{
            padding: "16px 20px",
            borderRadius: "var(--radius)",
            background: "#ffffff",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "var(--radius-sm)",
              background: "rgba(139, 92, 246, 0.08)",
              color: "#8b5cf6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 22, height: 22 }}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Tagged Leads
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#8b5cf6", lineHeight: 1.2 }}>
              {totalTaggedLeads}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="glass-card"
        style={{
          padding: "16px 20px",
          borderRadius: "var(--radius)",
          background: "#ffffff",
          border: "1px solid var(--border)",
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 260, maxWidth: 420 }}>
          <div style={{ position: "relative", width: "100%" }}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{
                width: 16,
                height: 16,
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
              }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by model name or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 36px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                fontSize: 14,
                outline: "none",
                background: "#fafbfc",
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {(["all", "active", "inactive"] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setStatusFilter(filter)}
              style={{
                padding: "6px 14px",
                borderRadius: "var(--radius-sm)",
                fontSize: 13,
                fontWeight: 600,
                textTransform: "capitalize",
                border: statusFilter === filter ? "1px solid var(--primary)" : "1px solid var(--border)",
                background: statusFilter === filter ? "var(--primary)" : "#ffffff",
                color: statusFilter === filter ? "#ffffff" : "var(--text-secondary)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {filter === "all" ? "All Models" : filter}
            </button>
          ))}
        </div>
      </div>

      {/* Models Table */}
      <div
        className="glass-card"
        style={{
          borderRadius: "var(--radius)",
          background: "#ffffff",
          border: "1px solid var(--border)",
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <div className="table-container" style={{ margin: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid var(--border)" }}>
                <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 700, fontSize: 13, color: "var(--text-secondary)" }}>
                  Model Name
                </th>
                <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 700, fontSize: 13, color: "var(--text-secondary)" }}>
                  Code
                </th>
                <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: 700, fontSize: 13, color: "var(--text-secondary)" }}>
                  Status
                </th>
                <th style={{ textAlign: "center", padding: "12px 16px", fontWeight: 700, fontSize: 13, color: "var(--text-secondary)" }}>
                  Tagged Leads
                </th>
                <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 700, fontSize: 13, color: "var(--text-secondary)" }}>
                  Created Date
                </th>
                <th style={{ textAlign: "right", padding: "12px 16px", fontWeight: 700, fontSize: 13, color: "var(--text-secondary)" }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                    Loading car models...
                  </td>
                </tr>
              ) : filteredModels.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                    {search ? `No car models found matching "${search}"` : "No car models configured yet."}
                  </td>
                </tr>
              ) : (
                filteredModels.map((m) => (
                  <tr
                    key={m.id}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      transition: "background 0.15s ease",
                    }}
                  >
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: "6px",
                            background: m.isActive ? "rgba(0, 114, 188, 0.08)" : "rgba(100, 116, 139, 0.08)",
                            color: m.isActive ? "var(--primary)" : "#94a3b8",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 14,
                          }}
                        >
                          🚗
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 14 }}>
                            {m.name}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Tata Motors</div>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: "12px 16px" }}>
                      {m.code ? (
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontWeight: 700,
                            fontSize: 12,
                            padding: "2px 8px",
                            borderRadius: 4,
                            background: "rgba(0, 114, 188, 0.08)",
                            color: "var(--primary)",
                          }}
                        >
                          {m.code}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: 13 }}>—</span>
                      )}
                    </td>

                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => handleQuickToggleActive(m)}
                        title={`Click to ${m.isActive ? "deactivate" : "activate"}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "3px 10px",
                          borderRadius: "12px",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                          border: m.isActive ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(100, 116, 139, 0.3)",
                          background: m.isActive ? "rgba(16, 185, 129, 0.1)" : "rgba(100, 116, 139, 0.1)",
                          color: m.isActive ? "var(--success)" : "#64748b",
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: m.isActive ? "var(--success)" : "#94a3b8",
                          }}
                        />
                        {m.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>

                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: 13,
                          padding: "2px 10px",
                          borderRadius: 12,
                          background: (m.leadsCount || 0) > 0 ? "rgba(139, 92, 246, 0.1)" : "#f1f5f9",
                          color: (m.leadsCount || 0) > 0 ? "#7c3aed" : "#94a3b8",
                        }}
                      >
                        {m.leadsCount || 0}
                      </span>
                    </td>

                    <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-secondary)" }}>
                      {new Date(m.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>

                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(m)}
                          title="Edit car model"
                          style={{
                            padding: "6px 12px",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--border)",
                            background: "#ffffff",
                            color: "var(--primary)",
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteModalModel(m)}
                          title="Delete car model"
                          style={{
                            padding: "6px 12px",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid rgba(239, 68, 68, 0.2)",
                            background: "rgba(239, 68, 68, 0.05)",
                            color: "var(--danger)",
                            cursor: "pointer",
                            fontSize: 12,
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9998,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              width: "100%",
              maxWidth: 480,
              overflow: "hidden",
              animation: "scaleIn 0.2s ease-out",
            }}
          >
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>
                {editingModel ? "Edit Car Model" : "Add Car Model"}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: 4,
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveModel} style={{ padding: "24px" }}>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
                  Model Name <span style={{ color: "var(--danger)" }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Nexon, Curvv, Harrier, Safari"
                  value={modelNameInput}
                  onChange={(e) => setModelNameInput(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
                  Model Code <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)" }}>(Optional shorthand)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. NXN, CRV, HAR, SAF"
                  value={modelCodeInput}
                  onChange={(e) => setModelCodeInput(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    fontSize: 14,
                    outline: "none",
                    textTransform: "uppercase",
                  }}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
                  <input
                    type="checkbox"
                    checked={modelActiveInput}
                    onChange={(e) => setModelActiveInput(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: "var(--primary)" }}
                  />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Active Status</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      Active models are shown in the leads table model selector
                    </div>
                  </div>
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    padding: "10px 18px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    background: "#ffffff",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingModel}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "var(--radius-sm)",
                    border: "none",
                    background: "var(--primary)",
                    color: "#ffffff",
                    cursor: savingModel ? "not-allowed" : "pointer",
                    fontWeight: 600,
                    fontSize: 14,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {savingModel ? "Saving..." : editingModel ? "Update Model" : "Create Model"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalModel && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9998,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteModalModel(null);
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              width: "100%",
              maxWidth: 440,
              padding: 24,
              animation: "scaleIn 0.2s ease-out",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "rgba(239, 68, 68, 0.1)",
                color: "var(--danger)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 24, height: 24 }}>
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </div>

            <h3 style={{ fontSize: 18, fontWeight: 800, textAlign: "center", marginBottom: 8, color: "var(--text-primary)" }}>
              Delete Car Model
            </h3>
            <p style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 14, marginBottom: 20 }}>
              Are you sure you want to delete <strong>&ldquo;{deleteModalModel.name}&rdquo;</strong>?
              {(deleteModalModel.leadsCount || 0) > 0 && (
                <span style={{ display: "block", marginTop: 8, color: "#dc2626", fontWeight: 600 }}>
                  Warning: {deleteModalModel.leadsCount} lead(s) are currently tagged with this model. Their model field will be unassigned.
                </span>
              )}
            </p>

            <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
              <button
                type="button"
                onClick={() => setDeleteModalModel(null)}
                style={{
                  padding: "10px 18px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  background: "#ffffff",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingModel}
                onClick={handleConfirmDelete}
                style={{
                  padding: "10px 20px",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  background: "var(--danger)",
                  color: "#ffffff",
                  cursor: deletingModel ? "not-allowed" : "pointer",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {deletingModel ? "Deleting..." : "Delete Model"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
