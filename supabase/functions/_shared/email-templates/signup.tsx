/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to SimchaSync — confirm your email</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>🎵 SimchaSync</Text>
        <Heading style={h1}>Welcome aboard!</Heading>
        <Text style={text}>
          Thanks for starting your free trial with{' '}
          <Link href={siteUrl} style={link}>
            <strong>SimchaSync</strong>
          </Link>
          . You're one step away from managing your simchas like a pro.
        </Text>
        <Text style={text}>
          Please confirm your email (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) to get started:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirm Email
        </Button>
        <Text style={footer}>
          If you didn't create an account, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '32px 28px' }
const brand = {
  fontSize: '20px',
  fontFamily: "'Playfair Display', Georgia, serif",
  fontWeight: 'bold' as const,
  color: 'hsl(38, 80%, 55%)',
  margin: '0 0 24px',
}
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  fontFamily: "'Playfair Display', Georgia, serif",
  color: 'hsl(224, 30%, 12%)',
  margin: '0 0 20px',
}
const text = {
  fontSize: '15px',
  color: 'hsl(220, 10%, 45%)',
  lineHeight: '1.6',
  margin: '0 0 24px',
}
const link = { color: 'hsl(38, 80%, 55%)', textDecoration: 'underline' }
const button = {
  backgroundColor: 'hsl(38, 80%, 55%)',
  color: 'hsl(224, 30%, 8%)',
  fontSize: '15px',
  fontWeight: '600' as const,
  borderRadius: '12px',
  padding: '14px 24px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0' }
