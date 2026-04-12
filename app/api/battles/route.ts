import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const createBattleSchema = z.object({
  creator2Id: z.string().uuid(),
  video1Id: z.string().uuid(),
  video2Id: z.string().uuid(),
  theme: z.string().min(1).max(100).optional(),
})

const voteSchema = z.object({
  battleId: z.string().uuid(),
  amount: z.number().min(1),
  votedFor: z.enum(['creator1', 'creator2']),
})

// Create a new battle
export async function POST(req: Request) {
  try {
    const { userId } = auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const creator1 = await prisma.user.findUnique({
      where: { clerkId: userId },
    })

    if (!creator1) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 })
    }

    const body = await req.json()
    const validated = createBattleSchema.parse(body)

    // Verify videos belong to respective creators
    const [video1, video2] = await Promise.all([
      prisma.video.findFirst({
        where: { id: validated.video1Id, creatorId: creator1.id },
      }),
      prisma.video.findFirst({
        where: { id: validated.video2Id, creatorId: validated.creator2Id },
      }),
    ])

    if (!video1) {
      return NextResponse.json(
        { error: 'Video 1 not found or does not belong to you' },
        { status: 400 }
      )
    }

    if (!video2) {
      return NextResponse.json(
        { error: 'Video 2 not found or creator mismatch' },
        { status: 400 }
      )
    }

    const battle = await prisma.battle.create({
      data: {
        creator1Id: creator1.id,
        creator2Id: validated.creator2Id,
        video1Id: validated.video1Id,
        video2Id: validated.video2Id,
        theme: validated.theme,
        status: 'live',
      },
      include: {
        creator1: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        creator2: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        video1: true,
        video2: true,
      },
    })

    return NextResponse.json({ battle }, { status: 201 })

  } catch (error) {
    console.error('Create battle error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create battle' },
      { status: 500 }
    )
  }
}

// Get battles
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'live'
    const limit = parseInt(searchParams.get('limit') || '10')

    const battles = await prisma.battle.findMany({
      where: { status },
      include: {
        creator1: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        creator2: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        video1: {
          select: { id: true, thumbnailUrl: true, title: true },
        },
        video2: {
          select: { id: true, thumbnailUrl: true, title: true },
        },
        _count: {
          select: { votes: true },
        },
      },
      orderBy: { prizePool: 'desc' },
      take: limit,
    })

    return NextResponse.json({ battles })

  } catch (error) {
    console.error('Fetch battles error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch battles' },
      { status: 500 }
    )
  }
}

// Vote in battle
export async function PATCH(req: Request) {
  try {
    const { userId } = auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const voter = await prisma.user.findUnique({
      where: { clerkId: userId },
    })

    if (!voter) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await req.json()
    const validated = voteSchema.parse(body)

    // Get battle
    const battle = await prisma.battle.findUnique({
      where: { id: validated.battleId },
    })

    if (!battle || battle.status !== 'live') {
      return NextResponse.json(
        { error: 'Battle not found or not active' },
        { status: 400 }
      )
    }

    // Create vote
    const vote = await prisma.battleVote.create({
      data: {
        battleId: validated.battleId,
        voterId: voter.id,
        amount: validated.amount,
        votedFor: validated.votedFor,
      },
    })

    // Update battle prize pool and vote counts
    await prisma.battle.update({
      where: { id: validated.battleId },
      data: {
        prizePool: { increment: validated.amount },
        votes1: validated.votedFor === 'creator1' ? { increment: 1 } : undefined,
        votes2: validated.votedFor === 'creator2' ? { increment: 1 } : undefined,
      },
    })

    return NextResponse.json({ vote })

  } catch (error) {
    console.error('Vote error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to submit vote' },
      { status: 500 }
    )
  }
}
