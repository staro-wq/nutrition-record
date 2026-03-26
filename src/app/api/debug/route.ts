import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      include: { DailyLogs: { include: { meals: true } } }
    });
    const logs = await prisma.dailyLog.findMany();
    const meals = await prisma.meal.findMany();

    return NextResponse.json({
      status: "db_connected",
      stats: {
        totalUsers: users.length,
        totalLogs: logs.length,
        totalMeals: meals.length,
      },
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        logs: u.DailyLogs.map(l => ({
          id: l.id,
          date: l.date,
          score: l.score,
          mealsCount: l.meals.length
        }))
      })),
      allLogsRaw: logs.map(l => ({
        id: l.id,
        userId: l.userId,
        date: l.date,
        score: l.score
      }))
    });
  } catch (error: any) {
    return NextResponse.json({
      status: "error",
      message: error.message || String(error)
    }, { status: 500 });
  }
}
