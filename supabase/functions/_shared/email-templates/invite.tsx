/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Button, Heading, Link, Text } from 'npm:@react-email/components@0.0.22'
import { EmailShell, styles } from './_base.tsx'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
  recipientName?: string
}

export const InviteEmail = ({
  siteName: _siteName,
  siteUrl,
  confirmationUrl,
  recipientName,
}: InviteEmailProps) => (
  <EmailShell preview="You've been invited to join SimchaSync — accept your invitation inside.">
    <Heading style={styles.h1}>
      {recipientName ? `Hi ${recipientName}, you've been invited!` : "You've been invited to SimchaSync"}
    </Heading>

    <Text style={styles.text}>
      Someone has invited you to collaborate on{' '}
      <Link href={siteUrl} style={styles.link}>SimchaSync</Link>,
      the event management platform for music professionals.
    </Text>

    <Text style={styles.text}>
      Click the button below to accept your invitation and set up your account.
    </Text>

    <div style={styles.buttonSection}>
      <Button style={styles.button} href={confirmationUrl}>
        Accept Invitation
      </Button>
    </div>

    <Text style={styles.mutedNote}>
      This invitation link expires in 24 hours. If you weren't expecting this,
      you can safely ignore this email — no account will be created.
    </Text>
  </EmailShell>
)

export default InviteEmail
