import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, Schema, SchemaType } from '@google/generative-ai';

// Initialize Gemini with API Key from environment variable
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Define the expected output schema for structured JSON response
const nutritionSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    foodName: {
      type: SchemaType.STRING,
      description: "一般的な料理名",
    },
    calories: {
      type: SchemaType.NUMBER,
      description: "推定される総カロリー (kcal)",
    },
    protein: {
      type: SchemaType.NUMBER,
      description: "推定されるタンパク質量 (g)",
    },
    fat: {
      type: SchemaType.NUMBER,
      description: "推定される脂質量 (g)",
    },
    carbs: {
      type: SchemaType.NUMBER,
      description: "推定される炭水化物量 (g)",
    },
  },
  required: ["foodName", "calories", "protein", "fat", "carbs"],
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { mealText } = body;

    if (!mealText) {
      return NextResponse.json({ error: '食事内容が入力されていません。' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error('Missing GEMINI_API_KEY environment variable.');
      return NextResponse.json({ error: 'サーバー環境変数の設定エラーです（GEMINI_API_KEY）。ローカルの.env.localを確認してください。' }, { status: 500 });
    }

    // Initialize the model with the schema to guarantee JSON structure
    const model = genAI.getGenerativeModel({
      model: "gemini-3-flash-preview",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: nutritionSchema,
      },
      systemInstruction: "あなたはプロの管理栄養士です。ユーザーが入力した食事内容から、栄養素を推測・計算して返してください。"
    });

    const result = await model.generateContent(`以下の食事内容の栄養素を解析してください。\n食事内容: ${mealText}`);
    const responseText = result.response.text();
    
    // The response is guaranteed to match our schema
    const nutritionData = JSON.parse(responseText);

    return NextResponse.json(nutritionData);

  } catch (error) {
    console.error('Error analyzing food with Gemini:', error);
    return NextResponse.json({ error: 'AI解析中にエラーが発生しました。' }, { status: 500 });
  }
}
