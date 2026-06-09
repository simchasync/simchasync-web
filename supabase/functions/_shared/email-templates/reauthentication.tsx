/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Heading, Text } from 'npm:@react-email/components@0.0.22'
import { BRAND, EmailShell, styles } from './_base.tsx'

interface ReauthenticationEmailProps {
  token: string
  recipientName?: string
}

const tokenStyle: React.CSSProperties = {
  fontFamily: 'Courier New, Courier, monospace',
  fontSize: '32px',
  fontWeight: 'bold',
  color: BRAND.dark,
  backgroundColor: BRAND.goldBg,
  border: `1px solid ${BRAND.border}`,
  padding: '16px 24px',
  borderRadius: '12px',
  letterSpacing: '6px',
  textAlign: 'center',
  display: 'block',
  margin: '8px 0 24px',
}

export const ReauthenticationEmail = ({
  token,
  recipientName,
}: ReauthenticationEmailProps) => (
  <EmailShell preview={`${token} is your SimchaSync verification code.`}>
    <Heading style={styles.h1}>
      {recipientName ? `Hi ${recipientName}, verify your identity` : 'Verify your identity'}
    </Heading>

    <Text style={styles.text}>
      Enter the code below to confirm your identity and continue.
    </Text>

    <Text style={tokenStyle}>{token}</Text>

    <Text style={styles.mutedNote}>
      This code expires in 10 minutes. If you didn't request this,
      someone may be trying to access your account — you can safely ignore this email.
    </Text>
  </EmailShell>
)

export default ReauthenticationEmail
