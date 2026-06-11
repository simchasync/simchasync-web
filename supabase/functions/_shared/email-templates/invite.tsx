/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Button, Heading, Link, Text } from 'npm:@react-email/components@0.0.22'
import { EmailShell, styles } from './_base.tsx'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
  recipientName?: string
  tenantName?: string
  roleLabel?: string
  inviterName?: string
  existingUser?: boolean
}

export const InviteEmail = ({
  siteName: _siteName,
  siteUrl,
  confirmationUrl,
  recipientName,
  tenantName,
  roleLabel,
  inviterName,
  existingUser,
}: InviteEmailProps) => (
  <EmailShell
    preview={
      tenantName
        ? `You've been invited to join ${tenantName} on SimchaSync — accept your invitation inside.`
        : "You've been invited to join SimchaSync — accept your invitation inside."
    }
  >
    <Heading style={styles.h1}>
      {tenantName
        ? `You've been invited to join ${tenantName}!`
        : recipientName
          ? `Hi ${recipientName}, you've been invited!`
          : "You've been invited to SimchaSync"}
    </Heading>

    <Text style={styles.text}>
      {inviterName ? `${inviterName} has` : 'Someone has'} invited you
      {recipientName ? ` (${recipientName})` : ''} to collaborate on{' '}
      {tenantName ? <strong>{tenantName}</strong> : null}
      {tenantName ? ' in ' : ''}
      <Link href={siteUrl} style={styles.link}>SimchaSync</Link>,
      the event management platform for music professionals.
      {roleLabel ? ` You'll be joining as ${roleLabel}.` : ''}
    </Text>

    <Text style={styles.text}>
      {existingUser
        ? 'Click the button below to sign in and open the workspace — your existing SimchaSync account will be used.'
        : 'Click the button below to accept your invitation and set up your account.'}
    </Text>

    <div style={styles.buttonSection}>
      <Button style={styles.button} href={confirmationUrl}>
        Accept Invitation
      </Button>
    </div>

    <Text style={styles.mutedNote}>
      {existingUser
        ? "This link expires shortly and can only be used once. If you weren't expecting this invitation, you can safely ignore this email."
        : "This invitation link expires in 24 hours. If you weren't expecting this, you can safely ignore this email — no account will be created."}
    </Text>
  </EmailShell>
)

export default InviteEmail
