/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Button, Heading, Link, Text } from 'npm:@react-email/components@0.0.22'
import { BRAND, EmailShell, styles } from './_base.tsx'

interface EmailChangeEmailProps {
  siteName: string
  email: string
  newEmail: string
  confirmationUrl: string
  recipientName?: string
}

const changeRowStyle: React.CSSProperties = {
  backgroundColor: BRAND.goldBg,
  border: `1px solid ${BRAND.border}`,
  borderRadius: '10px',
  padding: '14px 18px',
  margin: '0 0 24px',
}

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: BRAND.muted,
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
  margin: '0 0 2px',
}

const valueStyle: React.CSSProperties = {
  fontSize: '14px',
  color: BRAND.dark,
  margin: '0',
  wordBreak: 'break-all',
}

export const EmailChangeEmail = ({
  siteName: _siteName,
  email,
  newEmail,
  confirmationUrl,
  recipientName,
}: EmailChangeEmailProps) => (
  <EmailShell preview="Confirm your SimchaSync email address change.">
    <Heading style={styles.h1}>
      {recipientName ? `Hi ${recipientName}, confirm your email change` : 'Confirm your email change'}
    </Heading>

    <Text style={styles.text}>
      You requested to update your SimchaSync email address. Review the change
      below and click the button to confirm.
    </Text>

    <div style={changeRowStyle}>
      <Text style={labelStyle}>Current email</Text>
      <Text style={valueStyle}>
        <Link href={`mailto:${email}`} style={styles.link}>{email}</Link>
      </Text>
    </div>

    <div style={changeRowStyle}>
      <Text style={labelStyle}>New email</Text>
      <Text style={valueStyle}>
        <Link href={`mailto:${newEmail}`} style={styles.link}>{newEmail}</Link>
      </Text>
    </div>

    <div style={styles.buttonSection}>
      <Button style={styles.button} href={confirmationUrl}>
        Confirm Email Change
      </Button>
    </div>

    <Text style={styles.mutedNote}>
      This link expires in 24 hours. If you didn't request this change,
      please secure your account immediately by changing your password.
    </Text>
  </EmailShell>
)

export default EmailChangeEmail
