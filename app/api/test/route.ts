import { NextResponse } from 'next/server'

// Force Node.js runtime to avoid fetch errors in Electron/production
export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'API Test endpoint is working',
    timestamp: new Date().toISOString(),
    server: 'Next.js API'
  })
}

export async function POST() {
  return NextResponse.json({
    success: true,
    message: 'POST request received',
    timestamp: new Date().toISOString()
  })
}
