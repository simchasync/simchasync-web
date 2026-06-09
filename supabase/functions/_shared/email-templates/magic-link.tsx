/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Button, Heading, Text } from 'npm:@react-email/components@0.0.22'
import { EmailShell, styles } from './_base.tsx'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
  recipientName?: string
}

export const MagicLinkEmail = ({
  siteName: _siteName,
  confirmationUrl,
  recipientName,
}: MagicLinkEmailProps) => (
  <EmailShell preview="Your SimchaSync sign-in link — click to log in instantly.">
    <Heading style={styles.h1}>
      {recipientName ? `Hi ${recipientName}, here's your sign-in link` : 'Your sign-in link'}
    </Heading>

    <Text style={styles.text}>
      You requested a magic link to sign in to SimchaSync. Click the button
      below to log in instantly — no password needed.
    </Text>

    <div style={styles.buttonSection}>
      <Button style={styles.button} href={confirmationUrl}>
        Sign In to SimchaSync
      </Button>
    </div>

    <Text style={styles.mutedNote}>
      This link expires in 1 hour and can only be used once.
      If you didn't request this, you can safely ignore this email.
    </Text>
  </EmailShell>
)

export default MagicLinkEmail
