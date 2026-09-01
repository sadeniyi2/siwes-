import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 30; // Extend Vercel timeout for AI image processing

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const prompt = `
      You are an expert logbook extraction assistant for a SIWES (Student Industrial Work Experience Scheme) logbook.
      Analyze this image of a handwritten weekly logbook page chart.
      
      Extract each day's entry accurately.
      For each day found (Monday through Saturday):
      1. Identify the date and format it as an ISO string (YYYY-MM-DD). If the year is missing, assume 2026.
      2. Extract the complete text written under "DESCRIPTION OF WORKDONE".
      
      Return ONLY a valid JSON array of objects with keys: "date" (YYYY-MM-DD string) and "description" (string).
      Do not include markdown ticks, backticks, or extra explanation. Just the raw JSON array.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { data: imageBase64, mimeType: mimeType || "image/jpeg" } }
          ]
        }
      ]
    });

    const rawText = response.text || "[]";
    const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    const extractedData = JSON.parse(cleanJson);

    return NextResponse.json({ success: true, entries: extractedData });
  } catch (error) {
    console.error("Vision AI Error:", error);
    return NextResponse.json({ error: "Failed to process image. Image might be too large or invalid." }, { status: 500 });
  }
}
