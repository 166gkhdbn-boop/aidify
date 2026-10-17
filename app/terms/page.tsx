import type { Metadata } from "next";
import {
  Ban,
  FileWarning,
  Scale,
  ShieldAlert,
  UserCheck,
  Wrench,
} from "lucide-react";
import { LegalPage, type LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Aidify's Terms of Service: acceptable use, account responsibilities, and warranty disclaimer.",
};

const SECTIONS: LegalSection[] = [
  {
    icon: UserCheck,
    title: "Your account",
    body: (
      <>
        <p>
          You must provide an accurate email address and keep your credentials
          confidential. You are responsible for everything done under your
          account — including configurations created, shared, or deleted by
          anyone you give access to your session.
        </p>
        <p>
          You must be able to receive email at the address you register with,
          because account verification and password resets happen by email. If
          your email becomes unreachable, contact the workspace administrator
          for recovery options.
        </p>
      </>
    ),
  },
  {
    icon: Ban,
    title: "Acceptable use",
    body: (
      <>
        <p>You agree not to use Aidify to:</p>
        <ul>
          <li>
            Store or distribute unlawful content, malware, or credentials that
            do not belong to you.
          </li>
          <li>
            Attempt to access other users’ data, escalate your own privileges,
            or probe the platform for vulnerabilities without written
            permission.
          </li>
          <li>
            Abuse rate limits, scrape the service, or disrupt availability for
            others.
          </li>
          <li>
            Upload secrets you do not own or have no right to manage — treat
            configuration values as sensitive and rotate them if they leak.
          </li>
        </ul>
        <p>
          Violations may result in suspension or termination of your account,
          with or without notice, at the administrator’s discretion.
        </p>
      </>
    ),
  },
  {
    icon: ShieldAlert,
    title: "Your content, your responsibility",
    body: (
      <p>
        You retain ownership of the configurations and data you store in
        Aidify. You are responsible for their accuracy, legality, and
        backups. While Aidify versions every change, it is not a substitute
        for your own disaster-recovery practices — export critical
        configurations regularly.
      </p>
    ),
  },
  {
    icon: Wrench,
    title: "Availability and changes",
    body: (
      <p>
        We aim for reliable service but do not guarantee uninterrupted
        availability. The platform may enter maintenance mode, during which
        non-administrative access is temporarily restricted, and features may
        change or be removed as the product evolves. Material changes to these
        terms will be announced in advance where feasible.
      </p>
    ),
  },
  {
    icon: FileWarning,
    title: "No warranty",
    body: (
      <p>
        Aidify is provided “as is” and “as available,” without warranties of
        any kind — express or implied — including merchantability, fitness
        for a particular purpose, and non-infringement. To the maximum extent
        permitted by law, we are not liable for indirect, incidental, or
        consequential damages arising from your use of the platform, including
        data loss or misconfiguration.
      </p>
    ),
  },
  {
    icon: Scale,
    title: "Termination",
    body: (
      <p>
        You may stop using Aidify and delete your account at any time. We may
        suspend or terminate accounts that violate these terms or remain
        inactive under the workspace’s retention policy. On termination, your
        access ends; your data is handled as described in the Privacy Policy.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Service"
      intro="These terms govern your use of Aidify. By creating an account or using the platform, you agree to them."
      updated="October 17, 2026"
      sections={SECTIONS}
    />
  );
}
