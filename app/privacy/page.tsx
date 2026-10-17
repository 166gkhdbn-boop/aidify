import type { Metadata } from "next";
import {
  Bell,
  Database,
  History,
  ShieldCheck,
  User,
  EyeOff,
} from "lucide-react";
import { LegalPage, type LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Aidify's Privacy Policy: what data we store — configurations, activity logs, security events — and why.",
};

const SECTIONS: LegalSection[] = [
  {
    icon: Database,
    title: "Data we store",
    body: (
      <>
        <p>
          Aidify stores only what the platform needs to function. Everything
          you create lives in your own workspace:
        </p>
        <ul>
          <li>
            <strong>Configurations and collections</strong> — the names,
            descriptions, environments, tags, and JSON data you enter, plus
            every version snapshot (data, change summary, author, timestamp).
          </li>
          <li>
            <strong>Account and profile</strong> — your email address, display
            name, and username. Passwords are never stored by Aidify; they are
            handled exclusively by our authentication provider (Supabase Auth)
            as salted hashes.
          </li>
          <li>
            <strong>Activity logs</strong> — a record of actions you take
            (creating, updating, or archiving a configuration) so you can
            review your own history.
          </li>
          <li>
            <strong>Security events</strong> — sign-ins, failed sign-in
            attempts, registrations, and password resets, together with the IP
            address and user agent, used to detect abuse and keep accounts
            safe.
          </li>
          <li>
            <strong>Support tickets</strong> — the subject, description, and
            replies of tickets you open with us.
          </li>
        </ul>
      </>
    ),
  },
  {
    icon: EyeOff,
    title: "Why we store it",
    body: (
      <>
        <p>
          Each category exists for a concrete reason — there is no tracking for
          advertising and no sale of personal data:
        </p>
        <ul>
          <li>Configurations and versions are the product itself.</li>
          <li>
            Activity and audit logs provide accountability: who changed what,
            and when.
          </li>
          <li>
            Security events let us rate-limit brute-force attempts and let you
            review your own sign-in history.
          </li>
          <li>Support tickets exist only so we can answer them.</li>
        </ul>
      </>
    ),
  },
  {
    icon: User,
    title: "Your control",
    body: (
      <>
        <p>
          You can update your display name and review your activity and
          security history at any time from your account settings. Deleting
          your account removes your profile and personal data; configuration
          content you created is removed with it. Audit and security records
          required for platform integrity may be retained in anonymized form
          where the law requires it.
        </p>
      </>
    ),
  },
  {
    icon: History,
    title: "Retention",
    body: (
      <>
        <p>
          Version snapshots are kept for as long as the configuration exists —
          restoring an older version is a core feature. When you delete a
          configuration, its versions are deleted with it. Backups of the
          database may retain deleted data for a limited rotation window
          before being overwritten.
        </p>
      </>
    ),
  },
  {
    icon: ShieldCheck,
    title: "Security",
    body: (
      <>
        <p>
          Access is enforced server-side on every page and action; the browser
          is never trusted with authorization decisions. Authentication uses
          industry-standard session handling with automatic refresh, and
          authentication endpoints are rate-limited. No credentials are ever
          stored in source code or client bundles.
        </p>
      </>
    ),
  },
  {
    icon: Bell,
    title: "Changes to this policy",
    body: (
      <p>
        If this policy changes in a material way, we will update the “Last
        updated” date above and, for significant changes, notify you through
        the platform. Continued use of Aidify after a change takes effect
        constitutes acceptance of the updated policy.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      intro="This policy explains, in plain language, what data Aidify stores, why it is stored, and what control you have over it."
      updated="October 17, 2026"
      sections={SECTIONS}
    />
  );
}
