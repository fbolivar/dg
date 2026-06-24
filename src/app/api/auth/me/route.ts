import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifySession, SESSION_COOKIE } from '@/shared/lib/auth'

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  const user = verifySession(token)
  if (!user) return NextResponse.json({ user: null }, { status: 401 })
  return NextResponse.json({ user })
}
