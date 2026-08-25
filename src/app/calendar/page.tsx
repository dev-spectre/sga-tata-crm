"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { parsePhoneNumber, parseBranches } from "@/lib/utils";

interface Lead {
  id: number;
  name: string;
  phone: string;
  status: string;
  city?: string;
  branch?: string;
  adname?: string;
  followUpDate1?: string | null;
  followUpDate2?: string | null;
  remark: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const PAGE_SIZE = 20;

const toISTDateString = (isoString?: string | null) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = formatter.formatToParts(d);
  const y = parts.find(p => p.type === 'year')?.value;
  const m = parts.find(p => p.type === 'month')?.value;
  const d_part = parts.find(p => p.type === 'day')?.value;
  return `${y}-${m}-${d_part}`;
};

const getTodayISTString = () => {
  const d = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = formatter.formatToParts(d);
  const y = parts.find(p => p.type === 'year')?.value;
  const m = parts.find(p => p.type === 'month')?.value;
  const d_part = parts.find(p => p.type === 'day')?.value;
  return `${y}-${m}-${d_part}`;
};

const getMonthKey = (date: Date) => {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' });
  const parts = formatter.formatToParts(date);
  const y = parts.find(p => p.type === 'year')?.value;
  const m = parts.find(p => p.type === 'month')?.value;
  return `${y}-${m}`;
};

// In-memory caches for ultra-fast instant UI navigation and minimal data egress
const monthCountsCache: Record<string, { counts: Record<string, number>; timestamp: number }> = {};
const datePageCache: Record<string, { [page: number]: { leads: Lead[]; total: number; totalPages: number }; timestamp: number }> = {};
const CACHE_TTL = 120000; // 2 minutes

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const todayStr = useMemo(() => getTodayISTString(), []);
  const [selectedDate, setSelectedDate] = useState<string>(() => todayStr);
  const [page, setPage] = useState(1);
  const [leads, setLeads] = useState<Lead[]>(() => datePageCache[todayStr]?.[1]?.leads || []);
  const [pagination, setPagination] = useState<Pagination>(() => {
    const cached = datePageCache[todayStr]?.[1];
    return cached
      ? { page: 1, limit: PAGE_SIZE, total: cached.total, totalPages: cached.totalPages }
      : { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 0 };
  });
  const [monthCounts, setMonthCounts] = useState<Record<string, number>>(() => monthCountsCache[getMonthKey(new Date())]?.counts || {});
  const [loadingLeads, setLoadingLeads] = useState(() => !datePageCache[todayStr]?.[1]);
  const [accessRestricted, setAccessRestricted] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const activeMonthKey = useMemo(() => getMonthKey(currentDate), [currentDate]);

  // Fetch month follow-up count aggregation (lightweight ~200 bytes)
  const fetchMonthCounts = useCallback(async (monthKey: string, force = false) => {
    if (!force && monthCountsCache[monthKey] && Date.now() - monthCountsCache[monthKey].timestamp < CACHE_TTL) {
      setMonthCounts(monthCountsCache[monthKey].counts);
      return;
    }

    try {
      const res = await fetch(`/api/leads/calendar-counts?month=${monthKey}`);
      if (res.ok) {
        const data = await res.json();
        const counts = data.counts || {};
        monthCountsCache[monthKey] = { counts, timestamp: Date.now() };
        setMonthCounts(counts);
      }
    } catch (err) {
      console.error("Failed to fetch calendar counts", err);
    }
  }, []);

  // Fetch paginated leads for selected date (max 20 leads per page)
  const fetchLeadsForSelectedDate = useCallback(async (dateStr: string, pageNum: number, force = false) => {
    const cachedDate = datePageCache[dateStr];
    const cachedPage = cachedDate?.[pageNum];

    if (!force && cachedPage && Date.now() - cachedDate.timestamp < CACHE_TTL) {
      setLeads(cachedPage.leads);
      setPagination({
        page: pageNum,
        limit: PAGE_SIZE,
        total: cachedPage.total,
        totalPages: cachedPage.totalPages,
      });
      setLoadingLeads(false);
      return;
    }

    setLoadingLeads(true);
    try {
      const res = await fetch(`/api/leads?followUpDate=${dateStr}&page=${pageNum}&limit=${PAGE_SIZE}&fields=calendar&skipStats=true&skipActivities=true`);
      const data = await res.json();
      if (res.status === 403) {
        setAccessRestricted(true);
        setLeads([]);
      } else if (res.ok) {
        const incomingLeads = data.leads || [];
        const total = data.pagination?.total ?? incomingLeads.length;
        const totalPages = data.pagination?.totalPages ?? Math.ceil(total / PAGE_SIZE);

        if (!datePageCache[dateStr]) {
          datePageCache[dateStr] = { timestamp: Date.now() };
        }
        datePageCache[dateStr].timestamp = Date.now();
        datePageCache[dateStr][pageNum] = {
          leads: incomingLeads,
          total,
          totalPages,
        };

        setLeads(incomingLeads);
        setPagination({
          page: pageNum,
          limit: PAGE_SIZE,
          total,
          totalPages,
        });

        // Also sync month count if not present
        setMonthCounts(prev => {
          if (prev[dateStr] === total) return prev;
          const updated = { ...prev, [dateStr]: total };
          if (monthCountsCache[activeMonthKey]) {
            monthCountsCache[activeMonthKey].counts = updated;
          }
          return updated;
        });
      }
    } catch (err) {
      console.error("Failed to fetch follow-up leads for date", err);
    } finally {
      setLoadingLeads(false);
    }
  }, [activeMonthKey]);

  useEffect(() => {
    fetchMonthCounts(activeMonthKey);
  }, [activeMonthKey, fetchMonthCounts]);

  useEffect(() => {
    fetchLeadsForSelectedDate(selectedDate, page);
  }, [selectedDate, page, fetchLeadsForSelectedDate]);

  useEffect(() => {
    const handleLeadsUpdated = () => {
      if (document.visibilityState === 'visible') {
        fetchMonthCounts(activeMonthKey, true);
        fetchLeadsForSelectedDate(selectedDate, page, true);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('crm-leads-updated', handleLeadsUpdated);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('crm-leads-updated', handleLeadsUpdated);
      }
    };
  }, [activeMonthKey, selectedDate, page, fetchMonthCounts, fetchLeadsForSelectedDate]);

  const handleSelectDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    setPage(1);
  };

  const updateLeadInState = (id: number, updates: Partial<Lead>) => {
    setLeads(prev => {
      const next = prev.map(l => l.id === id ? { ...l, ...updates } : l);
      if (datePageCache[selectedDate]?.[page]) {
        datePageCache[selectedDate][page].leads = next;
      }
      return next;
    });
  };

  const handleStatusChange = async (lead: Lead, newStatus: string) => {
    const oldStatus = lead.status;
    const normOld = (oldStatus === 'created' ? 'not_contacted' : oldStatus === 'closed_successful' ? 'live' : oldStatus === 'closed_unsuccessful' ? 'lost' : oldStatus);
    if (newStatus === normOld) return;

    updateLeadInState(lead.id, { status: newStatus });
    try {
      await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('crm-leads-updated'));
    } catch {
      updateLeadInState(lead.id, { status: oldStatus });
    }
  };

  const handleFollowUpUpdate = async (lead: Lead, field: 'followUpDate1' | 'followUpDate2', dateStr: string) => {
    const oldVal = lead[field];
    const dateWithTime = dateStr ? `${dateStr}T12:00:00Z` : null;
    const otherField = field === 'followUpDate1' ? 'followUpDate2' : 'followUpDate1';
    const otherVal = lead[otherField];

    const targetDate1 = field === 'followUpDate1' ? toISTDateString(dateWithTime) : toISTDateString(otherVal);
    const targetDate2 = field === 'followUpDate2' ? toISTDateString(dateWithTime) : toISTDateString(otherVal);

    // If updated lead no longer matches selectedDate, remove from active list
    const stillMatches = (targetDate1 === selectedDate || targetDate2 === selectedDate);

    if (!stillMatches) {
      setLeads(prev => {
        const next = prev.filter(l => l.id !== lead.id);
        const newTotal = Math.max(0, pagination.total - 1);
        const newTotalPages = Math.ceil(newTotal / PAGE_SIZE);
        setPagination(p => ({ ...p, total: newTotal, totalPages: newTotalPages }));

        if (datePageCache[selectedDate]?.[page]) {
          datePageCache[selectedDate][page].leads = next;
          datePageCache[selectedDate][page].total = newTotal;
          datePageCache[selectedDate][page].totalPages = newTotalPages;
        }

        // Adjust month count
        setMonthCounts(mc => ({
          ...mc,
          [selectedDate]: Math.max(0, (mc[selectedDate] || 1) - 1),
          ...(dateStr ? { [dateStr]: (mc[dateStr] || 0) + 1 } : {}),
        }));

        return next;
      });
    } else {
      updateLeadInState(lead.id, { [field]: dateWithTime });
    }

    try {
      await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: dateStr || null })
      });
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('crm-leads-updated'));
    } catch {
      fetchLeadsForSelectedDate(selectedDate, page, true);
    }
  };

  const { daysInMonth, startDayOfMonth } = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDayOfMonth = new Date(year, month, 1).getDay();
    return { daysInMonth, startDayOfMonth };
  }, [currentDate]);

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const today = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(getTodayISTString());
    setPage(1);
  };

  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const year = currentDate.getFullYear();

  const formattedSelectedDate = useMemo(() => {
    if (!selectedDate) return '';
    try {
      const d = new Date(`${selectedDate}T12:00:00Z`);
      return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  const renderCells = () => {
    const cells = [];
    const totalCells = Math.ceil((startDayOfMonth + daysInMonth) / 7) * 7;
    const todayStr = getTodayISTString();
    
    for (let i = 0; i < totalCells; i++) {
      const day = i - startDayOfMonth + 1;
      const isCurrentMonth = day > 0 && day <= daysInMonth;
      const yyyy = year;
      const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const isSelected = dateStr === selectedDate;
      const isToday = isCurrentMonth && dateStr === todayStr;

      const scheduledCount = isCurrentMonth ? (monthCounts[dateStr] || 0) : 0;
      const hasFollowUps = scheduledCount > 0;

      cells.push(
        <div 
          key={i} 
          onClick={() => {
            if (isCurrentMonth) {
              handleSelectDate(dateStr);
            }
          }}
          style={{ 
            height: "56px", 
            maxHeight: "56px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            borderRight: "1px solid var(--border)", 
            borderBottom: "1px solid var(--border)",
            padding: "5px 7px",
            background: isSelected 
              ? "rgba(37, 99, 235, 0.08)" 
              : hasFollowUps
              ? "rgba(37, 99, 235, 0.02)"
              : isCurrentMonth ? "transparent" : "rgba(0,0,0,0.02)",
            outline: isSelected ? "2px solid var(--primary, #2563eb)" : "none",
            outlineOffset: "-2px",
            opacity: isCurrentMonth ? 1 : 0.35,
            overflow: "hidden",
            cursor: isCurrentMonth ? "pointer" : "default",
            transition: "background 0.15s ease, outline 0.15s ease",
            position: "relative"
          }}
        >
          {isCurrentMonth && (
            <div style={{ 
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              height: "100%",
            }}>
              <div style={{ 
                fontWeight: 700, 
                width: 24,
                height: 24,
                minHeight: 24,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                background: isToday ? "var(--primary-light, #3b82f6)" : isSelected ? "var(--primary, #2563eb)" : "transparent",
                color: (isToday || isSelected) ? "#fff" : "var(--text-primary)",
                fontSize: 12,
                flexShrink: 0
              }}>
                {day}
              </div>
              {hasFollowUps && (
                <span 
                  title={`${scheduledCount} follow-up(s) scheduled`}
                  style={{ 
                    fontSize: 10, 
                    fontWeight: 700, 
                    background: isSelected ? "var(--primary, #2563eb)" : "rgba(37, 99, 235, 0.14)", 
                    color: isSelected ? "#fff" : "var(--primary, #2563eb)", 
                    padding: "2px 6px", 
                    borderRadius: "10px",
                    letterSpacing: "0.2px"
                  }}
                >
                  {scheduledCount}
                </span>
              )}
            </div>
          )}
        </div>
      );
    }
    return cells;
  };

  return (
    <>
      <div className="page-header" style={{ marginBottom: 14 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Follow-Up Calendar</h1>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-secondary)" }}>
            Select any date to view scheduled leads. Badge shows follow-up count.
          </p>
        </div>
        <div className="page-actions" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn-ghost" onClick={today} style={{ padding: "6px 12px", fontSize: 13 }}>Today</button>
          <button className="btn btn-ghost" onClick={prevMonth} style={{ padding: "6px 10px", fontSize: 13 }}>&lt;</button>
          <h2 style={{ minWidth: 160, textAlign: "center", margin: 0, fontSize: 16 }}>{monthName} {year}</h2>
          <button className="btn btn-ghost" onClick={nextMonth} style={{ padding: "6px 10px", fontSize: 13 }}>&gt;</button>
        </div>
      </div>

      {/* Calendar Month Grid */}
      <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ width: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <div style={{ display: "flex", flexDirection: "column", minWidth: "560px" }}>
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(7, 1fr)", 
              borderBottom: "1px solid var(--border)",
              background: "rgba(0,0,0,0.02)"
            }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} style={{ padding: "8px", textAlign: "center", fontWeight: 600, fontSize: 12, borderRight: "1px solid var(--border)" }}>
                  {d}
                </div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
              {renderCells()}
            </div>
          </div>
        </div>
      </div>

      {/* Selected Date Follow-Ups Section */}
      <div style={{ marginTop: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>
            Follow-Ups for {formattedSelectedDate}
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ 
              fontSize: 13, 
              fontWeight: 600, 
              background: "var(--card-bg, #f3f4f6)", 
              padding: "4px 12px", 
              borderRadius: "16px",
              border: "1px solid var(--border)" 
            }}>
              {pagination.total} Follow-Up{pagination.total === 1 ? '' : 's'} Total
            </span>
          </div>
        </div>

        <div className="glass-card" style={{ padding: 20 }}>
          {loadingLeads ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>
              <span className="spinner" /> Loading follow-ups for {formattedSelectedDate}...
            </div>
          ) : accessRestricted ? (
            <div style={{ padding: 30, textAlign: "center", color: "var(--status-lost)" }}>
              Access restricted to follow-up leads.
            </div>
          ) : leads.length === 0 ? (
            <div style={{ color: "var(--text-secondary)", textAlign: "center", padding: 32 }}>
              No follow-ups scheduled for <strong>{formattedSelectedDate}</strong>.
              <div style={{ fontSize: 12, marginTop: 6, opacity: 0.8 }}>Click any date on the calendar above to view its scheduled follow-ups.</div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {leads.map(lead => {
                  const isF1 = lead.followUpDate1 && toISTDateString(lead.followUpDate1) === selectedDate;
                  const isF2 = lead.followUpDate2 && toISTDateString(lead.followUpDate2) === selectedDate;
                  return (
                    <div 
                      key={lead.id} 
                      style={{ 
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "flex-start", 
                        flexWrap: "wrap",
                        gap: "16px",
                        background: "#fff", 
                        padding: "20px", 
                        borderRadius: "12px",
                        border: "1px solid var(--border)",
                        boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
                        marginBottom: "4px"
                      }}
                    >
                      <div style={{ flex: "1 1 280px", minWidth: 0, paddingRight: "12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                          <div style={{ fontWeight: 700, fontSize: 18, color: "var(--text-primary)", letterSpacing: "-0.3px" }}>{lead.name}</div>
                          <select 
                            value={lead.status === 'created' ? 'not_contacted' : lead.status === 'closed_successful' ? 'live' : lead.status === 'closed_unsuccessful' ? 'lost' : lead.status} 
                            onChange={(e) => handleStatusChange(lead, e.target.value)}
                            className={`status-select status-${(lead.status === 'not_contacted' || lead.status === 'created') ? 'not_contacted' : lead.status === 'pending' ? 'pending' : (lead.status === 'live' || lead.status === 'closed_successful') ? 'live' : 'lost'}`}
                            style={{ padding: "4px 12px", fontSize: "12px", borderRadius: "16px", cursor: "pointer" }}
                          >
                            <option value="not_contacted">Not Contacted</option>
                            <option value="pending">Contacted</option>
                            <option value="live">Completed</option>
                            <option value="lost">Lost</option>
                          </select>
                        </div>
                        
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", marginBottom: 20 }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-secondary)", fontWeight: 600 }}>Phone</span>
                            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{parsePhoneNumber(lead.phone)}</span>
                          </div>
                          {lead.city && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-secondary)", fontWeight: 600 }}>City</span>
                              <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{lead.city}</span>
                            </div>
                          )}
                          {lead.branch && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-secondary)", fontWeight: 600 }}>Branch</span>
                              <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{parseBranches(lead.branch).join(', ')}</span>
                            </div>
                          )}
                          {lead.adname && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-secondary)", fontWeight: 600 }}>Ad Name</span>
                              <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{lead.adname}</span>
                            </div>
                          )}
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-secondary)", fontWeight: 600 }}>Created</span>
                            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{new Date(lead.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                        
                        {lead.remark && (
                          <div style={{ background: "rgba(0,0,0,0.02)", borderLeft: "3px solid var(--primary-light)", padding: "12px 16px", borderRadius: "0 8px 8px 0", fontSize: 14, color: "var(--text-secondary)", fontStyle: "italic", lineHeight: "1.5" }}>
                            "{lead.remark}"
                          </div>
                        )}
                      </div>
                      
                      <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start", flex: "1 1 220px", minWidth: 0, width: "100%", maxWidth: "100%" }}>
                        <div style={{ display: "flex", gap: 8 }}>
                          {isF1 && <span style={{ background: "var(--primary-light)", color: "#fff", padding: "4px 12px", borderRadius: "20px", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>1st Follow Up</span>}
                          {isF2 && <span style={{ background: "var(--primary)", color: "#fff", padding: "4px 12px", borderRadius: "20px", fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>2nd Follow Up</span>}
                        </div>
                        
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", marginTop: "auto" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(0,0,0,0.02)", padding: "8px 12px", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.05)", transition: "all 0.2s ease" }}>
                            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", width: "16px" }}>F1</span>
                            <input 
                              type="date" 
                              value={toISTDateString(lead.followUpDate1)} 
                              onChange={(e) => handleFollowUpUpdate(lead, 'followUpDate1', e.target.value)}
                              style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "13px", outline: "none", flex: 1, color: "var(--text-primary)", fontWeight: 500, fontFamily: "inherit" }}
                            />
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(0,0,0,0.02)", padding: "8px 12px", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.05)", transition: "all 0.2s ease" }}>
                            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", width: "16px" }}>F2</span>
                            <input 
                              type="date" 
                              value={toISTDateString(lead.followUpDate2)} 
                              onChange={(e) => handleFollowUpUpdate(lead, 'followUpDate2', e.target.value)}
                              style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "13px", outline: "none", flex: 1, color: "var(--text-primary)", fontWeight: 500, fontFamily: "inherit" }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              {pagination.totalPages > 1 && (
                <div 
                  className="pagination" 
                  style={{ 
                    display: "flex", 
                    justifyContent: "center", 
                    alignItems: "center", 
                    gap: 12, 
                    marginTop: 20,
                    paddingTop: 16,
                    borderTop: "1px solid var(--border)"
                  }}
                >
                  <button
                    className="btn btn-ghost"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1 || loadingLeads}
                    style={{ padding: "6px 14px", fontSize: 13 }}
                  >
                    ← Prev
                  </button>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>
                    Page {page} of {pagination.totalPages} ({pagination.total} leads)
                  </span>
                  <button
                    className="btn btn-ghost"
                    onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                    disabled={page >= pagination.totalPages || loadingLeads}
                    style={{ padding: "6px 14px", fontSize: 13 }}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Selected Lead Modal */}
      {selectedLead && (
        <div className="modal-overlay" onClick={() => setSelectedLead(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Lead Details</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
              <div><strong>Name:</strong> {selectedLead.name}</div>
              <div><strong>Phone:</strong> {parsePhoneNumber(selectedLead.phone)}</div>
              <div><strong>Status:</strong> {selectedLead.status}</div>
              {selectedLead.remark && <div><strong>Remark:</strong> {selectedLead.remark}</div>}
              {selectedLead.followUpDate1 && <div><strong>Follow Up 1:</strong> {new Date(selectedLead.followUpDate1).toLocaleDateString()}</div>}
              {selectedLead.followUpDate2 && <div><strong>Follow Up 2:</strong> {new Date(selectedLead.followUpDate2).toLocaleDateString()}</div>}
            </div>
            <div className="modal-actions" style={{ marginTop: 24 }}>
              <button className="btn btn-primary" onClick={() => setSelectedLead(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
