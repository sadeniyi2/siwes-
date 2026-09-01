import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const prompt = `
      You are an expert data extraction assistant for a student logbook. 
      Analyze this image of a handwritten logbook page.
      Extract the date, the description of work done (activities), and the hours worked.
      Return ONLY a valid JSON array of objects with the keys: "date", "description", and "hours". 
      Do not include any markdown formatting, backticks, or other text. Just the raw JSON array.
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
    return NextResponse.json({ error: "Failed to scan logbook page" }, { status: 500 });
  }
}
