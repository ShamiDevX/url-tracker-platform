export interface LocationHistoryEntry {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    locationSource: 'gps' | 'ip';
    /** Unix ms; written with Firebase `serverTimestamp()` from /track, resolved to a number when read. */
    ts: number;
    /**
     * Milliseconds the page was hidden/backgrounded immediately before this ping was written.
     * Used to break the polyline on resume so we don't draw straight lines across
     * unobservable intervals. Only present when the gap exceeds the configured threshold.
     */
    gapBeforeMs?: number | null;
    /**
     * True when this entry was written as a pause marker (page hidden / pagehide / freeze).
     * Clients MAY treat it as a terminal "last-known" position for the hidden segment.
     */
    paused?: boolean | null;
    /**
     * True when this entry was a heartbeat (no new GPS fix, coords copied from the last ping
     * to confirm the tab is still alive). Heartbeats are useful for liveness detection.
     */
    heartbeat?: boolean | null;
}

// Location Interface
export interface Location {
    id?: string;
    latitude?: number | null;
    longitude?: number | null;
    nickname?: string | null;
    applicantName?: string | null;
    applicantPhone?: string | null;
    userId?: string | null;
    shareLinkId?: string | null;
    ip?: string | null;
    deviceId?: string | null;
    deviceType?: string;
    userAgent?: string;
    screenWidth?: number;
    screenHeight?: number;
    referrer?: string;
    userLanguage?: string;
    userTimezone?: string;
    updatedAt?: number;
    createdAt?: number;

    // Location source & status flags
    locationSource?: 'gps' | 'ip';
    locationStatus?: 'gps_verified' | 'ip_fallback' | 'permission_denied' | 'unsupported' | 'timeout' | null;
    locationIssueMessage?: string | null;

    // IP geolocation (populated when locationSource === 'ip', or as enrichment)
    ipCity?: string | null;
    ipRegion?: string | null;
    ipCountry?: string | null;
    ipIsp?: string | null;
    ipAccuracy?: string | null; // e.g. "city-level"

    // Movement history — each entry is a timestamped position update
    history?: LocationHistoryEntry[];

    /**
     * Unix ms of the most recent `visibilitychange → hidden` or `pagehide` write from /track.
     * When > updatedAt, the visitor tab is currently backgrounded (best-effort; not guaranteed).
     */
    backgroundedAt?: number | null;
    /**
     * Unix ms of the most recent foreground event from /track.
     * When > backgroundedAt, the visitor tab is currently active.
     */
    foregroundedAt?: number | null;
    /**
     * Unix ms of the most recent heartbeat write (liveness signal while visible but static).
     */
    lastHeartbeatAt?: number | null;
    /**
     * Best-effort session state as reported by the tracker tab.
     * - 'active' → tab visible, watching GPS
     * - 'hidden' → tab backgrounded, will not update until the user returns
     * - 'ended'  → tab unloaded (pagehide fired without resume)
     */
    sessionState?: 'active' | 'hidden' | 'ended' | null;

    // Device fingerprint
    batteryLevel?: number | null;       // 0–100
    batteryCharging?: boolean | null;
    networkType?: string | null;        // "4g" | "3g" | "2g" | "slow-2g"
    networkDownlink?: number | null;    // Mbps
    networkRtt?: number | null;         // ms
    hardwareConcurrency?: number | null; // CPU cores
    deviceMemory?: number | null;       // GB (approximate)
    maxTouchPoints?: number | null;
    platform?: string | null;
}
