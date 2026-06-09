/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Button, Heading, Text } from 'npm:@react-email/components@0.0.22'
import { EmailShell, styles } from './_base.tsx'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
  recipientName?: string
}

export const RecoveryEmail = ({
  siteName: _siteName,
  confirmationUrl,
  recipientName,
}: RecoveryEmailProps) => (
  <EmailShell preview="Reset your SimchaSync password — link expires in 1 hour.">
    <Heading style={styles.h1}>
      {recipientName ? `Hi ${recipientName},` : 'Reset your password'}
    </Heading>

    <Text style={styles.text}>
      {recipientName ? 'We received a request to reset your SimchaSync password.' : 'We received a request to reset the password on your SimchaSync account.'}
      {' '}Click the button below to choose a new one.
    </Text>

    <div style={styles.buttonSection}>
      <Button style={styles.button} href={confirmationUrl}>
        Reset My Password
      </Button>
    </div>

    <Text style={styles.mutedNote}>
      This link expires in 1 hour. If you didn't request a password reset,
      you can safely ignore this email — your password won't change.
    </Text>
  </EmailShell>
)

export default RecoveryEmail
