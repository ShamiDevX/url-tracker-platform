'use client'

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MapPin, Link as LinkIcon, Users, Activity,
  ArrowRight, MessageCircle, Clock, Globe,
  TrendingUp, Wifi, LogOut
} from 'lucide-react';
import { database } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import { Location } from "@/components/interfaces/location.interface";
import dynamic from 'next/dynamic';
import { SiteBrandName } from "@/components/SiteBrandName";
import { momentAgo, eventTimeMsForSort } from "@/lib/momentAgo";
import { normalizeEventMs } from "@/lib/timestamp-ms";
import { useRelativeTimeTick } from "@/lib/use-relative-time-tick";
import AuthProvider, { useAuth } from "@/components/AuthProvider";

const Map = dynamic(() => import('@/components/Map'), { ssr: false });

function locRecencyMs(loc: Location): number {
  return Math.max(eventTimeMsForSort(loc.updatedAt), eventTimeMsForSort(loc.createdAt));
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
  sub?: string;
}

function StatCard({ label, value, icon, accent, sub }: StatCardProps) {
  return (
    <Card className="relative overflow-hidden border-border/60 hover:border-border transition-colors">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
            <p className="text-3xl font-bold tabular-nums">{value.toLocaleString()}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`p-2.5 rounded-lg ${accent}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function HomeContent() {
  const { logout } = useAuth();
  const [totalLocations, setTotalLocations] = useState(0);
  const [activeShareLinks, setActiveShareLinks] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [userLocations, setUserLocations] = useState<Location[]>([]);

  const dayAgo = Date.now() - 86_400_000;
  const recentLocations = userLocations.filter((l) => {
    const ms = normalizeEventMs(l.updatedAt ?? l.createdAt);
    return ms != null && ms > dayAgo;
  }).length;

  const recentFeed = [...userLocations]
    .sort((a, b) => locRecencyMs(b) - locRecencyMs(a))
    .slice(0, 8);

  useEffect(() => {
    const locationsRef = ref(database, 'locations');
    const shareLinksRef = ref(database, 'shareLinks');
    const usersRef = ref(database, 'users');

    const unsubLocations = onValue(locationsRef, (snap) => {
      const data = snap.val();
      if (data) {
        const arr = Object.entries(data).map(([id, loc]) => ({ id, ...(loc as Location) }));
        setUserLocations(arr);
        setTotalLocations(arr.length);
      } else {
        setUserLocations([]);
        setTotalLocations(0);
      }
    });

    const unsubLinks = onValue(shareLinksRef, (snap) => {
      const data = snap.val();
      setActiveShareLinks(data ? Object.keys(data).length : 0);
    });

    const unsubUsers = onValue(usersRef, (snap) => {
      const data = snap.val();
      setTotalUsers(data ? Object.keys(data).length : 0);
    });

    return () => { unsubLocations(); unsubLinks(); unsubUsers(); };
  }, []);

  return (
    <div className="min-h-screen bg-background">

      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
              <Globe className="h-4 w-4 text-primary-foreground" />
            </div>
            <SiteBrandName className="font-bold text-lg tracking-tight" />
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="gap-1.5 text-xs font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              Live
            </Badge>
            <Link href="/locations">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                Dashboard
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
            <Button
              size="sm"
              variant="ghost"
              onClick={logout}
              className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* Hero Section */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
            <p className="text-muted-foreground mt-1">Real-time location intelligence — all signals in one place.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Wifi className="h-3.5 w-3.5" />
            <span>Synced with Firebase</span>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Locations"
            value={totalLocations}
            icon={<MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
            accent="bg-blue-50 dark:bg-blue-950"
          />
          <StatCard
            label="Share Links"
            value={activeShareLinks}
            icon={<LinkIcon className="h-4 w-4 text-violet-600 dark:text-violet-400" />}
            accent="bg-violet-50 dark:bg-violet-950"
          />
          <StatCard
            label="Users"
            value={totalUsers}
            icon={<Users className="h-4 w-4 text-orange-600 dark:text-orange-400" />}
            accent="bg-orange-50 dark:bg-orange-950"
          />
          <StatCard
            label="Last 24h"
            value={recentLocations}
            sub="new pings"
            icon={<TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />}
            accent="bg-green-50 dark:bg-green-950"
          />
        </div>

        {/* Map + Activity Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Map */}
          <Card className="lg:col-span-2 border-border/60 overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Global Map</span>
              </div>
              <Badge variant="secondary" className="text-xs tabular-nums">
                {totalLocations} signals
              </Badge>
            </div>
            <div className="h-[380px]">
              <Map
                userLocations={userLocations}
                style={{ height: "380px", width: "100%" }}
                zoom={2}
              />
            </div>
          </Card>

          {/* Activity Feed */}
          <Card className="border-border/60 flex flex-col">
            <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Recent Activity</span>
              </div>
              <Link href="/locations">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2">
                  View all <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-border/40">
              {recentFeed.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                  <MapPin className="h-8 w-8 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No locations yet</p>
                </div>
              ) : (
                recentFeed.map((loc) => (
                  <div key={loc.id} className="px-5 py-3.5 flex items-start gap-3 hover:bg-muted/30 transition-colors">
                    <div className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {loc.nickname ?? loc.ip ?? 'Unknown'}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {loc.userTimezone && (
                          <span className="text-xs text-muted-foreground truncate max-w-[110px]">
                            {loc.userTimezone}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <Clock className="h-3 w-3" />
                      {momentAgo(loc.updatedAt ?? loc.createdAt)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                href: '/locations',
                icon: <MapPin className="h-5 w-5" />,
                label: 'Manage Locations',
                description: 'View, edit and delete tracked pings',
                accent: 'hover:border-blue-300 dark:hover:border-blue-800',
              },
              {
                href: '/share-links',
                icon: <LinkIcon className="h-5 w-5" />,
                label: 'Share Links',
                description: 'Create and manage tracking links',
                accent: 'hover:border-violet-300 dark:hover:border-violet-800',
              },
              {
                href: '/whatsapp',
                icon: <MessageCircle className="h-5 w-5" />,
                label: 'WhatsApp',
                description: 'Send locations via WhatsApp',
                accent: 'hover:border-green-300 dark:hover:border-green-800',
              },
            ].map(({ href, icon, label, description, accent }) => (
              <Link key={href} href={href}>
                <Card className={`border-border/60 cursor-pointer transition-all ${accent} hover:shadow-sm group`}>
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className="text-muted-foreground group-hover:text-foreground transition-colors">
                      {icon}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{label}</p>
                      <p className="text-xs text-muted-foreground truncate">{description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

export default function Home() {
  useRelativeTimeTick();
  return (
    <AuthProvider>
      <HomeContent />
    </AuthProvider>
  );
}

