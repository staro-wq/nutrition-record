"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { fetchAllData, syncProfile, syncDailyLog } from './actions';
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import { Home, PlusCircle, Calendar as CalendarIcon, Settings, Camera, X, Info, Loader2, CheckCircle2, Sparkles, ChevronLeft, ChevronRight, Image as ImageIcon, Smile, AlertTriangle, CheckCircle, PieChart as PieChartIcon, Flame, Edit2, Trash2, LogOut } from 'lucide-react';

type Mode = 'diet' | 'health' | 'muscle';
type MealCategory = 'breakfast' | 'lunch' | 'dinner' | 'snack';
type Tab = 'home' | 'calendar' | 'report';

interface Macro {
  label: string;
  consumed: number;
  target: number;
  color: string;
  unit: string;
}

// ---------------------------------------------
// REPORT DATA (Dynamic mapping removed contextually)
// ---------------------------------------------


// ---------------------------------------------
// YUKUSHI CHARACTER COMPONENT
// ---------------------------------------------
const YukushiMessage = ({ message }: { message: string }) => (
  <div className="flex items-start gap-4 animate-in fade-in duration-500">
    <div className="shrink-0 pt-1">
      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-2xl shadow-sm border border-slate-100 relative">
        🐑
        <div className="absolute -bottom-1 -right-1 bg-emerald-100 text-emerald-600 rounded-full p-0.5"><Sparkles size={10} /></div>
      </div>
      <div className="text-[9px] font-black text-slate-400 text-center mt-1">ゆくし</div>
    </div>
    <div className="relative bg-white rounded-2xl rounded-tl-sm p-4 shadow-sm border border-slate-100 flex-1">
      <div className="absolute top-3 -left-2 w-0 h-0 border-y-8 border-y-transparent border-r-[10px] border-r-white z-10"></div>
      <div className="absolute top-3 -left-[9px] w-0 h-0 border-y-8 border-y-transparent border-r-[10px] border-r-slate-100"></div>
      <p className="text-sm font-bold text-slate-700 leading-relaxed">{message.replace(/。/g, "メェ。").replace(/！/g, "メェ！").replace(/です/g, "ですメェ").replace(/ましょう/g, "ましょうメェ")}</p>
    </div>
  </div>
);

// ---------------------------------------------
// DUMMY DATA FOR HISTORY SCREEN (Removed to start fresh)
// ---------------------------------------------
interface MealHistory { id?: string; name: string; calories: number; protein: number; fat: number; carbs: number; iron: number; vitaminC: number; isUnanalyzed?: boolean; image?: string | null; }
interface DailyHistory { date: string; score: number; totalCalories: number; status: 'achieved' | 'exceeded' | 'empty'; advice: string; meals: Record<MealCategory, MealHistory[]>; }


interface UserProfile { height: string; weight: string; goal: string; }

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [historyData, setHistoryData] = useState<Record<string, DailyHistory>>({});

  const computedStreak = useMemo(() => {
    let streak = 0;
    const d = new Date();
    while (true) {
      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const log = historyData[dStr];
      if (log && log.totalCalories > 0) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        const todayStr = (() => {
          const t = new Date();
          return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
        })();
        if (dStr === todayStr) {
          d.setDate(d.getDate() - 1);
        } else {
          break;
        }
      }
    }
    return streak;
  }, [historyData]);
  const [recordTargetDate, setRecordTargetDate] = useState<string>('today');
  
  // --- Profile State ---
  const [profile, setProfile] = useState<UserProfile>({ height: '170', weight: '65', goal: '標準体重を目指す' });
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  
  // Generate real today string
  const todayDateStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  // --- Home Screen Global State derived from history ---
  const [mode, setMode] = useState<Mode>('diet');

  const todayHistory = historyData[todayDateStr];
  const consumed = todayHistory ? {
    calories: todayHistory.totalCalories,
    protein: Object.values(todayHistory.meals).flat().reduce((sum, m) => sum + (m?.protein || 0), 0),
    fat: Object.values(todayHistory.meals).flat().reduce((sum, m) => sum + (m?.fat || 0), 0),
    carbs: Object.values(todayHistory.meals).flat().reduce((sum, m) => sum + (m?.carbs || 0), 0),
    iron: Object.values(todayHistory.meals).flat().reduce((sum, m) => sum + (m?.iron || 0), 0),
    vitaminC: Object.values(todayHistory.meals).flat().reduce((sum, m) => sum + (m?.vitaminC || 0), 0),
  } : { calories: 0, protein: 0, fat: 0, carbs: 0, iron: 0, vitaminC: 0 };

  // --- Persistent Storage (Server Actions DB) ---
  const [isLoaded, setIsLoaded] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    const id = (session?.user as any)?.id;
    if (id) {
      setDeviceId(id);

      fetchAllData(id).then((user) => {
      setProfile({
        height: user.height.toString(),
        weight: user.weight.toString(),
        goal: user.goal
      });
      setMode(user.mode as Mode);

      const loadedHistory: Record<string, DailyHistory> = {};
      for (const log of user.DailyLogs) {
        // Skip ghost logs from DB migration that have lost their meals
        if (!log.meals || log.meals.length === 0) {
          continue;
        }

        const mealsObj: Record<MealCategory, MealHistory[]> = { breakfast: [], lunch: [], dinner: [], snack: [] };
        for (const m of log.meals) {
          mealsObj[m.category as MealCategory].push({
            ...m,
            iron: (m as any).iron || 0,
            vitaminC: (m as any).vitaminC || 0
          });
        }
        
        // Safety recalculation of score based on actual current meals, ignoring DB dummy scores from old versions
        const totalCal = Object.values(mealsObj).flat().reduce((sum, m) => sum + (m?.calories || 0), 0);
        const totalP = Object.values(mealsObj).flat().reduce((sum, m) => sum + (m?.protein || 0), 0);
        const totalF = Object.values(mealsObj).flat().reduce((sum, m) => sum + (m?.fat || 0), 0);
        const totalC = Object.values(mealsObj).flat().reduce((sum, m) => sum + (m?.carbs || 0), 0);
        const totalIron = Object.values(mealsObj).flat().reduce((sum, m) => sum + (m?.iron || 0), 0);
        const totalVC = Object.values(mealsObj).flat().reduce((sum, m) => sum + (m?.vitaminC || 0), 0);

        // Quick dynamic score gen inline for safety on historical data
        let scoreRaw = 100;
        const targetCal = currentTarget.calories;
        const tP = currentTarget.protein;
        const tF = currentTarget.fat;
        const tC = currentTarget.carbs;
        const remCal = Math.max(0, targetCal - totalCal);
        if (totalCal > targetCal) scoreRaw -= (totalCal - targetCal) * 0.05;
        scoreRaw -= Math.max(0, tP - totalP) * 0.5;
        scoreRaw -= Math.max(0, tF - totalF) * 0.5;
        scoreRaw -= Math.max(0, tC - totalC) * 0.5;
        if (totalP > tP + 20) scoreRaw -= (totalP - (tP + 20)) * 0.5;
        if (totalF > tF + 10) scoreRaw -= (totalF - (tF + 10)) * 1.0;
        if (totalC > tC + 30) scoreRaw -= (totalC - (tC + 30)) * 0.5;
        const finalScore = Math.max(0, Math.min(100, Math.round(scoreRaw)));

        loadedHistory[log.date] = {
          date: log.date,
          score: finalScore,
          totalCalories: totalCal,
          status: log.status as 'achieved' | 'exceeded' | 'empty',
          advice: log.advice,
          meals: mealsObj
        };
      }
      setHistoryData(loadedHistory);
      setIsLoaded(true);
    }).catch(e => {
      console.error("DB Load Error", e);
      setIsLoaded(true); // Fallback so UI doesn't hang forever
      });
    }
  }, [session, status, router]);

  // --- Settings & Profile ---
  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    if (deviceId && isLoaded) {
      syncProfile(deviceId, profile, newMode, computedStreak).catch(console.error);
    }
  };

  const handleSaveSettings = () => {
    // Assuming tempProfile is managed elsewhere for the settings modal
    // For now, let's use the current profile state for the sync call
    syncProfile(deviceId, profile, mode, computedStreak).then(() => {
      // setProfile(tempProfile); // Uncomment if tempProfile is used
      setIsSettingsModalOpen(false);
    });
  };

  useEffect(() => {
    if (isLoaded && deviceId) {
      syncProfile(deviceId, profile, mode, computedStreak).catch(console.error);
    }
  }, [profile, mode, computedStreak, isLoaded, deviceId]);

  // Tracking historyData changes requires explicit syncDailyLog calls during mutations to avoid DB overload.

  // --- Record Modal State ---
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [mealCategory, setMealCategory] = useState<MealCategory>('dinner');
  const [mealText, setMealText] = useState('');
  const [mealImage, setMealImage] = useState<string | null>(null);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{ calories: number, protein: number, fat: number, carbs: number, iron: number, vitaminC: number, foodName?: string } | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // --- Calendar Date State ---
  const [selectedDateDetails, setSelectedDateDetails] = useState<DailyHistory | null>(null);

  // Dynamic Target Calculation based on Profile
  const weightNum = parseFloat(profile.weight) || 65;
  const heightNum = parseFloat(profile.height) || 170; 
  
  // Approximate BMR using Mifflin-St Jeor (assuming Age 30 Male as generic fallback)
  const bmr = 10 * weightNum + 6.25 * heightNum - 145;
  
  // TDEE estimation (Lightly active multiplier - safer default)
  let targetCalories = Math.round(bmr * 1.375);
  let targetProtein = Math.round(weightNum * 1.2);

  if (mode === 'diet') {
    targetCalories -= 400; // Adjusted from 500 for more sustainable loss
    targetProtein = Math.round(weightNum * 1.5);
  } else if (mode === 'muscle') {
    targetCalories += 300; // Adjusted from 500 for realistic bulk
    targetProtein = Math.round(weightNum * 2.0);
  }

  // Ensure reasonable minimums
  targetCalories = Math.max(1200, targetCalories); 
  targetProtein = Math.max(50, targetProtein);

  // Fat is ~25% of calories (9 kcal/g)
  const targetFat = Math.round((targetCalories * 0.25) / 9);

  // Carbs is remainder (4 kcal/g)
  const targetCarbs = Math.max(0, Math.round((targetCalories - (targetProtein * 4) - (targetFat * 9)) / 4));

  const currentTarget = {
    calories: targetCalories,
    protein: targetProtein,
    fat: targetFat,
    carbs: targetCarbs
  };
  const remainingCalories = Math.max(0, currentTarget.calories - consumed.calories);
  const caloriePercent = Math.min(100, (consumed.calories / currentTarget.calories) * 100);

  const macros: Macro[] = [
    { label: 'タンパク質', consumed: consumed.protein, target: currentTarget.protein, color: 'bg-blue-500', unit: 'g' },
    { label: '脂質', consumed: consumed.fat, target: currentTarget.fat, color: 'bg-yellow-400', unit: 'g' },
    { label: '炭水化物', consumed: consumed.carbs, target: currentTarget.carbs, color: 'bg-green-500', unit: 'g' },
  ];

  const circleRadius = 70;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circleCircumference - (caloriePercent / 100) * circleCircumference;

  const generateScoreAndAdvice = (totalCal: number, totalP: number, totalF: number, totalC: number, totalIron: number = 0, totalVC: number = 0) => {
    const remCal = Math.max(0, currentTarget.calories - totalCal);
    const remP = Math.max(0, currentTarget.protein - totalP);
    const remF = Math.max(0, currentTarget.fat - totalF);
    const remC = Math.max(0, currentTarget.carbs - totalC);
    
    let advice = `あと ${remCal}kcal 食べられます。`;

    if (totalCal === 0) {
      advice = 'まだ今日の食事が記録されていません。画面下の「＋」ボタンから最初の食事を記録しましょう！';
    } else if (totalCal > currentTarget.calories + 200) {
      advice = "本日の目標カロリーを大きくオーバーしています。明日の食事を少し軽めにするか、有酸素運動を取り入れて調整しましょう！";
    } else if (remCal === 0) {
      if (remP > 10) advice = "カロリーは上限に達しましたが、タンパク質が不足しています。明日は脂質を抑えて高タンパクな食事を意識しましょう。";
      else advice = "本日の目標カロリーに到達しました！完璧なペースです。これ以上の摂取は控えて胃を休めましょう。";
    } else {
      if (remP > 30) {
        advice = `タンパク質が大幅に不足（残り${remP}g）しています。プロテインや鶏むね肉、お刺身などの高タンパクな食材をガッツリ取り入れましょう。`;
      } else if (remP > 10) {
        if (remF < 10) {
          advice = `タンパク質があと${remP}g必要ですが、脂質はほぼ上限です。ノンオイルのツナ缶やささみ、低脂質ヨーグルト等を追加しましょう。`;
        } else {
          advice = `ゆで卵や納豆などで、タンパク質をあと${remP}gほど微調整するのがおすすめです。`;
        }
      } else {
        if (remF > 20 && remC > 50) {
          advice = `タンパク質は十分です！残りはご飯や麺類などの炭水化物と、良質な脂質（アボカドやナッツ）でカロリーを満たしましょう。`;
        } else if (remC > 40) {
          advice = `タンパク質・脂質は十分です。和菓子やフルーツ、おにぎり等で炭水化物（あと${remC}g）だけを補給してエネルギーを満タンにしましょう！`;
        } else {
          advice = `PFCバランスはほぼ理想的です！残りのカロリーはなるべく野菜スープやサラダなど、ヘルシーな食事で満たしてください。`;
        }
      }
    }

    if (totalIron < 5 && totalCal > 300) {
      advice += ` 鉄分が不足気味（現在${totalIron}mg）です。ほうれん草やレバー、赤身肉などを意識して取り入れてみてください。`;
    }
    if (totalVC < 30 && totalCal > 300) {
      advice += ` ビタミンCが不足気味（現在${totalVC}mg）です。ブロッコリーやキウイ、柑橘類などをデザートに追加すると良いですね。`;
    }

    if (mode === 'diet' && remCal < 300 && remP > 15) {
       advice = `【減量警告】カロリー残量が少ない（残り${remCal}kcal）のにタンパク質が不足（残り${remP}g）しています！プロテインアイソレート（WPI）などで純粋にタンパク質だけを補給してください。`;
    }
    
    if (mode === 'muscle' && remCal > 800) {
       advice = `【増量アラート】まだ ${remCal}kcal も余っています！筋肥大のためにはカロリー摂取が必須です。餅やパスタ、プロテインなどで積極的に栄養を流し込んでください。`;
    }
    
    const scoreRaw = totalCal > 0 ? Math.max(0, 100 - Math.abs((totalCal / currentTarget.calories) * 100 - 100) * 0.5) : 0;
    
    return {
      score: Math.round(scoreRaw),
      advice
    };
  };

  const getAdvice = () => generateScoreAndAdvice(consumed.calories, consumed.protein, consumed.fat, consumed.carbs, consumed.iron, consumed.vitaminC).advice;

  // Dynamically compute report data based on state
  const reportData = {
    score: generateScoreAndAdvice(consumed.calories, consumed.protein, consumed.fat, consumed.carbs, consumed.iron, consumed.vitaminC).score,
    advice: getAdvice(),
    targetCalories: currentTarget.calories,
    actualCalories: consumed.calories,
    pfc: [
      { name: 'タンパク質', value: consumed.protein || 1, fill: '#3b82f6', ideal: '25%' }, 
      { name: '脂質', value: consumed.fat || 1, fill: '#fbbf24', ideal: '20%' },      
      { name: '炭水化物', value: consumed.carbs || 1, fill: '#10b981', ideal: '55%' }   
    ]
  };
  const totalPFC = reportData.pfc.reduce((acc, item) => acc + item.value, 0);

  // Generate Weekly Data (Last 7 days)
  const weeklyReport = useMemo(() => {
    const data = [];
    let totalScore = 0;
    let daysWithRecord = 0;
    let totalP = 0, totalF = 0, totalC = 0;
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const history = historyData[dateStr];
      
      data.push({
        name: i === 0 ? '本日' : `${d.getMonth() + 1}/${d.getDate()}`,
        摂取カロリー: history ? history.totalCalories : 0
      });

      if (history && history.totalCalories > 0) {
        totalScore += history.score || 0;
        daysWithRecord++;
        if (history.meals) {
          totalP += Object.values(history.meals).flat().reduce((sum, m) => sum + (m?.protein || 0), 0);
          totalF += Object.values(history.meals).flat().reduce((sum, m) => sum + (m?.fat || 0), 0);
          totalC += Object.values(history.meals).flat().reduce((sum, m) => sum + (m?.carbs || 0), 0);
        }
      }
    }
    
    const avgScore = daysWithRecord > 0 ? Math.round(totalScore / daysWithRecord) : 0;
    const weeklyPFC = [
      { name: 'タンパク質', value: totalP || 1, fill: '#3b82f6', ideal: '25%' }, 
      { name: '脂質', value: totalF || 1, fill: '#fbbf24', ideal: '20%' },      
      { name: '炭水化物', value: totalC || 1, fill: '#10b981', ideal: '55%' }   
    ];
    const weeklyTotalPFC = weeklyPFC.reduce((acc, item) => acc + item.value, 0);
    
    return { data, avgScore, weeklyPFC, daysWithRecord, weeklyTotalPFC };
  }, [historyData]);

  // Generate Today's Meal Evaluations
  const todayMealsList = useMemo(() => {
    const list: Array<{ id: string, time: string, name: string, calories: number, eval: 'good' | 'warning' | 'average', comment: string }> = [];
    if (!todayHistory) return list;
    for (const [cat, meals] of Object.entries(todayHistory.meals)) {
      if (Array.isArray(meals)) {
        meals.forEach((m, idx) => {
          if (!m || m.isUnanalyzed) return;
          const evaluation = m.calories > 800 ? 'warning' : m.calories > 500 ? 'average' : 'good';
          const comment = m.calories > 800 ? 'カロリーが高めでした。次の食事で調整しましょう。' : m.calories > 500 ? 'しっかりエネルギー補給できました。' : '適度なカロリーで抑えられています。';
          const catLabel = cat === 'breakfast' ? '朝食' : cat === 'lunch' ? '昼食' : cat === 'dinner' ? '夕食' : '間食';
          list.push({
            id: m.id || `${cat}-${idx}`,
            time: catLabel + (meals.length > 1 ? ` ${idx + 1}` : ''),
            name: m.name,
            calories: m.calories,
            eval: evaluation,
            comment
          });
        });
      }
    }
    return list;
  }, [todayHistory]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setMealImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!(mealText.trim() || mealImage)) return;
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setAnalysisError(null);

    try {
      const res = await fetch('/api/analyze-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mealText }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '解析に失敗しました');
      }

      setAnalysisResult({
        foodName: data.foodName,
        calories: data.calories,
        protein: data.protein,
        fat: data.fat,
        carbs: data.carbs,
        iron: data.iron,
        vitaminC: data.vitaminC,
      });
    } catch (err: unknown) {
      setAnalysisError(err instanceof Error ? err.message : 'AIとの通信エラーが発生しました');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRecord = () => {
    if (!analysisResult) return;
    
    const targetDate = recordTargetDate === 'today' ? todayDateStr : recordTargetDate;
    const hasAnyMeal = targetDate in historyData;
    
    setHistoryData(prev => {
      const existingInfo = prev[targetDate] || { 
        date: targetDate, score: 80, totalCalories: 0, status: 'achieved', advice: '新しく記録が追加されました！', 
        meals: { breakfast: [], lunch: [], dinner: [], snack: [] } 
      };
      
      const newMealObj = {
        id: editingMealId || crypto.randomUUID(),
        name: analysisResult.foodName || mealText.substring(0, 15) || "記録",
        calories: analysisResult.calories,
        protein: analysisResult.protein,
        fat: analysisResult.fat,
        carbs: analysisResult.carbs,
        iron: analysisResult.iron,
        vitaminC: analysisResult.vitaminC,
        isUnanalyzed: false,
        image: mealImage
      };

      const existingCatMeals = existingInfo.meals[mealCategory] || [];
      let updatedCatMeals;

      if (editingMealId) {
        updatedCatMeals = existingCatMeals.map(m => m.id === editingMealId ? newMealObj : m);
      } else {
        if (mealCategory !== 'snack' && existingCatMeals.length > 0) {
          const existingMeal = existingCatMeals[0];
          updatedCatMeals = [{
            ...existingMeal,
            name: `${existingMeal.name}、${analysisResult.foodName || mealText.substring(0, 15) || "追加分"}`,
            calories: existingMeal.calories + analysisResult.calories,
            protein: existingMeal.protein + analysisResult.protein,
            fat: existingMeal.fat + analysisResult.fat,
            carbs: existingMeal.carbs + analysisResult.carbs,
            iron: existingMeal.iron + analysisResult.iron,
            vitaminC: existingMeal.vitaminC + analysisResult.vitaminC,
            image: mealImage || existingMeal.image,
            isUnanalyzed: false
          }];
        } else {
          updatedCatMeals = [...existingCatMeals, newMealObj];
        }
      }
        
      const updatedMeals = {
        ...existingInfo.meals,
        [mealCategory]: updatedCatMeals
      };

      const newTotal = Object.values(updatedMeals).flat().reduce((sum, m) => sum + (m?.calories || 0), 0);
      const newTotalP = Object.values(updatedMeals).flat().reduce((sum, m) => sum + (m?.protein || 0), 0);
      const newTotalF = Object.values(updatedMeals).flat().reduce((sum, m) => sum + (m?.fat || 0), 0);
      const newTotalC = Object.values(updatedMeals).flat().reduce((sum, m) => sum + (m?.carbs || 0), 0);
      const newTotalIron = Object.values(updatedMeals).flat().reduce((sum, m) => sum + (m?.iron || 0), 0);
      const newTotalVC = Object.values(updatedMeals).flat().reduce((sum, m) => sum + (m?.vitaminC || 0), 0);
      const newStatus = newTotal > currentTarget.calories ? 'exceeded' : 'achieved';
      
      const { score, advice } = generateScoreAndAdvice(newTotal, newTotalP, newTotalF, newTotalC, newTotalIron, newTotalVC);
      
      const updatedInfo = {
        ...existingInfo,
        totalCalories: newTotal,
        score,
        advice,
        status: newStatus as 'achieved' | 'exceeded',
        meals: updatedMeals
      };
      
      syncDailyLog(deviceId, targetDate, updatedInfo, currentTarget.calories).catch(console.error);

      return {
        ...prev,
        [targetDate]: updatedInfo
      };
    });

    setIsRecordModalOpen(false);
    setTimeout(() => {
      setMealImage(null);
      setMealText('');
      setAnalysisResult(null);
      setMealCategory('dinner');
      setEditingMealId(null);
      if (recordTargetDate === 'today') {
        setActiveTab('home'); 
      }
      setRecordTargetDate('today');
    }, 300);
  };

  const handleRecordWithoutAnalysis = () => {
    if (!(mealText.trim() || mealImage)) return;
    
    const targetDate = recordTargetDate === 'today' ? todayDateStr : recordTargetDate;
    const hasAnyMeal = historyData[targetDate] && Object.values(historyData[targetDate].meals).some(m => m !== null);
    

    setHistoryData(prev => {
      const existingInfo = prev[targetDate] || { 
        date: targetDate, score: 80, totalCalories: 0, status: 'empty', advice: '未解析の食事が含まれており正確なスコアが出せません。', 
        meals: { breakfast: [], lunch: [], dinner: [], snack: [] } 
      };
      
      const newMealObj = {
        id: editingMealId || crypto.randomUUID(),
        name: mealText || "写真の記録",
        calories: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
        iron: 0,
        vitaminC: 0,
        isUnanalyzed: true,
        image: mealImage
      };

      const existingCatMeals = existingInfo.meals[mealCategory] || [];
      let updatedCatMeals;

      if (editingMealId) {
        updatedCatMeals = existingCatMeals.map(m => m.id === editingMealId ? newMealObj : m);
      } else {
        if (mealCategory !== 'snack' && existingCatMeals.length > 0) {
          const existingMeal = existingCatMeals[0];
          updatedCatMeals = [{
            ...existingMeal,
            name: `${existingMeal.name}、${mealText || "写真追加"}`,
            image: mealImage || existingMeal.image,
            // If the existing meal was fully analyzed, it becomes unanalyzed overall because we added unanalyzed food
            isUnanalyzed: true
          }];
        } else {
          updatedCatMeals = [...existingCatMeals, newMealObj];
        }
      }
        
      const updatedMeals = {
        ...existingInfo.meals,
        [mealCategory]: updatedCatMeals
      };

      const updatedInfo = {
        ...existingInfo,
        advice: '未解析の食事が含まれており正確なスコアが出せません。',
        meals: updatedMeals
      };

      syncDailyLog(deviceId, targetDate, updatedInfo, currentTarget.calories).catch(console.error);

      return {
        ...prev,
        [targetDate]: updatedInfo
      };
    });

    setIsRecordModalOpen(false);
    setTimeout(() => {
      setMealImage(null);
      setMealText('');
      setAnalysisResult(null);
      setMealCategory('dinner');
      setEditingMealId(null);
      if (recordTargetDate === 'today') {
        setActiveTab('home'); 
      }
      setRecordTargetDate('today');
    }, 300);
  };

  const triggerAnalysisForMeal = (date: string, cat: MealCategory, text: string, img?: string | null, mealId?: string) => {
    setRecordTargetDate(date);
    setMealCategory(cat);
    setMealText(text);
    if (img) setMealImage(img);
    setEditingMealId(mealId || null);
    setSelectedDateDetails(null);
    setIsRecordModalOpen(true);
  };

  const handleDeleteMeal = (date: string, cat: MealCategory, mealId: string) => {
    if (!window.confirm('この食事記録を削除してもよろしいですか？')) return;
    
    setHistoryData(prev => {
      const existingInfo = prev[date];
      if (!existingInfo) return prev;
      
      const newMealsForCat = existingInfo.meals[cat].filter(m => m.id !== mealId);
      const newMeals = { ...existingInfo.meals, [cat]: newMealsForCat };
      
      // Recalculate daily totals
      const newCalories = Object.values(newMeals).flat().reduce((sum, m) => sum + (m?.calories || 0), 0);
      const newTotalP = Object.values(newMeals).flat().reduce((sum, m) => sum + (m?.protein || 0), 0);
      const newTotalF = Object.values(newMeals).flat().reduce((sum, m) => sum + (m?.fat || 0), 0);
      const newTotalC = Object.values(newMeals).flat().reduce((sum, m) => sum + (m?.carbs || 0), 0);
      const newTotalIron = Object.values(newMeals).flat().reduce((sum, m) => sum + (m?.iron || 0), 0);
      const newTotalVC = Object.values(newMeals).flat().reduce((sum, m) => sum + (m?.vitaminC || 0), 0);
      
      const { score, advice } = generateScoreAndAdvice(newCalories, newTotalP, newTotalF, newTotalC, newTotalIron, newTotalVC);
      
      const updatedInfo = {
        ...existingInfo,
        totalCalories: newCalories,
        score,
        advice,
        meals: newMeals
      };

      syncDailyLog(deviceId, date, updatedInfo, currentTarget.calories).catch(console.error);

      return { ...prev, [date]: updatedInfo };
    });
    
    // Also update selectedDateDetails so the drawer updates immediately without closing
    setSelectedDateDetails(prev => {
      if (!prev || prev.date !== date) return prev;
      const newMealsForCat = prev.meals[cat].filter(m => m.id !== mealId);
      const newMeals = { ...prev.meals, [cat]: newMealsForCat };
      const newCalories = Object.values(newMeals).flat().reduce((sum, m) => sum + (m?.calories || 0), 0);
      const newTotalP = Object.values(newMeals).flat().reduce((sum, m) => sum + (m?.protein || 0), 0);
      const newTotalF = Object.values(newMeals).flat().reduce((sum, m) => sum + (m?.fat || 0), 0);
      const newTotalC = Object.values(newMeals).flat().reduce((sum, m) => sum + (m?.carbs || 0), 0);
      const newTotalIron = Object.values(newMeals).flat().reduce((sum, m) => sum + (m?.iron || 0), 0);
      const newTotalVC = Object.values(newMeals).flat().reduce((sum, m) => sum + (m?.vitaminC || 0), 0);
      const { score, advice } = generateScoreAndAdvice(newCalories, newTotalP, newTotalF, newTotalC, newTotalIron, newTotalVC);
      
      return { ...prev, totalCalories: newCalories, score, advice, meals: newMeals };
    });
  };

  // Calendar setup
  const currentYear = currentMonth.getFullYear();
  const currentMonthNum = currentMonth.getMonth() + 1; // 1-12
  const daysInCurrentMonth = new Date(currentYear, currentMonthNum, 0).getDate();
  const startDayOfWeek = new Date(currentYear, currentMonthNum - 1, 1).getDay(); // 0 is Sunday
  
  const calendarGrids = Array(startDayOfWeek).fill(null).concat(Array.from({ length: daysInCurrentMonth }, (_, i) => i + 1));

  const handlePrevMonth = () => setCurrentMonth(new Date(currentYear, currentMonthNum - 2, 1));
  const handleNextMonth = () => setCurrentMonth(new Date(currentYear, currentMonthNum, 1));

  // Custom Legend for PFC
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderPFCLegend = (props: any, baseTotalPFC: number, pfcArray: any[]) => {
    const { payload } = props;
    if (!payload) return null;
    return (
      <ul className="flex flex-col gap-2 mt-2 w-full pl-4 border-l border-slate-100">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {payload.map((entry: any, index: number) => {
          const item = pfcArray[index];
          const actualPercent = Math.round((item.value / baseTotalPFC) * 100) || 0;
          return (
            <li key={`item-${index}`} className="flex items-center text-xs text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: entry.color }} />
              <span className="font-bold w-16 truncate">{entry.value}</span>
              <span className="font-extrabold text-slate-900 w-10 text-right">{actualPercent}%</span>
              <span className="text-[10px] text-slate-400 ml-2">({item.ideal} 理想)</span>
            </li>
          );
        })}
      </ul>
    );
  };

  if (!isLoaded) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2 className="animate-spin text-emerald-500" size={32} /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-28">
      
      {/* -------------------- HOME SCREEN -------------------- */}
      {activeTab === 'home' && (
        <div className="animate-in fade-in duration-300">
          <header className="bg-white px-6 py-5 shadow-sm rounded-b-3xl mb-6 transition-all">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-800">今日の設定</h1>
                <p className="text-xs text-slate-500 mt-1">{profile.height}cm / {profile.weight}kg → 目標: {profile.goal || '未設定'}</p>
              </div>
              <div className="bg-slate-100 p-1 rounded-full flex gap-1">
                <button
                  onClick={() => handleModeChange('diet')}
                  className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all ${mode === 'diet' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >ダイエット</button>
                <button
                  onClick={() => handleModeChange('health')}
                  className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all ${mode === 'health' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >健康維持</button>
                <button
                  onClick={() => handleModeChange('muscle')}
                  className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all ${mode === 'muscle' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >筋トレ</button>
              </div>
            </div>

            {/* Streak Indicator */}
            <div className="flex justify-center mb-1 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="bg-orange-50 border border-orange-100 px-4 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
                <Flame size={18} className="text-orange-500 shrink-0 fill-orange-500" />
                <span className="text-sm font-extrabold text-orange-600 tracking-tight">
                  {computedStreak}日連続クリア！
                </span>
              </div>
            </div>

            <div className="flex flex-col items-center justify-center py-4 relative">
              <div className="relative w-48 h-48 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="96" cy="96" r={circleRadius} stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-100" />
                  <circle cx="96" cy="96" r={circleRadius} stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray={circleCircumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round"
                    className={`transition-all duration-1000 ease-out ${caloriePercent >= 100 ? 'text-red-500' : mode === 'diet' ? 'text-emerald-500' : mode === 'health' ? 'text-blue-500' : 'text-orange-500'}`} />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-sm font-medium text-slate-500 mb-1">あと</span>
                  <span className={`text-4xl font-extrabold tracking-tighter ${caloriePercent >= 100 ? 'text-red-500' : 'text-slate-800'}`}>{remainingCalories}</span>
                  <span className="text-xs font-bold text-slate-400 mt-1">kcal</span>
                </div>
              </div>
              <div className="mt-4 text-sm font-medium text-slate-400 flex gap-4 transition-all">
                <span>摂取 {consumed.calories}</span><span>/</span><span>目標 {currentTarget.calories}</span>
              </div>
            </div>
          </header>

          <main className="px-6 space-y-6">
            <YukushiMessage message={getAdvice()} />

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 mb-5">栄養素バランス（PFC）</h3>
              <div className="space-y-5">
                {macros.map((macro, idx) => {
                  const remaining = Math.max(0, macro.target - macro.consumed);
                  const percent = Math.min(100, (macro.consumed / macro.target) * 100);
                  
                  return (
                    <div key={idx} className="transition-all duration-500">
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-sm font-semibold text-slate-700">{macro.label}</span>
                        <span className="text-xs font-medium text-slate-500">
                          あと <span className={`text-sm font-bold ${percent >= 100 ? 'text-emerald-500' : 'text-slate-800'}`}>{remaining}{macro.unit}</span>
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-1000 ease-out ${percent >= 100 ? 'bg-emerald-500' : macro.color}`} style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Meal Evaluations (Moved from Report Tab) */}
            {todayMealsList.length > 0 && (
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                <h3 className="text-sm font-extrabold text-slate-800 mb-5 flex items-center gap-2">
                  <div className="w-2 h-5 bg-orange-400 rounded-full"/>本日の食事評価
                </h3>
                <div className="space-y-3">
                  {todayMealsList.map((meal: any) => {
                    const Icon = meal.eval === 'good' ? Smile : meal.eval === 'warning' ? AlertTriangle : CheckCircle;
                    const colorClass = meal.eval === 'good' ? 'text-emerald-500 bg-emerald-50' : meal.eval === 'warning' ? 'text-amber-500 bg-amber-50' : 'text-blue-500 bg-blue-50';
                    
                    return (
                       <div key={meal.id} className="flex items-center p-3 rounded-2xl border border-slate-100 shadow-sm gap-4 transition-all hover:bg-slate-50">
                          <div className={`p-3 rounded-xl ${colorClass}`}>
                            <Icon size={22} strokeWidth={2.5} />
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-baseline mb-1">
                              <span className="text-xs font-bold text-slate-400">{meal.time}</span>
                              <span className="text-sm font-extrabold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">{meal.calories}<span className="text-[10px] text-slate-500 ml-0.5">kcal</span></span>
                            </div>
                            <span className="text-sm font-bold text-slate-700 block">{meal.name}</span>
                            <span className="text-xs font-semibold text-slate-500 mt-1 block">{meal.comment}</span>
                          </div>
                       </div>
                    )
                  })}
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      {/* -------------------- CALENDAR SCREEN -------------------- */}
      {activeTab === 'calendar' && (
        <div className="animate-in fade-in duration-300 px-4 pt-6">
          <div className="flex justify-between items-center mb-6 px-2">
            <h1 className="text-xl font-extrabold tracking-tight text-slate-800">履歴・カレンダー</h1>
            <div className="flex items-center gap-2 text-slate-600 font-bold bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-100">
              <button onClick={handlePrevMonth} className="hover:bg-slate-50 p-1 rounded-full transition-colors"><ChevronLeft size={20} className="text-slate-400 hover:text-emerald-500" /></button>
              <span className="text-sm w-[88px] text-center tracking-wide">{currentYear}年 {currentMonthNum}月</span>
              <button onClick={handleNextMonth} className="hover:bg-slate-50 p-1 rounded-full transition-colors"><ChevronRight size={20} className="text-slate-400 hover:text-emerald-500" /></button>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100">
            <div className="grid grid-cols-7 mb-3 text-center">
              {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
                <div key={d} className={`text-xs font-bold ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-400'}`}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {calendarGrids.map((day, idx) => {
                if (day === null) return <div key={`empty-${idx}`} className="h-[72px]" />;
                
                const dateStr = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                const history = historyData[dateStr];
                const isToday = dateStr === todayDateStr;

                return (
                  <button key={day} onClick={() => setSelectedDateDetails(history || { date: dateStr, score: 0, totalCalories: 0, status: 'empty', advice: 'この日の記録はまだありません。', meals: { breakfast: null, lunch: null, dinner: null, snack: null } })}
                    className={`relative flex flex-col items-center justify-start h-[72px] rounded-2xl p-1.5 transition-all
                      ${history ? 'cursor-pointer hover:ring-2 hover:ring-emerald-500/30 bg-slate-50' : 'cursor-pointer hover:ring-2 hover:ring-slate-300 bg-transparent opacity-60'}
                      ${isToday ? 'ring-2 ring-emerald-500 bg-emerald-50/50' : 'border border-slate-100'}
                    `}
                  >
                    <span className={`text-[11px] font-bold ${isToday ? 'text-emerald-600' : 'text-slate-600'}`}>{day}</span>
                    {history && (
                      <div className="flex flex-col items-center mt-auto w-full gap-0.5 pb-0.5">
                        <div className={`w-2 h-2 rounded-full ${history.status === 'achieved' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        <span className="text-[9px] font-extrabold text-slate-800 leading-none mt-1">{history.totalCalories}</span>
                        <span className="text-[8px] font-bold text-slate-400 leading-none">kcal</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* -------------------- REPORT SCREEN -------------------- */}
      {activeTab === 'report' && (
        <div className="animate-in fade-in duration-300">
          <header className="bg-white px-6 pt-8 pb-6 mb-6 shadow-sm rounded-b-[2.5rem]">
            <h1 className="text-xl font-extrabold tracking-tight text-slate-800 mb-8 text-center">週間レポート</h1>
            
            {/* Score Ring */}
            <div className="flex justify-center mb-8 relative">
              <div className="relative w-52 h-52 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90 drop-shadow-sm">
                  <circle cx="104" cy="104" r="90" stroke="currentColor" strokeWidth="18" fill="transparent" className="text-slate-50" />
                  <circle cx="104" cy="104" r="90" stroke="currentColor" strokeWidth="18" fill="transparent" strokeDasharray={2 * Math.PI * 90} strokeDashoffset={(2 * Math.PI * 90) - ((weeklyReport.avgScore / 100) * (2 * Math.PI * 90))} strokeLinecap="round" className="text-emerald-500 transition-all duration-1000 ease-out" />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-bold text-emerald-600 mb-1">週間平均スコア</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-6xl font-black tracking-tighter text-slate-800">{weeklyReport.daysWithRecord > 0 ? weeklyReport.avgScore : '-'}</span>
                    <span className="text-xl font-bold text-slate-400">/100</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Advice panel */}
            <div className="px-2">
              <YukushiMessage message={weeklyReport.daysWithRecord > 0 ? `過去7日間で ${weeklyReport.daysWithRecord}日 記録できました！継続は力なりです。` : '過去7日間の記録がありません。毎日の食事を記録して、一週間の変化や傾向をグラフで確認しましょう！'} />
            </div>
          </header>

          <main className="px-5 space-y-6">
            {/* Calorie Bar Chart */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <h3 className="text-sm font-extrabold text-slate-800 mb-6 flex items-center gap-2">
                <div className="w-2 h-5 bg-blue-500 rounded-full"/>週間カロリー推移
              </h3>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyReport.data} margin={{ top: 20, right: 30, left: -20, bottom: 0 }} barSize={30}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} />
                    <ReferenceLine y={currentTarget.calories} stroke="#fbbf24" strokeDasharray="5 5" strokeWidth={2} label={{ position: 'top', value: `目標`, fill: '#fbbf24', fontSize: 10, fontWeight: 700 }} />
                    <Bar dataKey="摂取カロリー" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* PFC Balance Donut Chart */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <h3 className="text-sm font-extrabold text-slate-800 mb-4 flex items-center gap-2">
                <div className="w-2 h-5 bg-emerald-500 rounded-full"/>週間PFC平均バランス
              </h3>
              <div className="flex items-center h-40 w-full relative">
                <div className="w-1/2 h-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={weeklyReport.weeklyPFC}
                        cx="50%" cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {weeklyReport.weeklyPFC.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center font-black text-slate-800 tracking-tighter">
                    <span className="text-lg">PFC</span>
                  </div>
                </div>
                <div className="w-1/2">
                   {renderPFCLegend({payload: weeklyReport.weeklyPFC}, weeklyReport.weeklyTotalPFC, weeklyReport.weeklyPFC)}
                </div>
              </div>
            </div>
          </main>
        </div>
      )}

      {/* -------------------- BOTTOM NAVIGATION -------------------- */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-slate-100 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)] px-6 py-4 flex justify-between items-center z-40">
        <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'home' ? 'text-emerald-600' : 'text-slate-400 hover:text-emerald-500'}`}>
          <Home size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
          <span className="text-[10px] font-bold">ホーム</span>
        </button>
        <button onClick={() => setActiveTab('calendar')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'calendar' ? 'text-emerald-600' : 'text-slate-400 hover:text-emerald-500'}`}>
          <CalendarIcon size={24} strokeWidth={activeTab === 'calendar' ? 2.5 : 2} />
          <span className="text-[10px] font-bold">カレンダー</span>
        </button>
        
        <button onClick={() => setIsRecordModalOpen(true)} className="relative -top-6 bg-emerald-600 text-white p-4 rounded-full shadow-lg shadow-emerald-500/30 hover:bg-emerald-500 hover:scale-105 active:scale-95 transition-all">
          <PlusCircle size={28} strokeWidth={2} />
        </button>

        {/* --- NOW LINKED TO REPORT TAB --- */}
        <button onClick={() => setActiveTab('report')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'report' ? 'text-emerald-600' : 'text-slate-400 hover:text-emerald-500'}`}>
          <PieChartIcon size={24} strokeWidth={activeTab === 'report' ? 2.5 : 2} />
          <span className="text-[10px] font-bold">レポート</span>
        </button>

        <button onClick={() => setIsSettingsModalOpen(true)} className="flex flex-col items-center gap-1 text-slate-400 hover:text-emerald-500 transition-colors">
          <Settings size={24} strokeWidth={2} />
          <span className="text-[10px] font-bold">設定</span>
        </button>
      </nav>

      {/* -------------------- RECORD MODAL & CALENDAR DETAIL MODAL ARE PRESERVED HERE (truncated for brevity but they are still in logic above, I will just render them perfectly same as before -------------------- */}
      {/* 1. Record Meal Modal */}
      {isRecordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 sm:p-0 animate-in fade-in duration-200">
           {/* Modal Body */}
           <div className="bg-white rounded-[2rem] sm:rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in slide-in-from-bottom-12 duration-300 max-h-[90vh] flex flex-col">
            <div className="p-6 pb-4 border-b border-slate-50 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-slate-800">食事を記録する</h2>
              <button onClick={() => setIsRecordModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors"><X size={20} /></button>
            </div>
            {/* Same content as before */}
            <div className="p-6 overflow-y-auto pb-8 space-y-6">
              <div>
                <label className="text-sm font-bold text-slate-700 mb-3 block">食事のタイミング</label>
                <div className="flex gap-2">
                  {([ { id: 'breakfast', label: '朝食' }, { id: 'lunch', label: '昼食' }, { id: 'dinner', label: '夕食' }, { id: 'snack', label: '間食' }, ] as {id: MealCategory, label: string}[]).map((cat) => (
                    <button key={cat.id} onClick={() => setMealCategory(cat.id)} className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${ mealCategory === cat.id ? 'bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/20' : 'bg-slate-50 text-slate-500 hover:bg-slate-100' }`}>{cat.label}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-slate-700 mb-3 block">メニュー名・材料など自由入力</label>
                <textarea value={mealText} onChange={(e) => setMealText(e.target.value)} placeholder="例：鶏肉のサラダと玄米、お味噌汁" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 min-h-[100px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all resize-none text-sm" />
              </div>
              {!mealImage ? (
                <div className="flex gap-2">
                  <label className="flex-1 flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-2xl py-3 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 hover:border-emerald-200 transition-all cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    <Camera size={18} />
                    <span className="text-xs font-bold">写真を追加 (任意)</span>
                  </label>
                </div>
              ) : (
                <div className="relative w-full rounded-2xl overflow-hidden aspect-video bg-slate-100 border border-slate-200 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mealImage} alt="Meal preview" className="w-full h-full object-cover" />
                  <button onClick={() => setMealImage(null)} className="absolute top-3 right-3 bg-slate-900/60 text-white p-2 rounded-full hover:bg-slate-900 transition-colors backdrop-blur-sm"><X size={16} /></button>
                </div>
              )}

              <div className="pt-2">
                {!analysisResult ? (
                  <div className="space-y-3">
                    <button onClick={handleAnalyze} disabled={!(mealText.trim() || mealImage) || isAnalyzing} className={`w-full flex items-center justify-center gap-2 font-bold rounded-2xl py-4 transition-all shadow-lg ${ isAnalyzing ? 'bg-slate-800 text-slate-200 shadow-slate-900/10 cursor-not-allowed' : (mealText.trim() || mealImage) ? 'bg-emerald-600 text-white shadow-emerald-600/20 hover:bg-emerald-500 active:scale-[0.98]' : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' }`}>
                      {isAnalyzing ? <><Loader2 className="animate-spin" size={20} />AIが解析中...</> : <><Sparkles size={20} className={(mealText.trim() || mealImage) ? "text-emerald-200" : "text-slate-400"} />AIで栄養素を解析する</>}
                    </button>
                    {analysisError && (
                      <div className="text-sm font-semibold text-red-600 bg-red-50 p-3 rounded-xl border border-red-100 flex items-start gap-2 animate-in slide-in-from-top-2 duration-300">
                        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                        <span className="leading-tight">{analysisError}</span>
                      </div>
                    )}
                    <button onClick={handleRecordWithoutAnalysis} disabled={!(mealText.trim() || mealImage) || isAnalyzing} className="w-full font-bold text-slate-500 py-3 rounded-2xl transition-colors hover:bg-slate-100 active:bg-slate-200 mt-2 text-sm">
                      解析せずにテキストだけ記録する
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
                      <div className="flex items-center gap-2 text-emerald-700 font-bold mb-4"><CheckCircle2 size={20} /> 解析が完了しました</div>
                      <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm justify-between">
                        <div className="bg-white rounded-xl p-3 shadow-sm flex flex-col"><span className="text-slate-500 text-xs font-semibold mb-1">カロリー</span><span className="text-slate-800 font-extrabold text-lg">{analysisResult.calories}<span className="text-xs font-medium ml-1">kcal</span></span></div>
                        <div className="bg-white rounded-xl p-3 shadow-sm flex flex-col"><span className="text-slate-500 text-xs font-semibold mb-1">タンパク質</span><span className="text-slate-800 font-extrabold text-lg">{analysisResult.protein}<span className="text-xs font-medium ml-1">g</span></span></div>
                        <div className="bg-white rounded-xl p-3 shadow-sm flex flex-col"><span className="text-slate-500 text-xs font-semibold mb-1">脂質</span><span className="text-slate-800 font-extrabold text-lg">{analysisResult.fat}<span className="text-xs font-medium ml-1">g</span></span></div>
                        <div className="bg-white rounded-xl p-3 shadow-sm flex flex-col"><span className="text-slate-500 text-xs font-semibold mb-1">炭水化物</span><span className="text-slate-800 font-extrabold text-lg">{analysisResult.carbs}<span className="text-xs font-medium ml-1">g</span></span></div>
                      </div>
                    </div>
                    <button onClick={handleRecord} className="w-full bg-slate-900 text-white font-bold rounded-2xl py-4 shadow-lg shadow-slate-900/20 hover:bg-slate-800 active:scale-[0.98] transition-all flex justify-center items-center gap-2">
                       <CheckCircle2 size={20} className="text-slate-300" />
                       {(historyData[recordTargetDate === 'today' ? todayDateStr : recordTargetDate]?.meals[mealCategory]?.length > 0 && !editingMealId) ? `${({ breakfast: '朝食', lunch: '昼食', dinner: '夕食', snack: '間食' })[mealCategory]}をさらに追加する` : 'この内容で記録する'}
                    </button>
                  </div>
                )}
              </div>
            </div>
           </div>
        </div>
      )}

      {/* 2. Daily Report Detail Bottom Drawer (Calendar) */}
      {selectedDateDetails && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-t-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl animate-in slide-in-from-bottom-full duration-300 max-h-[85vh] flex flex-col">
            <div className="w-full pt-3 pb-2 flex justify-center shrink-0"><div className="w-12 h-1.5 bg-slate-200 rounded-full" /></div>
            <div className="p-6 pt-2 pb-4 border-b border-slate-50 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-slate-800">{selectedDateDetails.date.replace(/-/g, '/')} の記録</h2>
              <button onClick={() => setSelectedDateDetails(null)} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors"><X size={20} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto pb-12 space-y-6">
              <div className={`rounded-[2rem] p-6 shadow-sm border flex flex-col items-center text-center ${selectedDateDetails.status === 'achieved' ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                <span className={`text-sm font-bold mb-2 ${selectedDateDetails.status === 'achieved' ? 'text-emerald-600' : 'text-red-500'}`}>総合スコア</span>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className={`text-6xl font-black tracking-tighter ${selectedDateDetails.status === 'achieved' ? 'text-emerald-500' : 'text-red-500'}`}>{selectedDateDetails.score}</span>
                  <span className={`text-base font-bold ${selectedDateDetails.status === 'achieved' ? 'text-emerald-500/50' : 'text-red-500/50'}`}>点</span>
                </div>
                <p className="text-slate-700 font-semibold text-sm leading-relaxed">{selectedDateDetails.advice}</p>
                <div className="mt-4 pt-4 border-t border-slate-100 w-full">
                  <button onClick={() => { setRecordTargetDate(selectedDateDetails.date); setIsRecordModalOpen(true); setSelectedDateDetails(null); }} className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-2xl shadow-md hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                    <PlusCircle size={18} /> この日の食事を記録する
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-slate-800 text-sm">食事内容</h3>
                {([ { id: 'breakfast', label: '朝食', icon: '🌅' }, { id: 'lunch', label: '昼食', icon: '☀️' }, { id: 'dinner', label: '夕食', icon: '🌙' }, { id: 'snack', label: '間食', icon: '🍪' }, ] as const).map((cat) => {
                  const mealsForCat = selectedDateDetails.meals[cat.id];
                  if (!mealsForCat || mealsForCat.length === 0) return null;
                  return mealsForCat.map((meal, index) => (
                    <div key={`${cat.id}-${meal.id || index}`} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div className="flex gap-2 items-center"><span className="text-lg">{cat.icon}</span><div><span className="text-xs font-bold text-slate-500 block">{cat.label} {mealsForCat.length > 1 ? index + 1 : ''}</span><span className="text-sm font-extrabold text-slate-800">{meal.name}</span></div></div>
                        <div className="flex items-center gap-1">
                          {meal.isUnanalyzed ? (
                            <button onClick={() => triggerAnalysisForMeal(selectedDateDetails.date, cat.id, meal.name, meal.image, meal.id)} className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md font-bold hover:bg-emerald-200 transition-colors flex items-center gap-1 mr-1">
                              <Sparkles size={12} /> 解析
                            </button>
                          ) : (
                            <span className="text-sm font-extrabold text-slate-800 bg-slate-50 py-1 px-2 rounded-lg mr-1">{meal.calories}<span className="text-[10px] text-slate-500 ml-0.5">kcal</span></span>
                          )}
                          <button onClick={() => triggerAnalysisForMeal(selectedDateDetails.date, cat.id, meal.name, meal.image, meal.id)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-md transition-colors"><Edit2 size={16} /></button>
                          <button onClick={() => handleDeleteMeal(selectedDateDetails.date, cat.id, meal.id!)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"><Trash2 size={16} /></button>
                        </div>
                      </div>
                      {!meal.isUnanalyzed && (
                        <div className="flex gap-3 text-xs font-semibold text-slate-600 bg-slate-50 p-2.5 rounded-xl justify-between">
                          <span>P: <span className="text-slate-800 font-bold">{meal.protein}g</span></span><span>F: <span className="text-slate-800 font-bold">{meal.fat}g</span></span><span>C: <span className="text-slate-800 font-bold">{meal.carbs}g</span></span>
                        </div>
                      )}
                      {meal.image ? (
                        <div className="w-full h-32 rounded-xl overflow-hidden mt-1 shadow-sm border border-slate-50">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={meal.image} alt="Meal" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-full h-20 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer rounded-xl flex items-center justify-center border border-slate-100 mt-1" onClick={() => triggerAnalysisForMeal(selectedDateDetails.date, cat.id, meal.name, meal.image, meal.id)}><div className="flex flex-col items-center gap-1 text-slate-300"><ImageIcon size={18} /><span className="text-[10px] font-bold">写真追加</span></div></div>
                      )}
                    </div>
                  ));
                })}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 3. Settings Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 sm:p-0 animate-in fade-in duration-200">
           <div className="bg-white rounded-[2rem] sm:rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in slide-in-from-bottom-12 duration-300 max-h-[90vh] flex flex-col">
            <div className="p-6 pb-4 border-b border-slate-50 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-slate-800">プロフィール設定</h2>
              <button onClick={() => setIsSettingsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto pb-8 space-y-6">
              <div>
                <label className="text-sm font-bold text-slate-700 mb-2 block">身長 (cm)</label>
                <input type="number" value={profile.height} onChange={(e) => setProfile(p => ({...p, height: e.target.value}))} placeholder="例: 170" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all text-base font-bold" />
              </div>
              <div>
                <label className="text-sm font-bold text-slate-700 mb-2 block">現在の体重 (kg)</label>
                <input type="number" value={profile.weight} onChange={(e) => setProfile(p => ({...p, weight: e.target.value}))} placeholder="例: 65" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all text-base font-bold" />
              </div>
              <div>
                <label className="text-sm font-bold text-slate-700 mb-2 block">目標 (テキスト)</label>
                <input type="text" value={profile.goal} onChange={(e) => setProfile(p => ({...p, goal: e.target.value}))} placeholder="例: 1ヶ月で-2kg" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all text-base font-bold" />
              </div>
              
              <button onClick={() => setIsSettingsModalOpen(false)} className="w-full bg-slate-900 text-white font-bold rounded-2xl py-4 shadow-lg shadow-slate-900/20 hover:bg-slate-800 active:scale-[0.98] transition-all flex justify-center items-center mt-4">
                 保存する
              </button>

              <div className="pt-6 mt-4 border-t border-slate-100">
                <button onClick={() => signOut()} className="w-full bg-red-50 text-red-600 font-bold rounded-2xl py-4 shadow-sm border border-red-100 hover:bg-red-100 active:scale-[0.98] transition-all flex justify-center items-center gap-2">
                  <LogOut size={18} /> ログアウト
                </button>
              </div>
            </div>
           </div>
        </div>
      )}

    </div>
  );
}
