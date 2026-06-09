/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

// ─── Brand tokens ──────────────────────────────────────────────────────────────

export const BRAND = {
  gold: 'hsl(38, 80%, 55%)',
  goldDark: 'hsl(38, 75%, 42%)',
  dark: 'hsl(224, 30%, 12%)',
  muted: 'hsl(220, 10%, 45%)',
  goldBg: 'hsl(38, 60%, 96%)',
  border: 'hsl(220, 15%, 90%)',
  white: '#ffffff',
  bodyBg: 'hsl(220, 20%, 97%)',
}

// ─── Shared style objects ──────────────────────────────────────────────────────

export const styles = {
  main: {
    backgroundColor: BRAND.bodyBg,
    fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
  } as React.CSSProperties,

  outerContainer: {
    maxWidth: '560px',
    margin: '0 auto',
    padding: '32px 16px',
  } as React.CSSProperties,

  logoSection: {
    textAlign: 'center' as const,
    paddingBottom: '20px',
  } as React.CSSProperties,

  logoText: {
    fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif",
    fontSize: '22px',
    fontWeight: 'bold' as const,
    color: BRAND.gold,
    margin: '0',
    letterSpacing: '-0.3px',
  } as React.CSSProperties,

  logoTagline: {
    fontSize: '11px',
    color: BRAND.muted,
    margin: '2px 0 0',
    letterSpacing: '0.5px',
    textTransform: 'uppercase' as const,
  } as React.CSSProperties,

  card: {
    backgroundColor: BRAND.white,
    borderRadius: '16px',
    border: `1px solid ${BRAND.border}`,
    padding: '40px 36px',
  } as React.CSSProperties,

  h1: {
    fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif",
    fontSize: '24px',
    fontWeight: 'bold' as const,
    color: BRAND.dark,
    margin: '0 0 16px',
    lineHeight: '1.3',
  } as React.CSSProperties,

  text: {
    fontSize: '15px',
    color: BRAND.muted,
    lineHeight: '1.65',
    margin: '0 0 20px',
  } as React.CSSProperties,

  link: {
    color: BRAND.gold,
    textDecoration: 'underline',
  } as React.CSSProperties,

  button: {
    backgroundColor: BRAND.gold,
    color: BRAND.dark,
    fontSize: '15px',
    fontWeight: '600' as const,
    borderRadius: '10px',
    padding: '14px 28px',
    textDecoration: 'none',
    display: 'inline-block' as const,
  } as React.CSSProperties,

  buttonSection: {
    textAlign: 'center' as const,
    margin: '28px 0',
  } as React.CSSProperties,

  divider: {
    borderColor: BRAND.border,
    margin: '28px 0 0',
  } as React.CSSProperties,

  footerSection: {
    textAlign: 'center' as const,
    paddingTop: '20px',
  } as React.CSSProperties,

  footerText: {
    fontSize: '12px',
    color: 'hsl(220, 10%, 65%)',
    margin: '4px 0',
    lineHeight: '1.5',
  } as React.CSSProperties,

  mutedNote: {
    fontSize: '13px',
    color: 'hsl(220, 10%, 60%)',
    lineHeight: '1.55',
    margin: '20px 0 0',
  } as React.CSSProperties,
}

// ─── Shared layout shell ───────────────────────────────────────────────────────

interface EmailShellProps {
  preview: string
  children: React.ReactNode
}

export function EmailShell({ preview, children }: EmailShellProps) {
  const year = new Date().getFullYear()

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.main}>
        <Container style={styles.outerContainer}>

          {/* Logo */}
          <Section style={styles.logoSection}>
            <Text style={styles.logoText}>SimchaSync</Text>
            <Text style={styles.logoTagline}>Event Management for Music Professionals</Text>
          </Section>

          {/* Card */}
          <Section style={styles.card}>
            {children}
          </Section>

          {/* Footer */}
          <Section style={styles.footerSection}>
            <Hr style={{ borderColor: BRAND.border, margin: '0 0 16px' }} />
            <Text style={styles.footerText}>
              © {year} SimchaSync. All rights reserved.
            </Text>
            <Text style={styles.footerText}>
              Questions? Reply to this email or visit{' '}
              <a href="https://simchasync.com" style={{ color: BRAND.gold }}>simchasync.com</a>
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  )
}
