"use client";

import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import { Home, PlusCircle, Calendar as CalendarIcon, Settings, Camera, X, Info, Loader2, CheckCircle2, Sparkles, ChevronLeft, ChevronRight, Image as ImageIcon, Smile, AlertTriangle, CheckCircle, PieChart as PieChartIcon, Flame } from 'lucide-react';

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
// DUMMY DATA FOR REPORT SCREEN
// ---------------------------------------------
const reportData = {
  score: 82,
  advice: "カロリーを目標内に抑えつつ、タンパク質もしっかり摂れています！素晴らしいペースです。",
  targetCalories: 1800,
  actualCalories: 1710,
  pfc: [
    { name: 'タンパク質', value: 95, fill: '#3b82f6', ideal: '25%' }, 
    { name: '脂質', value: 55, fill: '#fbbf24', ideal: '20%' },      
    { name: '炭水化物', value: 210, fill: '#10b981', ideal: '55%' }   
  ],
  meals: [
    { id: '1', time: '朝食', name: 'トーストと目玉焼き', calories: 450, eval: 'good', comment: 'バランス良好' },
    { id: '2', time: '昼食', name: '豚骨ラーメン', calories: 650, eval: 'warning', comment: '脂質が多めです' },
    { id: '3', time: '夕食', name: '鶏むね肉とサラダ', calories: 500, eval: 'good', comment: '高タンパク低脂質！' },
    { id: '4', time: '間食', name: 'プロテインバー', calories: 110, eval: 'average', comment: '適度な間食です' },
  ]
};

// Calculate actual percentages for the custom Legend
const totalPFC = reportData.pfc.reduce((acc, item) => acc + item.value, 0);

// For the Calorie Bar Chart
const calorieChartData = [
  { name: '本日', 摂取カロリー: reportData.actualCalories }
];


// ---------------------------------------------
// DUMMY DATA FOR HISTORY SCREEN
// ---------------------------------------------
interface MealHistory { name: string; calories: number; protein: number; fat: number; carbs: number; }
interface DailyHistory { date: string; score: number; totalCalories: number; status: 'achieved' | 'exceeded' | 'empty'; advice: string; meals: Record<MealCategory, MealHistory | null>; }

const dummyHistory: Record<string, DailyHistory> = {
  '2026-03-14': {
    date: '2026-03-14', score: 98, totalCalories: 1780, status: 'achieved',
    advice: 'カロリーもPFCバランスも完璧です！この調子で続けていきましょう。',
    meals: {
      breakfast: { name: 'オートミールと卵', calories: 400, protein: 20, fat: 12, carbs: 50 },
      lunch: { name: '鶏むね肉のサラダボウル', calories: 600, protein: 45, fat: 15, carbs: 60 },
      dinner: { name: '鮭の塩焼き定食', calories: 650, protein: 35, fat: 20, carbs: 70 },
      snack: { name: 'プロテイン', calories: 130, protein: 25, fat: 2, carbs: 5 }
    }
  },
  '2026-03-15': {
    date: '2026-03-15', score: 85, totalCalories: 1950, status: 'achieved',
    advice: '少しカロリーは多めですが、目標内です。タンパク質がしっかり摂れています！',
    meals: {
      breakfast: { name: 'トーストと目玉焼き', calories: 450, protein: 15, fat: 20, carbs: 45 },
      lunch: { name: '幕の内弁当', calories: 800, protein: 30, fat: 25, carbs: 95 },
      dinner: { name: '豚の生姜焼き', calories: 700, protein: 30, fat: 35, carbs: 60 },
      snack: null
    }
  },
  '2026-03-16': {
    date: '2026-03-16', score: 60, totalCalories: 2500, status: 'exceeded',
    advice: '脂質がかなり多めでした。明日は揚げ物を控えて、野菜を多めにしましょう。',
    meals: {
      breakfast: { name: 'グラノーラと牛乳', calories: 500, protein: 15, fat: 18, carbs: 70 },
      lunch: { name: 'ラーメンとチャーハン', calories: 1200, protein: 25, fat: 50, carbs: 150 },
      dinner: { name: '唐揚げ定食', calories: 800, protein: 35, fat: 40, carbs: 70 },
      snack: null
    }
  },
};


export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('home');

  // --- Home Screen Global State ---
  const [mode, setMode] = useState<Mode>('diet');
  const [consumed, setConsumed] = useState({ calories: 1080, protein: 30, fat: 35, carbs: 150 });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [streakDays, setStreakDays] = useState(14);
  // --- Record Modal State ---
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [mealCategory, setMealCategory] = useState<MealCategory>('dinner');
  const [mealText, setMealText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{ calories: number, protein: number, fat: number, carbs: number, foodName?: string } | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // --- Calendar Date State ---
  const [selectedDateDetails, setSelectedDateDetails] = useState<DailyHistory | null>(null);

  const targets = {
    diet: { calories: 1800, protein: 90, fat: 50, carbs: 200 },
    health: { calories: 2200, protein: 110, fat: 60, carbs: 250 },
    muscle: { calories: 2600, protein: 150, fat: 70, carbs: 300 },
  };

  const currentTarget = targets[mode];
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

  const getAdvice = () => {
    const proteinShortage = Math.max(0, currentTarget.protein - consumed.protein);
    const calorieShortage = Math.max(0, remainingCalories);

    if (calorieShortage === 0) return "本日の目標カロリーに到達しました！これ以上の摂取は控えるか、軽い運動を取り入れましょう。";
    if (proteinShortage === 0) return "タンパク質の目標を達成しました！素晴らしいです。残りのカロリーはビタミンや食物繊維を中心にバランスよく摂りましょう。";
    if (proteinShortage < 15) return `あと少しでタンパク質の目標達成です（残り ${proteinShortage}g）。ゆで卵や納豆などで微調整がおすすめです。`;
    
    if (mode === 'diet') return `今日の夕食は、あと ${calorieShortage}kcal 以内に抑えましょう。タンパク質が ${proteinShortage}g 不足しています。鶏むね肉や豆腐がおすすめです。`;
    if (mode === 'muscle') return `筋肥大のためには、あと ${proteinShortage}g のタンパク質が必要です。プロテインや赤身肉をしっかり摂取しましょう。残り ${calorieShortage}kcal です。`;
    return `現在のPFCバランスは良好ですが、タンパク質が少し不足気味（あと${proteinShortage}g）です。野菜と一緒にバランスよく食べましょう。`;
  };

  const handleAnalyze = async () => {
    if (!mealText.trim()) return;
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
      });
    } catch (err: unknown) {
      setAnalysisError(err instanceof Error ? err.message : 'AIとの通信エラーが発生しました');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRecord = () => {
    if (!analysisResult) return;
    setConsumed(prev => ({
      calories: prev.calories + analysisResult.calories,
      protein: prev.protein + analysisResult.protein,
      fat: prev.fat + analysisResult.fat,
      carbs: prev.carbs + analysisResult.carbs,
    }));
    setIsRecordModalOpen(false);
    setTimeout(() => {
      setMealText('');
      setAnalysisResult(null);
      setMealCategory('dinner');
      setActiveTab('home'); 
    }, 300);
  };

  // Calendar setup
  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);
  const startDayOfWeek = 0; 
  const calendarGrids = Array(startDayOfWeek).fill(null).concat(daysInMonth);

  // Custom Legend for PFC
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderPFCLegend = (props: any) => {
    const { payload } = props;
    return (
      <ul className="flex flex-col gap-2 mt-2 w-full pl-4 border-l border-slate-100">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {payload.map((entry: any, index: number) => {
          const item = reportData.pfc[index];
          const actualPercent = Math.round((item.value / totalPFC) * 100);
          return (
            <li key={`item-${index}`} className="flex items-center text-xs text-slate-700">
              <span className="w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: entry.color }} />
              <span className="font-bold w-16">{entry.value}</span>
              <span className="font-extrabold text-slate-900 w-10 text-right">{actualPercent}%</span>
              <span className="text-[10px] text-slate-400 ml-2">({item.ideal} 理想)</span>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-28">
      
      {/* -------------------- HOME SCREEN -------------------- */}
      {activeTab === 'home' && (
        <div className="animate-in fade-in duration-300">
          <header className="bg-white px-6 py-5 shadow-sm rounded-b-3xl mb-6 transition-all">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-800">今日の設定</h1>
                <p className="text-xs text-slate-500 mt-1">170cm / 80kg → 目標 69kg</p>
              </div>
              <div className="bg-slate-100 p-1 rounded-full flex gap-1">
                <button
                  onClick={() => setMode('diet')}
                  className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all ${mode === 'diet' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >ダイエット</button>
                <button
                  onClick={() => setMode('health')}
                  className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all ${mode === 'health' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >健康維持</button>
                <button
                  onClick={() => setMode('muscle')}
                  className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all ${mode === 'muscle' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >筋トレ</button>
              </div>
            </div>

            {/* Streak Indicator */}
            <div className="flex justify-center mb-1 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="bg-orange-50 border border-orange-100 px-4 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
                <Flame size={18} className="text-orange-500 shrink-0 fill-orange-500" />
                <span className="text-sm font-extrabold text-orange-600 tracking-tight">
                  {streakDays}日連続クリア！
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
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-start gap-4 transition-all duration-500">
              <div className={`p-2 rounded-xl mt-1 shrink-0 ${caloriePercent >= 100 ? 'bg-red-50 text-red-600' : mode === 'diet' ? 'bg-emerald-50 text-emerald-600' : mode === 'health' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                <Info size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 mb-1">逆算アドバイス</h3>
                <p className="text-sm text-slate-600 leading-relaxed font-medium">{getAdvice()}</p>
              </div>
            </div>

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
          </main>
        </div>
      )}

      {/* -------------------- CALENDAR SCREEN -------------------- */}
      {activeTab === 'calendar' && (
        <div className="animate-in fade-in duration-300 px-4 pt-6">
          <div className="flex justify-between items-center mb-6 px-2">
            <h1 className="text-xl font-extrabold tracking-tight text-slate-800">履歴・カレンダー</h1>
            <div className="flex items-center gap-4 text-slate-600 font-bold bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100">
              <ChevronLeft size={20} className="text-slate-400" />
              <span className="text-sm">2026年 3月</span>
              <ChevronRight size={20} className="text-slate-400" />
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
                
                const dateStr = `2026-03-${day.toString().padStart(2, '0')}`;
                const history = dummyHistory[dateStr];
                const isToday = day === 18;

                return (
                  <button key={day} onClick={() => history ? setSelectedDateDetails(history) : null}
                    className={`relative flex flex-col items-center justify-start h-[72px] rounded-2xl p-1.5 transition-all
                      ${history ? 'cursor-pointer hover:ring-2 hover:ring-emerald-500/30 bg-slate-50' : 'cursor-default opacity-50'}
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
            <h1 className="text-xl font-extrabold tracking-tight text-slate-800 mb-8 text-center">1日の総評サマリー</h1>
            
            {/* Score Ring */}
            <div className="flex justify-center mb-8 relative">
              <div className="relative w-52 h-52 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90 drop-shadow-sm">
                  <circle cx="104" cy="104" r="90" stroke="currentColor" strokeWidth="18" fill="transparent" className="text-slate-50" />
                  <circle cx="104" cy="104" r="90" stroke="currentColor" strokeWidth="18" fill="transparent" strokeDasharray={2 * Math.PI * 90} strokeDashoffset={(2 * Math.PI * 90) - ((reportData.score / 100) * (2 * Math.PI * 90))} strokeLinecap="round" className="text-emerald-500 transition-all duration-1000 ease-out" />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-bold text-emerald-600 mb-1">総合スコア</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-6xl font-black tracking-tighter text-slate-800">{reportData.score}</span>
                    <span className="text-xl font-bold text-slate-400">/100</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Advice panel */}
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 flex gap-3 text-emerald-800 text-sm font-semibold leading-relaxed mx-2">
              <Sparkles size={20} className="text-emerald-500 shrink-0 mt-0.5" />
              <p>{reportData.advice}</p>
            </div>
          </header>

          <main className="px-5 space-y-6">
            {/* Calorie Bar Chart */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <h3 className="text-sm font-extrabold text-slate-800 mb-6 flex items-center gap-2">
                <div className="w-2 h-5 bg-blue-500 rounded-full"/>カロリー比較
              </h3>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={calorieChartData} margin={{ top: 20, right: 30, left: -20, bottom: 0 }} barSize={60}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} />
                    <ReferenceLine y={reportData.targetCalories} stroke="#fbbf24" strokeDasharray="5 5" strokeWidth={2} label={{ position: 'top', value: `目標 ${reportData.targetCalories}kcal`, fill: '#fbbf24', fontSize: 10, fontWeight: 700 }} />
                    <Bar dataKey="摂取カロリー" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* PFC Balance Donut Chart */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <h3 className="text-sm font-extrabold text-slate-800 mb-4 flex items-center gap-2">
                <div className="w-2 h-5 bg-emerald-500 rounded-full"/>PFCバランス
              </h3>
              <div className="flex items-center h-40 w-full relative">
                <div className="w-1/2 h-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={reportData.pfc}
                        cx="50%" cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {reportData.pfc.map((entry, index) => (
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
                   {renderPFCLegend({payload: reportData.pfc})}
                </div>
              </div>
            </div>

            {/* Meal Evaluations */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <h3 className="text-sm font-extrabold text-slate-800 mb-5 flex items-center gap-2">
                <div className="w-2 h-5 bg-orange-400 rounded-full"/>毎食ごとの評価
              </h3>
              <div className="space-y-3">
                {reportData.meals.map(meal => {
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

        <button className="flex flex-col items-center gap-1 text-slate-400 hover:text-emerald-500 transition-colors">
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
              
              <button className="w-full flex items-center justify-center gap-3 border-2 border-dashed border-slate-200 rounded-2xl py-5 text-slate-500 hover:text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all group">
                <div className="bg-white p-2.5 rounded-full shadow-sm border border-slate-100 group-hover:scale-110 transition-transform"><Camera size={20} className="text-slate-400 group-hover:text-emerald-500" /></div>
                <span className="text-sm font-semibold">写真を追加（UIのみ）</span>
              </button>

              <div className="pt-2">
                {!analysisResult ? (
                  <div className="space-y-3">
                    <button onClick={handleAnalyze} disabled={!mealText.trim() || isAnalyzing} className={`w-full flex items-center justify-center gap-2 font-bold rounded-2xl py-4 transition-all shadow-lg ${ isAnalyzing ? 'bg-slate-800 text-slate-200 shadow-slate-900/10 cursor-not-allowed' : mealText.trim() ? 'bg-emerald-600 text-white shadow-emerald-600/20 hover:bg-emerald-500 active:scale-[0.98]' : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' }`}>
                      {isAnalyzing ? <><Loader2 className="animate-spin" size={20} />AIが解析中...</> : <><Sparkles size={20} className={mealText.trim() ? "text-emerald-200" : "text-slate-400"} />AIで栄養素を解析する</>}
                    </button>
                    {analysisError && (
                      <div className="text-sm font-semibold text-red-600 bg-red-50 p-3 rounded-xl border border-red-100 flex items-start gap-2 animate-in slide-in-from-top-2 duration-300">
                        <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                        <span className="leading-tight">{analysisError}</span>
                      </div>
                    )}
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
                       <CheckCircle2 size={20} className="text-slate-300" />この内容で記録する
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
              </div>

              <div className="space-y-4">
                <h3 className="font-bold text-slate-800 text-sm">食事内容</h3>
                {([ { id: 'breakfast', label: '朝食', icon: '🌅' }, { id: 'lunch', label: '昼食', icon: '☀️' }, { id: 'dinner', label: '夕食', icon: '🌙' }, { id: 'snack', label: '間食', icon: '🍪' }, ] as const).map((cat) => {
                  const meal = selectedDateDetails.meals[cat.id];
                  if (!meal) return null;
                  return (
                    <div key={cat.id} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div className="flex gap-2 items-center"><span className="text-lg">{cat.icon}</span><div><span className="text-xs font-bold text-slate-500 block">{cat.label}</span><span className="text-sm font-extrabold text-slate-800">{meal.name}</span></div></div>
                        <span className="text-sm font-extrabold text-slate-800 bg-slate-50 py-1 px-3 rounded-lg">{meal.calories}<span className="text-xs text-slate-500 ml-1">kcal</span></span>
                      </div>
                      <div className="flex gap-3 text-xs font-semibold text-slate-600 bg-slate-50 p-2.5 rounded-xl justify-between">
                        <span>P: <span className="text-slate-800 font-bold">{meal.protein}g</span></span><span>F: <span className="text-slate-800 font-bold">{meal.fat}g</span></span><span>C: <span className="text-slate-800 font-bold">{meal.carbs}g</span></span>
                      </div>
                      <div className="w-full h-24 bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200 mt-1"><div className="flex flex-col items-center gap-1 text-slate-400"><ImageIcon size={20} /><span className="text-[10px] font-bold">写真</span></div></div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
