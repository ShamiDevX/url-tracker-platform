import { Metadata } from 'next';
import { database } from "@/lib/firebase";
import { ref, get } from "firebase/database";
import { ShareLink } from "@/components/interfaces/sharelink.interface";
import { getSiteOriginFromHeaders } from "@/lib/site-url-server";
import TrackClient from './TrackClient';
import { Suspense } from 'react';

export async function generateMetadata(
  { searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }
): Promise<Metadata> {
  const id = (searchParams?.id as string) || "";
  const origin = getSiteOriginFromHeaders();

  let shareLink: ShareLink | null = null;
  if (id) {
    try {
      const shareLinkRef = ref(database, `shareLinks/${id}`);
      const snapshot = await get(shareLinkRef);
      if (snapshot.exists()) {
        shareLink = snapshot.val() as ShareLink;
      }
    } catch {
      /* fallback */
    }
  }

  const title =
    shareLink?.title?.trim() ||
    shareLink?.name?.trim() ||
    "Job Opening - Verified Opportunity";
  const description =
    shareLink?.description?.trim() ||
    "We are currently hiring candidates in your area. Good compensation, flexible schedule, and immediate training provided.";

  const rawImage = shareLink?.imageUrl?.trim();
  let absoluteImageUrl: string | null = null;

  if (rawImage) {
    if (rawImage.startsWith("http://") || rawImage.startsWith("https://")) {
      absoluteImageUrl = rawImage;
    } else {
      absoluteImageUrl = `${origin.replace(/\/$/, "")}${rawImage.startsWith("/") ? "" : "/"}${rawImage}`;
    }
  }

  const isPng = absoluteImageUrl?.toLowerCase().endsWith(".png");
  const isJpeg =
    absoluteImageUrl?.toLowerCase().endsWith(".jpg") ||
    absoluteImageUrl?.toLowerCase().endsWith(".jpeg");
  const imageType = isPng ? "image/png" : isJpeg ? "image/jpeg" : undefined;

  const ogImages = absoluteImageUrl
    ? [
        {
          url: absoluteImageUrl,
          secureUrl: absoluteImageUrl,
          width: 1200,
          height: 630,
          alt: title,
          ...(imageType ? { type: imageType } : {}),
        },
      ]
    : [];

  return {
    title,
    description,
    openGraph: {
      type: "website",
      siteName: "Careers & Openings",
      title,
      description,
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: absoluteImageUrl ? [absoluteImageUrl] : [],
    },
  };
}

export default function TrackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-400">
          Loading...
        </div>
      }
    >
      <TrackClient />
    </Suspense>
  );
}
