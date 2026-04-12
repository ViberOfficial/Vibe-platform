import { auth } from '@clerk/nextjs'
import { NextResponse } from 'next/server'

export function requireAuth(handler: Function) {
  return async (req: Request, ...args: any[]) => {
    const { userId } = auth()
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    return handler(req, userId, ...args)
  }
}
