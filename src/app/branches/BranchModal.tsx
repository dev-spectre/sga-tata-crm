"use client";

import { useState } from "react";
import { Branch } from "./page";

interface BranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (savedBranch: Branch) => void;
  initialData?: Branch | null;
}

export default function BranchModal({
  isOpen,
  onClose,
  onSaved,
  initialData,
}: BranchModalProps) {
  if (!isOpen) return null;

  return (
    <BranchModalContent
      key={initialData ? `edit-${initialData.id}` : "create"}
      onClose={onClose}
      onSaved={onSaved}
      initialData={initialData}
    />
  );
}

function BranchModalContent({
  onClose,
  onSaved,
  initialData,
}: {
  onClose: () => void;
  onSaved: (savedBranch: Branch) => void;
  initialData?: Branch | null;
}) {
  const isEditing = Boolean(initialData);

  const [name, setName] = useState(initialData?.name || "");
  const [code, setCode] = useState(initialData?.code || "");
  const [city, setCity] = useState(initialData?.city || "");
  const [address, setAddress] = useState(initialData?.address || "");
  const [latitude, setLatitude] = useState(
    initialData?.latitude !== null && initialData?.latitude !== undefined ? String(initialData.latitude) : ""
  );
  const [longitude, setLongitude] = useState(
    initialData?.longitude !== null && initialData?.longitude !== undefined ? String(initialData.longitude) : ""
  );
  const [radiusKm, setRadiusKm] = useState(String(initialData?.radiusKm || 50));
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);

  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Browser Geolocation Helper
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setGeoLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setGeoLoading(false);
      },
      (err) => {
        setGeoLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setError("Location access denied. Please enter coordinates manually.");
        } else {
          setError("Unable to retrieve current location: " + err.message);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    const cleanCode = code.trim().toUpperCase();

    if (!cleanName) {
      setError("Branch name is required");
      return;
    }

    if (!cleanCode) {
      setError("Branch code is required");
      return;
    }

    // Latitude validation
    let parsedLat: number | null = null;
    if (latitude.trim() !== "") {
      parsedLat = Number(latitude);
      if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
        setError("Latitude must be a valid number between -90 and 90 degrees");
        return;
      }
    }

    // Longitude validation
    let parsedLng: number | null = null;
    if (longitude.trim() !== "") {
      parsedLng = Number(longitude);
      if (isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180) {
        setError("Longitude must be a valid number between -180 and 180 degrees");
        return;
      }
    }

    // Must provide both or neither
    if ((parsedLat !== null && parsedLng === null) || (parsedLat === null && parsedLng !== null)) {
      setError("Please provide both Latitude and Longitude for GPS mapping, or leave both blank");
      return;
    }

    // Radius validation
    const parsedRad = Number(radiusKm);
    if (isNaN(parsedRad) || parsedRad <= 0) {
      setError("Service radius must be a positive number of kilometers");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: cleanName,
        code: cleanCode,
        city: city.trim(),
        address: address.trim(),
        latitude: parsedLat,
        longitude: parsedLng,
        radiusKm: parsedRad,
        isActive,
      };

      const endpoint = isEditing && initialData ? `/api/branches/${initialData.id}` : "/api/branches";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to save branch");
        return;
      }

      if (data.branch) {
        onSaved(data.branch);
        onClose();
      } else {
        setError("Unexpected response from server");
      }
    } catch {
      setError("Network error while saving branch. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const hasCoordinates =
    latitude.trim() !== "" &&
    longitude.trim() !== "" &&
    !isNaN(Number(latitude)) &&
    !isNaN(Number(longitude));

  return (
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
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        className="glass-card"
        style={{
          background: "#ffffff",
          borderRadius: "var(--radius)",
          padding: 28,
          maxWidth: 580,
          width: "100%",
          boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
          border: "1px solid var(--border)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {/* Modal Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "var(--radius-sm)",
                background: "rgba(0, 114, 188, 0.1)",
                color: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
                <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v2M12 14v2M16 14v2" />
              </svg>
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>
                {isEditing ? "Edit Branch" : "Add Dealership Branch"}
              </h2>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {isEditing
                  ? `Update settings and GPS pin for ${initialData?.name}`
                  : "Configure physical showroom location & GPS coordinates"}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              padding: 4,
              borderRadius: 6,
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            style={{
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 14px",
              color: "var(--danger)",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16, flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>{error}</div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            {/* Branch Name */}
            <div style={{ gridColumn: "span 2" }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
                Branch Name <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. SGA Tata Coimbatore - Avinashi Road"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </div>

            {/* Branch Code */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
                Branch Code <span style={{ color: "var(--danger)" }}>*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. CBE-MAIN"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  fontSize: 14,
                  fontFamily: "monospace",
                  fontWeight: 700,
                  outline: "none",
                  letterSpacing: "0.05em",
                }}
              />
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                Unique identifier (e.g. MTP, SLM)
              </div>
            </div>

            {/* City */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
                City / Town
              </label>
              <input
                type="text"
                placeholder="e.g. Coimbatore"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </div>

            {/* Street Address */}
            <div style={{ gridColumn: "span 2" }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
                Physical Address
              </label>
              <textarea
                rows={2}
                placeholder="Door No, Street Name, Landmark, Pincode"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  fontSize: 13,
                  outline: "none",
                  resize: "vertical",
                }}
              />
            </div>
          </div>

          {/* GPS Coordinates Group */}
          <div
            style={{
              background: "rgba(0, 114, 188, 0.03)",
              border: "1px solid rgba(0, 114, 188, 0.15)",
              borderRadius: "var(--radius-sm)",
              padding: "14px 16px",
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--primary)" }}>
                  Geolocation Coordinates (GPS Pin)
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  Used by the Haversine distance engine to calculate nearest branch
                </div>
              </div>

              <button
                type="button"
                onClick={handleGetCurrentLocation}
                disabled={geoLoading}
                style={{
                  background: "#ffffff",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "5px 10px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--primary)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                {geoLoading ? (
                  <span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid var(--primary)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 13, height: 13 }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="22" y1="12" x2="18" y2="12" />
                    <line x1="6" y1="12" x2="2" y2="12" />
                    <line x1="12" y1="6" x2="12" y2="2" />
                    <line x1="12" y1="22" x2="12" y2="18" />
                  </svg>
                )}
                Use My Location
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                  Latitude (°N)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 11.0168"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    fontSize: 13,
                    fontFamily: "monospace",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                  Longitude (°E)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 76.9558"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    fontSize: 13,
                    fontFamily: "monospace",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            {hasCoordinates && (
              <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                <a
                  href={`https://www.google.com/maps?q=${latitude},${longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--primary)",
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 12, height: 12 }}>
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  Preview Pin on Google Maps
                </a>
              </div>
            )}
          </div>

          {/* Service Radius & Active Toggle */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
                Service Radius (km)
              </label>
              <input
                type="number"
                step="1"
                min="1"
                placeholder="50"
                value={radiusKm}
                onChange={(e) => setRadiusKm(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  fontSize: 14,
                  outline: "none",
                }}
              />
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                Primary catchment perimeter
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
                Operational Status
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "var(--primary)" }}
                />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
                  Active for Lead Auto-Routing
                </span>
              </label>
            </div>
          </div>

          {/* Modal Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
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
              type="submit"
              disabled={loading}
              style={{
                padding: "9px 20px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: "var(--primary)",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 2px 8px rgba(0, 114, 188, 0.3)",
              }}
            >
              {loading ? "Saving..." : isEditing ? "Save Changes" : "Create Branch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
