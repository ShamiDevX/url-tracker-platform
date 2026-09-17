'use client'

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Globe, Home, Link as LinkIcon, MapPin, MessageCircle, Menu, LogOut } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { SiteBrandName } from "@/components/SiteBrandName";
import { useAuth } from "@/components/AuthProvider";

const navItems = [
  { href: '/', icon: Home, label: 'Overview', exact: true },
  { href: '/locations', icon: MapPin, label: 'Locations', exact: false },
  { href: '/share-links', icon: LinkIcon, label: 'Share Links', exact: false },
  { href: '/whatsapp', icon: MessageCircle, label: 'WhatsApp', exact: false },
];

const NavContent = ({ pathname }: { pathname: string }) => {
  const { logout } = useAuth();

  return (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-border/60 shrink-0">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary shrink-0">
          <Globe className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <SiteBrandName className="font-bold text-sm tracking-tight" />
      </div>

      {/* Navigation */}
      <div className="flex-1 px-3 py-4 overflow-y-auto">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 px-3 mb-2">
          Menu
        </p>
        <nav className="space-y-0.5">
          {navItems.map(({ href, icon: Icon, label, exact }) => {
            const isActive = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link key={href} href={href}>
                <div className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}>
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </div>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border/60 shrink-0 space-y-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-xs text-muted-foreground">Live sync</span>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-destructive transition-colors w-full px-1 py-1 rounded"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

const Sidebar = () => {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:flex flex-col w-56 border-r border-border/60 bg-background h-screen shrink-0">
        <NavContent pathname={pathname} />
      </div>

      {/* Mobile */}
      <div className="md:hidden fixed top-0 left-0 z-50">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="fixed top-3 left-3 z-50 h-8 w-8 shadow-sm"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-56 p-0">
            <NavContent pathname={pathname} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
};

export default Sidebar;
