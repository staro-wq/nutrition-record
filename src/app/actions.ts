'use server';

import { prisma } from '@/lib/prisma';

export async function fetchAllData(userId: string) {
  let user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      DailyLogs: {
        include: { meals: true }
      }
    }
  });

  if (!user) {
    const newUser = await prisma.user.create({ 
      data: { id: userId },
      include: {
        DailyLogs: {
          include: { meals: true }
        }
      }
    });
    return newUser;
  }
  return user;
}

export async function syncProfile(userId: string, profile: any, mode: string, streak: number) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      height: parseFloat(profile.height) || 170,
      weight: parseFloat(profile.weight) || 65,
      goal: profile.goal,
      mode,
      streak
    }
  });
}

export async function syncDailyLog(userId: string, date: string, data: any, targetCal: number = 0) {
  const log = await prisma.dailyLog.upsert({
    where: { userId_date: { userId, date } },
    update: {
      targetCal,
      totalCal: data.totalCalories,
      score: data.score,
      status: data.status,
      advice: data.advice
    },
    create: {
      userId,
      date,
      targetCal,
      totalCal: data.totalCalories,
      score: data.score,
      status: data.status,
      advice: data.advice
    }
  });

  await prisma.meal.deleteMany({ where: { dailyLogId: log.id } });

  const mealCreates = [];
  for (const [category, mealsArray] of Object.entries(data.meals)) {
    if (Array.isArray(mealsArray)) {
      for (const meal of mealsArray) {
        const m = meal as any;
        mealCreates.push({
          dailyLogId: log.id,
          category,
          name: m.name,
          calories: m.calories,
          protein: m.protein,
          fat: m.fat,
          carbs: m.carbs,
          iron: m.iron || 0,
          vitaminC: m.vitaminC || 0,
          isUnanalyzed: m.isUnanalyzed || false,
          image: m.image || null
        });
      }
    }
  }

  if (mealCreates.length > 0) {
    await prisma.meal.createMany({ data: mealCreates });
  }
}

export async function migrateUserData(oldUserId: string, newUserId: string) {
  const oldLogs = await prisma.dailyLog.findMany({ where: { userId: oldUserId } });
  
  for (const log of oldLogs) {
    try {
      await prisma.dailyLog.update({
        where: { id: log.id },
        data: { userId: newUserId }
      });
    } catch(e) {
      // Ignore if new user already has a log for this date
    }
  }

  const oldUser = await prisma.user.findUnique({ where: { id: oldUserId } });
  if (oldUser) {
    await prisma.user.update({
      where: { id: newUserId },
      data: {
        height: oldUser.height,
        weight: oldUser.weight,
        goal: oldUser.goal,
        mode: oldUser.mode
      }
    });
  }
}
