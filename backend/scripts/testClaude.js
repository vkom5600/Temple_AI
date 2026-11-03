
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";

dotenv.config();

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

async function testClaude() {
  try {
    console.log("Testing Claude API...");
    console.log("Model:", process.env.CLAUDE_MODEL);

    const response = await client.messages.create({
      model: process.env.CLAUDE_MODEL,
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: "Say Hello in one sentence."
        }
      ]
    });

    console.log("SUCCESS!");
    console.log(response.content);
  }  catch (error) {
  console.log("\n========== FULL CLAUDE ERROR ==========");

  console.log("Message:", error.message);
  console.log("Status:", error.status);
  console.log("Type:", error.type);

  console.log("\nAPI Error Details:");
  console.dir(error.error, { depth: null });

  console.log("\nResponse Body:");
  console.dir(error.response?.data, { depth: null });

  console.log("\nResponse Headers:");
  console.log(
    error.headers?.get("request-id") || "Not available"
  );

  console.log("=======================================\n");
}
}

testClaude();
