import "dotenv/config";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
console.log("OpenAI Key =", process.env.OPENAI_API_KEY);
async function test() {
  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Sag Hallo" }]
  });
  console.log(res.choices[0].message.content);
}

test();
