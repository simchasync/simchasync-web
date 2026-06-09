/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Button, Heading, Link, Text } from 'npm:@react-email/components@0.0.22'
import { EmailShell, styles } from './_base.tsx'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
  recipientName?: string
}

export const SignupEmail = ({
  siteName: _siteName,
  siteUrl,
  recipient,
  confirmationUrl,
  recipientName,
}: SignupEmailProps) => {
  const greeting = recipientName ? `Hi ${recipientName},` : 'Welcome aboard!'

  return (
    <EmailShell preview="Confirm your SimchaSync account — one click and you're in.">
      <Heading style={styles.h1}>{greeting}</Heading>

      <Text style={styles.text}>
        Thanks for signing up for{' '}
        <Link href={siteUrl} style={styles.link}>SimchaSync</Link>.
        You're one step away from managing your events like a pro.
      </Text>

      <Text style={styles.text}>
        Click the button below to confirm your email address (
        <Link href={`mailto:${recipient}`} style={styles.link}>{recipient}</Link>)
        and activate your free trial.
      </Text>

      <div style={styles.buttonSection}>
        <Button style={styles.button} href={confirmationUrl}>
          Confirm My Email
        </Button>
      </div>

      <Text style={styles.mutedNote}>
        This link expires in 24 hours. If you didn't create a SimchaSync account,
        you can safely ignore this email — nothing will change.
      </Text>
    </EmailShell>
  )
}

export default SignupEmail
