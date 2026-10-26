// Single Source of Truth for Navratri Special Offer
import { useState, useEffect } from 'react';

export interface NavratriOfferConfig {
  code: string;
  discountPercent: number;
  headline: string;
  subheadline: string;
  validityText: string;
  timezone: string;
  startTimestamp: number;
  endTimestamp: number;
}

/**
 * Offer validity:
 * Start: 11 October 2026, 12:00 AM IST (2026-10-11T00:00:00+05:30 -> 1791657000000 ms)
 * End:   20 October 2026, 11:59:59.999 PM IST (boundary: 21 October 2026, 00:00:00 IST -> 1792521000000 ms)
 * Timezone: Asia/Kolkata (UTC+05:30)
 */
export const NAVRATRI_OFFER_CONFIG: NavratriOfferConfig = {
  code: 'Navratri10%',
  discountPercent: 10,
  headline: 'Navratri Special — Get 10% OFF on Modular Kitchens',
  subheadline: 'Celebrate this auspicious festive season with precision-engineered modular kitchens in Dehradun. 100% waterproof BWP ply, German fittings & 10-year warranty.',
  validityText: '11 October 2026, 12:00 AM IST – 20 October 2026, 11:59 PM IST',
  timezone: 'Asia/Kolkata',
  // Exact IST Milliseconds Timestamps
  startTimestamp: 1791657000000, // 2026-10-11T00:00:00+05:30
  endTimestamp: 1792521000000,   // 2026-10-21T00:00:00+05:30 (Boundary through 20 Oct 11:59:59.999 PM IST)
};

export interface OfferStatus {
  isActive: boolean;
  isPending: boolean;
  isExpired: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  statusLabel: string;
}

/**
 * Calculates the exact offer status based on Indian Standard Time
 */
export function getNavratriOfferStatus(customNow?: number): OfferStatus {
  const now = typeof customNow === 'number' ? customNow : Date.now();
  const { startTimestamp, endTimestamp } = NAVRATRI_OFFER_CONFIG;

  if (now >= endTimestamp) {
    return {
      isActive: false,
      isPending: false,
      isExpired: true,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      statusLabel: 'Offer Expired',
    };
  }

  if (now < startTimestamp) {
    const diff = Math.max(0, startTimestamp - now);
    return {
      isActive: false,
      isPending: true,
      isExpired: false,
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((diff % (1000 * 60)) / 1000),
      statusLabel: 'Offer Starts Soon',
    };
  }

  // Active Offer window
  const diff = Math.max(0, endTimestamp - now);
  return {
    isActive: true,
    isPending: false,
    isExpired: false,
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
    statusLabel: 'Offer Active',
  };
}

/**
 * Validates whether a claimed offer code is currently eligible
 */
export function validateOfferClaim(claimedCode: string, customNow?: number): {
  valid: boolean;
  error?: string;
  isExpired?: boolean;
} {
  const clean = (claimedCode || '').trim();
  if (!clean) return { valid: true };

  const isNavratriMatch = clean.toLowerCase() === NAVRATRI_OFFER_CONFIG.code.toLowerCase() ||
                          clean.toLowerCase() === 'navratri10' ||
                          clean.toLowerCase() === 'navratri10%';

  if (!isNavratriMatch) {
    return { valid: false, error: `Invalid offer code "${claimedCode}".` };
  }

  const status = getNavratriOfferStatus(customNow);
  if (status.isExpired) {
    return {
      valid: false,
      isExpired: true,
      error: 'The Navratri Special Offer has expired. You can still submit an enquiry without this discount code.',
    };
  }

  if (status.isPending) {
    return {
      valid: false,
      error: 'The Navratri Special Offer starts on 11 October 2026, 12:00 AM IST.',
    };
  }

  return { valid: true };
}

/**
 * Custom hook providing live 1-second interval countdown
 */
export function useNavratriCountdown(): OfferStatus {
  const [status, setStatus] = useState<OfferStatus>(() => getNavratriOfferStatus());

  useEffect(() => {
    // Initial sync
    setStatus(getNavratriOfferStatus());

    const interval = setInterval(() => {
      const current = getNavratriOfferStatus();
      setStatus(current);
      if (current.isExpired) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return status;
}
