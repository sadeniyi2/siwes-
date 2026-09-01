import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 30;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const prompt = `
      You are an expert logbook extraction assistant for a SIWES (Student Industrial Work Experience Scheme) logbook.
      Analyze this image of a handwritten weekly logbook page chart.
      
      Extract each day's entry accurately.
      For each day found (Monday through Saturday):
      1. Identify the date and format it as an ISO string (YYYY-MM-DD). If the year is missing, assume 2026.
      2. Extract the complete text written under "DESCRIPTION OF WORKDONE".
      
      Return ONLY a valid JSON array of objects with keys: "date" (YYYY-MM-DD string) and "description" (string).
      Example: [{"date": "2026-08-31", "description": "Conducted morning briefing."}]
    `;

    // Uses gemini-1.5-flash / gemini-2.0-flash via standard AI Studio key
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: cleanBase64,
          mimeType: mimeType || "image/jpeg",
        },
      },
    ]);

    const response = await result.response;
    const rawText = response.text() || "[]";

    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Could not read structured entries from image." }, { status: 422 });
    }

    const extractedData = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ success: true, entries: extractedData });
  } catch (error) {
    console.error("Vision AI Error Detail:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process image." },
      { status: 500 }
    );
  }
}
