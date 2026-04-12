import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs'
import Stripe from 'stripe'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Validation schema
const tipSchema = z.object({
  amount: z.number().min(0.5).max(1000),
  recipientId: z.string().uuid(),
  videoId: z.string().uuid(),
  message: z.string().max(280).optional(),
})

export async function POST(req: Request) {
  try {
    const { userId } = auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const validated = tipSchema.parse(body)

    // Get sender details from Clerk
    const sender = await prisma.user.findUnique({
      where: { clerkId: userId },
    })

    if (!sender) {
      return NextResponse.json({ error: 'Sender not found' }, { status: 404 })
    }

    // Get recipient
    const recipient = await prisma.user.findUnique({
      where: { id: validated.recipientId },
    })

    if (!recipient) {
      return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })
    }

    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(validated.amount * 100), // Convert to cents
      currency: 'usd',
      metadata: {
        senderId: sender.id,
        recipientId: recipient.id,
        videoId: validated.videoId,
        type: 'tip',
      },
    })

    // Create tip record (pending until payment confirmed)
    const tip = await prisma.tip.create({
      data: {
        amount: validated.amount,
        message: validated.message,
        senderId: sender.id,
        recipientId: recipient.id,
        videoId: validated.videoId,
        stripePaymentIntentId: paymentIntent.id,
      },
    })

    // Broadcast real-time tip via Supabase
    await supabase.channel('tips-channel').send({
      type: 'broadcast',
      event: 'new-tip',
      payload: {
        tipId: tip.id,
        amount: validated.amount,
        sender: sender.displayName || sender.username,
        message: validated.message,
        recipientId: recipient.id,
        videoId: validated.videoId,
      },
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      tipId: tip.id,
    })

  } catch (error) {
    console.error('Tip creation error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create tip' },
      { status: 500 }
    )
  }
}

// Get tips for a video
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const videoId = searchParams.get('videoId')
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!videoId) {
      return NextResponse.json(
        { error: 'Video ID required' },
        { status: 400 }
      )
    }

    const tips = await prisma.tip.findMany({
      where: { videoId },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return NextResponse.json({ tips })

  } catch (error) {
    console.error('Fetch tips error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch tips' },
      { status: 500 }
    )
  }
}
