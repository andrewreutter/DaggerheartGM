import { useState, useEffect, useCallback, useId } from 'react';
import { Heart, CheckCircle, Clock, AlertCircle, ShieldCheck } from 'lucide-react';
import { FullPageOverlay, FullPageOverlayHeader } from './FullPageOverlay.jsx';
import { fetchTableBillingStatus, postCampaignPassCheckout } from '../lib/api.js';

/** Prices in cents, keyed by months. */
const PASS_PRICES = { 3: 20, 6: 35, 12: 60 };

/** Human-readable month labels. */
const PASS_LABELS = { 3: '3 months', 6: '6 months', 12: '12 months' };

/**
 * Format an ISO-8601 date string as "Oct 14, 2026".
 * @param {string | null} iso
 */
function formatDate(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return null;
  }
}

/**
 * Days remaining until an ISO-8601 date (rounded down, minimum 0).
 * @param {string | null} iso
 */
function daysUntil(iso) {
  if (!iso) return null;
  const diff = new Date(iso) - Date.now();
  return Math.max(0, Math.floor(diff / 86400000));
}

/**
 * Status pill rendered below the "Gift a Campaign Pass" heading.
 * @param {{ isLive: boolean, reason: string, trialEndsAt: string|null, paidThroughAt: string|null } | null} billing
 * @param {boolean} loading
 */
function BillingStatusPill({ billing, loading }) {
  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-dh-muted animate-pulse">
        <Clock size={12} aria-hidden />
        <span>Loading status…</span>
      </div>
    );
  }
  if (!billing) return null;

  if (billing.isLive && billing.reason === 'campaign_pass' && billing.paidThroughAt) {
    const date = formatDate(billing.paidThroughAt);
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
        <CheckCircle size={12} aria-hidden />
        <span>Covered through {date}</span>
      </div>
    );
  }

  if (billing.isLive && billing.reason === 'free_trial' && billing.trialEndsAt) {
    const days = daysUntil(billing.trialEndsAt);
    const date = formatDate(billing.trialEndsAt);
    const urgent = days <= 7;
    return (
      <div className={`flex items-center gap-1.5 text-[11px] ${urgent ? 'text-amber-400' : 'text-dh-muted'}`}>
        <Clock size={12} aria-hidden />
        <span>Free trial ends {days === 0 ? 'today' : `in ${days} day${days !== 1 ? 's' : ''}`} ({date})</span>
      </div>
    );
  }

  if (!billing.isLive) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-red-400">
        <AlertCircle size={12} aria-hidden />
        <span>
          {billing.reason === 'trial_expired' ? 'Free trial has ended' : 'Pass expired — sessions are paused'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-[11px] text-dh-muted">
      <Clock size={12} aria-hidden />
      <span>Trial not yet started</span>
    </div>
  );
}

/**
 * "Support this table" / "Gift a Campaign Pass" modal.
 *
 * Props:
 *   open            — whether the modal is visible
 *   onClose         — called when user closes
 *   tableId         — which table to purchase for
 *   tableName       — display name of the table
 *   gmDisplayName   — display name of the GM
 *   isAdmin         — when true, the Purchase button grants a free pass (admin bypass, no Stripe)
 */
export function SupportTableModal({ open, onClose, tableId, tableName, gmDisplayName, isAdmin = false }) {
  const titleId = useId();

  const [selectedMonths, setSelectedMonths] = useState(6);
  const [billing, setBilling] = useState(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [grantSuccess, setGrantSuccess] = useState(false);

  const loadBilling = useCallback(() => {
    if (!tableId) return;
    setBillingLoading(true);
    fetchTableBillingStatus(tableId)
      .then(setBilling)
      .catch(() => setBilling(null))
      .finally(() => setBillingLoading(false));
  }, [tableId]);

  useEffect(() => {
    if (open && tableId) {
      loadBilling();
      setGrantSuccess(false);
    }
  }, [open, tableId, loadBilling]);

  const handleCheckout = async () => {
    if (!tableId || checkoutLoading) return;
    setCheckoutError(null);
    setGrantSuccess(false);
    setCheckoutLoading(true);
    try {
      const result = await postCampaignPassCheckout(tableId, selectedMonths);
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      // Admin free grant — no redirect; refresh billing status in place.
      setCheckoutLoading(false);
      setGrantSuccess(true);
      loadBilling();
    } catch (err) {
      setCheckoutError(err.message || 'Something went wrong. Please try again.');
      setCheckoutLoading(false);
    }
  };

  const displayGm = gmDisplayName || 'the GM';
  const displayTable = tableName || 'this table';

  return (
    <FullPageOverlay
      open={open}
      onClose={onClose}
      maxWidthClass="max-w-lg"
      heightClass="h-auto"
      ariaLabelledBy={titleId}
    >
      <FullPageOverlayHeader
        title="Support this table"
        titleId={titleId}
        icon={Heart}
        onClose={onClose}
      />

      <div className="flex flex-col gap-5 overflow-y-auto p-5">
        {/* Who/what is being paid for */}
        <div className="rounded-lg border border-dh-strong bg-dh-raised/60 px-4 py-3 space-y-1">
          <p className="text-sm font-semibold text-dh">
            Gift a Campaign Pass to <span className="text-sky-400">{displayGm}</span>'s table:{' '}
            <span className="text-sky-400">{displayTable}</span>
          </p>
          <div role="status" aria-live="polite">
            <BillingStatusPill billing={billing} loading={billingLoading} />
          </div>
        </div>

        {/* Explainer */}
        <p className="text-[12px] text-dh-muted leading-relaxed">
          A Campaign Pass keeps this table active so everyone can keep playing. Anyone — the GM or a
          player — can gift a pass. Ownership of the table never changes.
        </p>

        {/* Pass length picker */}
        <div className="space-y-2">
          <p id={`${titleId}-pass-length`} className="text-[11px] font-semibold uppercase tracking-widest text-dh-muted">
            Choose a pass length
          </p>
          <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby={`${titleId}-pass-length`}>
            {[3, 6, 12].map((months) => (
              <button
                key={months}
                type="button"
                onClick={() => setSelectedMonths(months)}
                className={`flex flex-col items-center gap-0.5 rounded-lg border px-3 py-3 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  selectedMonths === months
                    ? 'border-sky-500 bg-sky-950/40 text-sky-300'
                    : 'border-dh-strong bg-dh-raised/40 text-dh hover:border-sky-600/60 hover:bg-dh-hover'
                }`}
                aria-pressed={selectedMonths === months}
              >
                <span className="text-base font-bold">${PASS_PRICES[months]}</span>
                <span className="text-[11px] opacity-70">{PASS_LABELS[months]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Error message */}
        {checkoutError && (
          <div className="flex items-start gap-2 rounded-lg border border-red-700/50 bg-red-950/30 px-3 py-2" role="alert">
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-400" aria-hidden />
            <p className="text-[12px] text-red-300">{checkoutError}</p>
          </div>
        )}

        {/* Admin grant success confirmation */}
        {grantSuccess && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-700/50 bg-emerald-950/30 px-3 py-2" role="status">
            <CheckCircle size={14} className="shrink-0 text-emerald-400" aria-hidden />
            <p className="text-[12px] text-emerald-300">
              Pass granted — {PASS_LABELS[selectedMonths]} added to this table.
            </p>
          </div>
        )}

        {/* Checkout / grant button */}
        <button
          type="button"
          onClick={handleCheckout}
          disabled={checkoutLoading}
          className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {checkoutLoading
            ? (isAdmin ? 'Granting pass…' : 'Redirecting to checkout…')
            : isAdmin
              ? `Grant ${PASS_LABELS[selectedMonths]} (Admin)`
              : `Purchase ${PASS_LABELS[selectedMonths]} — $${PASS_PRICES[selectedMonths]}`}
        </button>

        <p className="text-center text-[11px] text-dh-muted">
          {isAdmin
            ? <span className="flex items-center justify-center gap-1"><ShieldCheck size={11} aria-hidden />Admin grant — no payment required.</span>
            : 'Secure checkout via Stripe. One-time payment — never a subscription.'}
        </p>
      </div>
    </FullPageOverlay>
  );
}
