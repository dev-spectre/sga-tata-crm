"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { parsePhoneNumber, parseBranches, formatStatusLabel } from "@/lib/utils";
import {
  formatToDDMMYYYY,
  toISTDateString,
  getLeadFollowUps,
  getLeadFollowUpCount,
} from "@/lib/followup";

interface Lead {
  id: number;
  name: string;
  phone: string;
  status: string;
  city?: string;
  branch?: string;
  adname?: string;
  carModel?: string;
  assignedConsultant?: string | null;
  testDrive?: string | null;
  handledBy?: string | null;
  followUpDate1?: string | null;
  followUpDate2?: string | null;
  followUpCount?: number;
  followUps?: Array<{ id?: number; step: number; date: string; createdAt?: string }>;
  remark: string | null;
  createdAt: string;
}

interface ConsultantItem {
  id: number;
  name: string;
  branch: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const PAGE_SIZE = 20;

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

const getFollowUpInputsState = (lead: Lead) => {
  const followUps = getLeadFollowUps(lead);
  const count = followUps.length;

  if (count <= 1) {
    return {
      step1: 1,
      label1: "1.",
      val1: followUps[0] ? toISTDateString(followUps[0].date) : "",
      step2: 2,
      label2: "2.",
      val2: "",
    };
  }

  return {
    step1: count,
    label1: `${count}.`,
    val1: toISTDateString(followUps[count - 1].date),
    step2: count + 1,
    label2: `${count + 1}.`,
    val2: "",
  };
};

const getMatchingStepForDate = (lead: Lead, dateStr: string): number => {
  const followUps = getLeadFollowUps(lead);
  const match = followUps.find((f) => toISTDateString(f.date) === dateStr);
  return match ? match.step : 0;
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
  const [timelineLead, setTimelineLead] = useState<Lead | null>(null);

  const [currentUser, setCurrentUser] = useState<{
    username?: string;
    role?: string;
    isSuperAdmin?: boolean;
  } | null>(null);
  const [consultantsList, setConsultantsList] = useState<ConsultantItem[]>([]);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), type === "error" ? 5000 : 3000);
  }, []);

  const checkIsLeadLocked = useCallback((lead: Lead) => {
    if (!currentUser) return false;
    const isSuper = Boolean(
      currentUser.isSuperAdmin ||
      currentUser.role === "SUPERADMIN" ||
      currentUser.username === (process.env.NEXT_PUBLIC_SUPERADMIN_USERNAME || "sudo")
    );
    if (currentUser.role === "ADMIN" || isSuper) return false;
    if (!lead.handledBy || !currentUser.username) return false;
    return lead.handledBy.trim().toLowerCase() !== currentUser.username.trim().toLowerCase();
  }, [currentUser]);

  const getConsultantGroupsForLead = useCallback((lead: Lead) => {
    const leadBranches = lead.branch
      ? parseBranches(lead.branch).map(b => b.toLowerCase().trim())
      : [];
    const rawLeadBranch = (lead.branch || '').toLowerCase().replace(/[_-]/g, ' ').trim();

    const isBranchMatching = (branchName: string) => {
      if (!branchName || branchName.toLowerCase() === 'other' || branchName.toLowerCase() === 'unassigned') {
        return false;
      }
      if (leadBranches.length === 0 && !rawLeadBranch) {
        return false;
      }
      const bLower = branchName.toLowerCase().trim();
      return (
        leadBranches.includes(bLower) ||
        leadBranches.some(lb => lb === bLower || lb.includes(bLower) || bLower.includes(lb)) ||
        (rawLeadBranch !== '' && (rawLeadBranch.includes(bLower) || bLower.includes(rawLeadBranch)))
      );
    };

    const groupMap = new Map<string, Map<string, ConsultantItem>>();

    const addConsultantToBranch = (branch: string, c: ConsultantItem) => {
      const cleanBranch = branch.trim() || 'Other';
      if (!groupMap.has(cleanBranch)) {
        groupMap.set(cleanBranch, new Map());
      }
      const map = groupMap.get(cleanBranch)!;
      const nameKey = c.name.toLowerCase().trim();
      if (!map.has(nameKey)) {
        map.set(nameKey, c);
      }
    };

    consultantsList.forEach(c => {
      if (!c.branch || !c.branch.trim()) {
        addConsultantToBranch('Other', c);
      } else {
        const parsed = parseBranches(c.branch);
        if (parsed.length > 0) {
          parsed.forEach(b => addConsultantToBranch(b, c));
        } else {
          addConsultantToBranch(c.branch.trim(), c);
        }
      }
    });

    if (lead.assignedConsultant && lead.assignedConsultant.trim()) {
      const assignedName = lead.assignedConsultant.trim();
      const assignedLower = assignedName.toLowerCase();

      let foundInAnyGroup = false;
      for (const m of groupMap.values()) {
        if (m.has(assignedLower)) {
          foundInAnyGroup = true;
          break;
        }
      }

      if (!foundInAnyGroup) {
        const existingInList = consultantsList.find(c => c.name.toLowerCase().trim() === assignedLower);
        if (existingInList && existingInList.branch) {
          const parsed = parseBranches(existingInList.branch);
          if (parsed.length > 0) {
            parsed.forEach(b => addConsultantToBranch(b, existingInList));
          } else {
            addConsultantToBranch(existingInList.branch.trim(), existingInList);
          }
        } else {
          const leadParsed = parseBranches(lead.branch || '');
          const targetBranch = leadParsed.length > 0 ? leadParsed[0] : (lead.branch?.trim() || 'Other');
          addConsultantToBranch(targetBranch, {
            id: -1,
            name: assignedName,
            branch: targetBranch
          });
        }
      }
    }

    const matchingGroups: { branch: string; consultants: ConsultantItem[] }[] = [];
    const otherGroups: { branch: string; consultants: ConsultantItem[] }[] = [];
    let otherUnassignedGroup: { branch: string; consultants: ConsultantItem[] } | null = null;

    groupMap.forEach((cMap, branchName) => {
      const list = Array.from(cMap.values()).sort((a, b) => a.name.localeCompare(b.name));
      if (list.length === 0) return;

      if (branchName.toLowerCase() === 'other' || branchName.toLowerCase() === 'unassigned') {
        otherUnassignedGroup = { branch: branchName, consultants: list };
      } else if (isBranchMatching(branchName)) {
        matchingGroups.push({ branch: branchName, consultants: list });
      } else {
        otherGroups.push({ branch: branchName, consultants: list });
      }
    });

    matchingGroups.sort((a, b) => a.branch.localeCompare(b.branch));
    otherGroups.sort((a, b) => a.branch.localeCompare(b.branch));

    const result = [...matchingGroups, ...otherGroups];
    if (otherUnassignedGroup) {
      result.push(otherUnassignedGroup);
    }
    return result;
  }, [consultantsList]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => {});

    fetch("/api/consultants")
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.consultants)) {
          setConsultantsList(data.consultants);
        }
      })
      .catch(() => {});
  }, []);

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
      const res = await fetch(`/api/leads?followUpDate=${dateStr}&page=${pageNum}&limit=${PAGE_SIZE}&fields=calendar&skipStats=true`);
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
    setSelectedLead(prev => prev && prev.id === id ? { ...prev, ...updates } : prev);
    setTimelineLead(prev => prev && prev.id === id ? { ...prev, ...updates } : prev);
  };

  const handleStatusChange = async (lead: Lead, newStatus: string) => {
    const isLocked = checkIsLeadLocked(lead);
    if (isLocked) {
      showToast(`This lead is currently handled by "${lead.handledBy}". You cannot modify this lead unless "${lead.handledBy}" changes its status back to Not Contacted.`, "error");
      return;
    }

    const oldStatus = lead.status;
    const normOld = (oldStatus === 'created' ? 'not_contacted' : oldStatus === 'closed_successful' ? 'live' : oldStatus === 'closed_unsuccessful' ? 'lost' : oldStatus);
    if (newStatus === normOld) return;

    const normNew = (newStatus === 'created' ? 'not_contacted' : newStatus === 'closed_successful' ? 'live' : newStatus === 'closed_unsuccessful' ? 'lost' : newStatus);
    const optimisticHandledBy = normNew === 'not_contacted' ? null : (lead.handledBy || currentUser?.username || null);

    updateLeadInState(lead.id, { status: newStatus, handledBy: optimisticHandledBy });
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || data.details || "Failed to update status", "error");
        updateLeadInState(lead.id, { status: oldStatus, ...(data.handledBy !== undefined ? { handledBy: data.handledBy } : {}) });
      } else {
        showToast(`Status updated to ${formatStatusLabel(newStatus)}`);
        if (data.lead) {
          updateLeadInState(lead.id, data.lead);
        }
      }
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('crm-leads-updated'));
    } catch {
      showToast("Network error while updating status", "error");
      updateLeadInState(lead.id, { status: oldStatus });
    }
  };

  const handleTestDriveUpdate = async (lead: Lead, value: string) => {
    const isLocked = checkIsLeadLocked(lead);
    if (isLocked) {
      showToast(`This lead is currently handled by "${lead.handledBy}". You cannot modify this lead.`, "error");
      return;
    }

    const oldTestDrive = lead.testDrive;
    if (oldTestDrive === value) return;

    updateLeadInState(lead.id, { testDrive: value });
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testDrive: value })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || data.details || "Failed to update test drive", "error");
        updateLeadInState(lead.id, { testDrive: oldTestDrive, ...(data.handledBy !== undefined ? { handledBy: data.handledBy } : {}) });
      } else {
        showToast(`Test drive updated to ${value}`);
        if (data.lead) {
          updateLeadInState(lead.id, data.lead);
        }
      }
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('crm-leads-updated'));
    } catch {
      showToast("Network error while updating test drive", "error");
      updateLeadInState(lead.id, { testDrive: oldTestDrive });
    }
  };

  const handleAssignedConsultantUpdate = async (lead: Lead, value: string) => {
    const isLocked = checkIsLeadLocked(lead);
    if (isLocked) {
      showToast(`This lead is currently handled by "${lead.handledBy}". You cannot modify this lead.`, "error");
      return;
    }

    const oldConsultant = lead.assignedConsultant;
    if (oldConsultant === value) return;

    updateLeadInState(lead.id, { assignedConsultant: value });
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedConsultant: value })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || data.details || "Failed to update consultant", "error");
        updateLeadInState(lead.id, { assignedConsultant: oldConsultant, ...(data.handledBy !== undefined ? { handledBy: data.handledBy } : {}) });
      } else {
        showToast(value ? `Consultant assigned: ${value}` : "Consultant unassigned");
        if (data.lead) {
          updateLeadInState(lead.id, data.lead);
        }
      }
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('crm-leads-updated'));
    } catch {
      showToast("Network error while updating consultant", "error");
      updateLeadInState(lead.id, { assignedConsultant: oldConsultant });
    }
  };

  const handleFollowUpChange = async (
    lead: Lead,
    isSecondInput: boolean,
    dateStr: string,
    currentStep: number
  ) => {
    if (checkIsLeadLocked(lead)) {
      showToast(`This lead is currently handled by "${lead.handledBy}". You cannot modify this lead.`, "error");
      return;
    }
    if (!dateStr && isSecondInput) return;

    const prevFollowUps = getLeadFollowUps(lead);
    const dateWithTime = dateStr ? `${dateStr}T12:00:00+05:30` : '';

    let updatedFollowUps = [...prevFollowUps];
    let newFollowUpCount = lead.followUpCount || prevFollowUps.length;
    let optimisticPatch: Partial<Lead> = {};

    if (!dateStr) {
      // CLEAR action on existing step:
      const remainingFollowUps = prevFollowUps
        .filter(f => f.step !== currentStep)
        .map((f, idx) => ({ ...f, step: idx + 1 }));
      newFollowUpCount = remainingFollowUps.length;
      const newF1 = newFollowUpCount > 0 ? remainingFollowUps[0].date : null;
      const newF2 = newFollowUpCount > 1 ? remainingFollowUps[newFollowUpCount - 1].date : null;

      optimisticPatch = {
        followUps: remainingFollowUps,
        followUpCount: newFollowUpCount,
        followUpDate1: newF1,
        followUpDate2: newF2,
      };
    } else if (isSecondInput) {
      const targetStep = currentStep;
      updatedFollowUps = [...prevFollowUps, { step: targetStep, date: dateWithTime }];
      newFollowUpCount = targetStep;
      optimisticPatch = {
        followUps: updatedFollowUps,
        followUpCount: newFollowUpCount,
        followUpDate2: dateWithTime,
        ...(!lead.followUpDate1 ? { followUpDate1: dateWithTime } : {}),
      };
    } else {
      if (updatedFollowUps.some(f => f.step === currentStep)) {
        updatedFollowUps = updatedFollowUps.map(f => f.step === currentStep ? { ...f, date: dateWithTime } : f);
      } else {
        updatedFollowUps = [...updatedFollowUps, { step: currentStep, date: dateWithTime }];
      }
      optimisticPatch = {
        followUps: updatedFollowUps,
        followUpCount: newFollowUpCount,
        ...(currentStep === 1 ? { followUpDate1: dateWithTime || null } : {}),
        ...(currentStep === 2 ? { followUpDate2: dateWithTime || null } : {}),
      };
    }

    updateLeadInState(lead.id, optimisticPatch);
    if (timelineLead && timelineLead.id === lead.id) {
      setTimelineLead(prev => prev ? { ...prev, ...optimisticPatch } : null);
    }

    try {
      const payload: any = isSecondInput
        ? { newFollowUpDate: dateStr, step: currentStep }
        : { updateFollowUp: { step: currentStep, date: dateStr } };

      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast(!dateStr ? `Follow-up #${currentStep} cleared` : isSecondInput ? `Added Follow-Up #${currentStep}` : `Updated Follow-Up #${currentStep}`);
        if (data.lead) {
          updateLeadInState(lead.id, data.lead);
          if (timelineLead && timelineLead.id === lead.id) {
            setTimelineLead(data.lead);
          }
        }
        fetchMonthCounts(activeMonthKey, true);
      } else {
        showToast(data.error || data.details || "Failed to update date", "error");
        fetchLeadsForSelectedDate(selectedDate, page, true);
      }
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('crm-leads-updated'));
    } catch {
      showToast("Network error while updating date", "error");
      fetchLeadsForSelectedDate(selectedDate, page, true);
    }
  };

  const handleFollowUpUpdate = async (lead: Lead, field: 'followUpDate1' | 'followUpDate2', dateStr: string) => {
    const inputs = getFollowUpInputsState(lead);
    if (field === 'followUpDate2') {
      return handleFollowUpChange(lead, true, dateStr, inputs.step2);
    } else {
      return handleFollowUpChange(lead, false, dateStr, inputs.step1);
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
      const d = new Date(`${selectedDate}T12:00:00+05:30`);
      const ddmmyyyy = formatToDDMMYYYY(selectedDate);
      const weekday = d.toLocaleDateString('en-IN', { weekday: 'long' });
      return `${ddmmyyyy} (${weekday})`;
    } catch {
      return formatToDDMMYYYY(selectedDate);
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
                  const isLeadLocked = checkIsLeadLocked(lead);
                  return (
                    <div 
                      key={lead.id} 
                      style={{ 
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "flex-start", 
                        flexWrap: "wrap",
                        gap: "16px",
                        background: isLeadLocked ? "rgba(241, 245, 249, 0.4)" : "#fff", 
                        padding: "20px", 
                        borderRadius: "12px",
                        border: "1px solid var(--border)",
                        boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
                        marginBottom: "4px"
                      }}
                    >
                      <div style={{ flex: "1 1 280px", minWidth: 0, paddingRight: "12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
                          <div style={{ fontWeight: 700, fontSize: 18, color: "var(--text-primary)", letterSpacing: "-0.3px" }}>
                            {lead.name}
                          </div>
                          {lead.handledBy && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                padding: "2px 8px",
                                borderRadius: "10px",
                                fontSize: "11px",
                                fontWeight: 600,
                                background: isLeadLocked ? "rgba(239, 68, 68, 0.08)" : "rgba(37, 99, 235, 0.08)",
                                color: isLeadLocked ? "#dc2626" : "#2563eb",
                                border: `1px solid ${isLeadLocked ? "rgba(239, 68, 68, 0.2)" : "rgba(37, 99, 235, 0.2)"}`,
                                whiteSpace: "nowrap",
                              }}
                              title={isLeadLocked ? `Locked by ${lead.handledBy} (Read only)` : `Handled by ${lead.handledBy}`}
                            >
                              {isLeadLocked ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 11, height: 11 }}>
                                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                </svg>
                              ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 11, height: 11 }}>
                                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                  <circle cx="12" cy="7" r="4"></circle>
                                </svg>
                              )}
                              {isLeadLocked ? `Locked: ${lead.handledBy}` : `Handled by ${lead.handledBy}`}
                            </span>
                          )}
                          <select 
                            value={lead.status === 'created' ? 'not_contacted' : lead.status === 'closed_successful' ? 'live' : lead.status === 'closed_unsuccessful' ? 'lost' : lead.status} 
                            onChange={(e) => handleStatusChange(lead, e.target.value)}
                            disabled={isLeadLocked}
                            title={isLeadLocked ? `Locked by ${lead.handledBy}` : `Status: ${formatStatusLabel(lead.status)}`}
                            className={`status-select status-${(lead.status === 'not_contacted' || lead.status === 'created') ? 'not_contacted' : lead.status === 'pending' ? 'pending' : lead.status === 'callback' ? 'callback' : (lead.status === 'live' || lead.status === 'closed_successful') ? 'live' : 'lost'}`}
                            style={{
                              padding: "4px 12px",
                              fontSize: "12px",
                              borderRadius: "16px",
                              cursor: isLeadLocked ? "not-allowed" : "pointer",
                              ...(isLeadLocked ? { opacity: 0.65 } : {})
                            }}
                          >
                            <option value="not_contacted">Not Contacted</option>
                            <option value="pending">Contacted</option>
                            <option value="callback">Callback</option>
                            <option value="live">Completed</option>
                            <option value="lost">Lost</option>
                          </select>
                        </div>
                        
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px 24px", marginBottom: 20, alignItems: "flex-start" }}>
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
                          {lead.carModel && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-secondary)", fontWeight: 600 }}>Model</span>
                              <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{lead.carModel}</span>
                            </div>
                          )}
                          {lead.adname && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-secondary)", fontWeight: 600 }}>Ad Name</span>
                              <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{lead.adname}</span>
                            </div>
                          )}

                          {/* Assigned Consultant Dropdown */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-secondary)", fontWeight: 600 }}>
                              Consultant
                            </span>
                            <select
                              className="status-select"
                              style={{
                                padding: "3px 8px",
                                fontSize: "12px",
                                borderRadius: "6px",
                                maxWidth: "180px",
                                ...(isLeadLocked ? { opacity: 0.65, cursor: "not-allowed" } : {})
                              }}
                              value={lead.assignedConsultant || ""}
                              onChange={(e) => handleAssignedConsultantUpdate(lead, e.target.value)}
                              disabled={isLeadLocked}
                              title={isLeadLocked ? `Locked by ${lead.handledBy}` : undefined}
                            >
                              <option value="">Unassigned</option>
                              {getConsultantGroupsForLead(lead).map((group) => (
                                <optgroup key={group.branch} label={group.branch}>
                                  {group.consultants.map((c) => (
                                    <option key={`${group.branch}-${c.id}-${c.name}`} value={c.name}>
                                      {c.name}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          </div>

                          {/* Test Drive State Dropdown */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-secondary)", fontWeight: 600 }}>
                              Test Drive
                            </span>
                            <select
                              className={`status-select ${
                                (lead.testDrive === "Scheduled" || lead.testDrive === "Yes")
                                  ? "td-scheduled"
                                  : lead.testDrive === "Completed"
                                  ? "td-completed"
                                  : lead.testDrive === "Cancelled"
                                  ? "td-cancelled"
                                  : "td-not_scheduled"
                              }`}
                              style={{
                                padding: "3px 10px",
                                fontSize: "12px",
                                borderRadius: "16px",
                                cursor: isLeadLocked ? "not-allowed" : "pointer",
                                ...(isLeadLocked ? { opacity: 0.65 } : {})
                              }}
                              value={
                                lead.testDrive === "Yes"
                                  ? "Scheduled"
                                  : lead.testDrive === "No"
                                  ? "Not Scheduled"
                                  : lead.testDrive || "Not Scheduled"
                              }
                              onChange={(e) => handleTestDriveUpdate(lead, e.target.value)}
                              disabled={isLeadLocked}
                              title={isLeadLocked ? `Locked by ${lead.handledBy}` : undefined}
                            >
                              <option value="Not Scheduled">Not Scheduled</option>
                              <option value="Scheduled">Scheduled</option>
                              <option value="Completed">Completed</option>
                              <option value="Cancelled">Cancelled</option>
                            </select>
                          </div>

                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-secondary)", fontWeight: 600 }}>Created</span>
                            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)" }}>{formatToDDMMYYYY(lead.createdAt)}</span>
                          </div>
                        </div>
                        
                        {lead.remark && (
                          <div style={{ background: "rgba(0,0,0,0.02)", borderLeft: "3px solid var(--primary-light)", padding: "12px 16px", borderRadius: "0 8px 8px 0", fontSize: 14, color: "var(--text-secondary)", fontStyle: "italic", lineHeight: "1.5" }}>
                            "{lead.remark}"
                          </div>
                        )}
                      </div>
                      
                      <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "flex-start", flex: "1 1 240px", minWidth: 0, width: "100%", maxWidth: "100%" }}>
                        {(() => {
                          const totalCount = getLeadFollowUpCount(lead);
                          const fu = getFollowUpInputsState(lead);
                          const activeStep = getMatchingStepForDate(lead, selectedDate);
                          return (
                            <>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", width: "100%", justifyContent: "space-between" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                  <span style={{ 
                                    background: "rgba(37, 99, 235, 0.1)", 
                                    color: "var(--primary, #2563eb)", 
                                    padding: "3px 10px", 
                                    borderRadius: "14px", 
                                    fontSize: 11, 
                                    fontWeight: 700, 
                                    letterSpacing: "0.3px",
                                    border: "1px solid rgba(37, 99, 235, 0.2)"
                                  }}>
                                    {totalCount} Follow-Up{totalCount === 1 ? '' : 's'}
                                  </span>
                                  {activeStep > 0 && (
                                    <span style={{ 
                                      background: "var(--primary, #2563eb)", 
                                      color: "#fff", 
                                      padding: "3px 8px", 
                                      borderRadius: "14px", 
                                      fontSize: 10, 
                                      fontWeight: 700, 
                                      letterSpacing: "0.3px" 
                                    }}>
                                      Step #{activeStep}
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setTimelineLead(lead)}
                                  className="btn btn-ghost"
                                  style={{
                                    fontSize: 12,
                                    padding: "3px 10px",
                                    height: "auto",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 5,
                                    color: "var(--primary, #2563eb)",
                                    fontWeight: 600,
                                    borderRadius: 6,
                                    borderColor: "rgba(37, 99, 235, 0.2)"
                                  }}
                                  title="View complete follow-up timeline"
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                  </svg>
                                  View Timeline
                                </button>
                              </div>

                              <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", marginTop: "auto" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(0,0,0,0.02)", padding: "8px 12px", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.05)", transition: "all 0.2s ease", ...(isLeadLocked ? { opacity: 0.65 } : {}) }}>
                                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", minWidth: "18px" }}>{fu.label1}</span>
                                  <input 
                                    type="date" 
                                    value={fu.val1} 
                                    onChange={(e) => handleFollowUpChange(lead, false, e.target.value, fu.step1)}
                                    disabled={isLeadLocked}
                                    title={isLeadLocked ? `Locked by ${lead.handledBy}` : undefined}
                                    style={{ border: "none", background: "transparent", cursor: isLeadLocked ? "not-allowed" : "pointer", fontSize: "13px", outline: "none", flex: 1, color: "var(--text-primary)", fontWeight: 500, fontFamily: "inherit" }}
                                  />
                                  {fu.val1 && !isLeadLocked && (
                                    <button
                                      type="button"
                                      onClick={() => handleFollowUpChange(lead, false, "", fu.step1)}
                                      title={`Clear follow-up ${fu.label1}`}
                                      style={{
                                        background: "none",
                                        border: "none",
                                        color: "var(--text-secondary)",
                                        cursor: "pointer",
                                        padding: "0 4px",
                                        fontSize: "16px",
                                        lineHeight: 1,
                                        fontWeight: "bold",
                                        opacity: 0.7,
                                        transition: "opacity 0.15s, color 0.15s"
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.color = "#ef4444";
                                        e.currentTarget.style.opacity = "1";
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.color = "var(--text-secondary)";
                                        e.currentTarget.style.opacity = "0.7";
                                      }}
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(0,0,0,0.02)", padding: "8px 12px", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.05)", transition: "all 0.2s ease", ...(isLeadLocked ? { opacity: 0.65 } : {}) }}>
                                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", minWidth: "18px" }}>{fu.label2}</span>
                                  <input 
                                    type="date" 
                                    value={fu.val2} 
                                    onChange={(e) => handleFollowUpChange(lead, true, e.target.value, fu.step2)}
                                    disabled={isLeadLocked}
                                    title={isLeadLocked ? `Locked by ${lead.handledBy}` : undefined}
                                    style={{ border: "none", background: "transparent", cursor: isLeadLocked ? "not-allowed" : "pointer", fontSize: "13px", outline: "none", flex: 1, color: "var(--text-primary)", fontWeight: 500, fontFamily: "inherit" }}
                                  />
                                </div>
                              </div>
                            </>
                          );
                        })()}
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

      {/* Follow-Up Timeline Modal */}
      {timelineLead && (
        <div className="modal-overlay" onClick={() => setTimelineLead(null)} style={{ zIndex: 1000 }}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20 }}>Follow-Up Timeline</h2>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                  {timelineLead.name} • {parsePhoneNumber(timelineLead.phone)}
                </div>
              </div>
              <span style={{
                padding: "4px 10px",
                borderRadius: "16px",
                fontSize: 12,
                fontWeight: 700,
                background: "var(--primary-light, #3b82f6)",
                color: "#fff"
              }}>
                {getLeadFollowUpCount(timelineLead)} Total Follow-Up{getLeadFollowUpCount(timelineLead) === 1 ? "" : "s"}
              </span>
            </div>

            {/* Basic lead info */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, padding: "10px 14px", background: "rgba(0,0,0,0.02)", borderRadius: 8, marginBottom: 20, fontSize: 12 }}>
              {timelineLead.carModel && <div><strong>Model:</strong> {timelineLead.carModel}</div>}
              {timelineLead.branch && <div><strong>Branch:</strong> {timelineLead.branch}</div>}
              <div><strong>Status:</strong> {formatStatusLabel(timelineLead.status)}</div>
              {timelineLead.handledBy && <div><strong>Handled By:</strong> {timelineLead.handledBy}</div>}
              <div><strong>Consultant:</strong> {timelineLead.assignedConsultant || "Unassigned"}</div>
              <div><strong>Test Drive:</strong> {timelineLead.testDrive || "Not Scheduled"}</div>
              <div><strong>Created:</strong> {formatToDDMMYYYY(timelineLead.createdAt)}</div>
            </div>

            {/* Timeline items */}
            {(() => {
              const followUps = getLeadFollowUps(timelineLead);
              if (followUps.length === 0) {
                return (
                  <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-secondary)", fontSize: 13 }}>
                    No follow-ups recorded yet for this lead.
                  </div>
                );
              }
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "relative", paddingLeft: 22, borderLeft: "2px solid var(--border)", marginLeft: 6 }}>
                  {followUps.map((fu, idx) => {
                    const isLatest = idx === followUps.length - 1;
                    const formattedDate = formatToDDMMYYYY(fu.date);
                    const isLocked = checkIsLeadLocked(timelineLead);
                    return (
                      <div key={fu.id || idx} style={{ position: "relative" }}>
                        {/* Node dot */}
                        <div style={{
                          position: "absolute",
                          left: -29,
                          top: 4,
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          background: isLatest ? "var(--primary, #2563eb)" : "var(--border, #cbd5e1)",
                          border: "2px solid #fff",
                          boxShadow: isLatest ? "0 0 0 2px rgba(37, 99, 235, 0.3)" : "none"
                        }} />
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>
                            Follow-Up #{fu.step || idx + 1}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{
                              fontWeight: 700,
                              fontSize: 13,
                              fontFamily: "monospace",
                              background: "rgba(37, 99, 235, 0.08)",
                              color: "var(--primary, #2563eb)",
                              padding: "2px 8px",
                              borderRadius: 6
                            }}>
                              {formattedDate}
                            </div>
                            {!isLocked && (
                              <button
                                type="button"
                                onClick={() => handleFollowUpChange(timelineLead, false, "", fu.step || idx + 1)}
                                title={`Delete follow-up #${fu.step || idx + 1}`}
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "var(--text-secondary)",
                                  cursor: "pointer",
                                  padding: "2px 6px",
                                  fontSize: "16px",
                                  lineHeight: 1,
                                  fontWeight: "bold",
                                  borderRadius: 4,
                                  opacity: 0.7,
                                  transition: "all 0.15s ease"
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = "#ef4444";
                                  e.currentTarget.style.opacity = "1";
                                  e.currentTarget.style.background = "rgba(239, 68, 68, 0.08)";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = "var(--text-secondary)";
                                  e.currentTarget.style.opacity = "0.7";
                                  e.currentTarget.style.background = "none";
                                }}
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </div>
                        {fu.createdAt && (
                          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                            Logged: {formatToDDMMYYYY(fu.createdAt)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {timelineLead.remark && (
              <div style={{ marginTop: 20, padding: "10px 14px", background: "rgba(0,0,0,0.02)", borderLeft: "3px solid var(--primary-light)", borderRadius: "0 8px 8px 0", fontSize: 13, color: "var(--text-secondary)" }}>
                <strong>Remark:</strong> {timelineLead.remark}
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-primary" onClick={() => setTimelineLead(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Lead Modal */}
      {selectedLead && (
        <div className="modal-overlay" onClick={() => setSelectedLead(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Lead Details</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
              <div><strong>Name:</strong> {selectedLead.name}</div>
              <div><strong>Phone:</strong> {parsePhoneNumber(selectedLead.phone)}</div>
              <div><strong>Status:</strong> {formatStatusLabel(selectedLead.status)}</div>
              <div><strong>Handled By:</strong> {selectedLead.handledBy || "Not handled"}</div>
              <div><strong>Assigned Consultant:</strong> {selectedLead.assignedConsultant || "Unassigned"}</div>
              <div><strong>Test Drive:</strong> {selectedLead.testDrive || "Not Scheduled"}</div>
              {selectedLead.carModel && <div><strong>Model:</strong> {selectedLead.carModel}</div>}
              {selectedLead.branch && <div><strong>Branch:</strong> {selectedLead.branch}</div>}
              {selectedLead.remark && <div><strong>Remark:</strong> {selectedLead.remark}</div>}
              {selectedLead.followUpDate1 && <div><strong>Follow Up 1:</strong> {formatToDDMMYYYY(selectedLead.followUpDate1)}</div>}
              {selectedLead.followUpDate2 && <div><strong>Follow Up 2:</strong> {formatToDDMMYYYY(selectedLead.followUpDate2)}</div>}
            </div>
            <div className="modal-actions" style={{ marginTop: 24 }}>
              <button className="btn btn-primary" onClick={() => setSelectedLead(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && <div className={`toast ${toast.type}`}>{toast.message}</div>}
    </>
  );
}
